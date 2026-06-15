/**
 * Layer: service — 새소식 (공지 + 업데이트) 조회 (announcement-popup §3).
 *
 * GET /api/announcements 가 호출. 레지스트리 updates/notices 탭을 10분 캐시로
 * 읽고(me.ts me-bundle 동일 패턴), 사용자 cohort 기준으로 공지 대상을 필터한다.
 *
 * 노출 규칙 (SoR §1-2·§3):
 *   notices — active=TRUE && 기간(start~end, 빈값 무제한) && audience 매칭
 *             (arena 판정 = cohort 라벨 `A` 접두, 예 "A1-6").
 *   updates — visible=TRUE 최신(pr desc) 6개.
 * 빈도 제어(once/daily/always)는 클라 localStorage — 서버는 후보만 내려준다.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import {
  patchUpdateRow,
  readNotices,
  readUpdates,
  upsertNotice,
  type UpdatePatch,
} from "@/repo/announcements";
import { uploadNoticeImage } from "@/repo/drive-txt";
import { findUserByEmail } from "@/repo/users";
import { Notice, UpdateItem } from "@/types";
import { groupUpdates } from "./update-groups";

const VISIBLE_LIMIT = 6;

/** cohort 라벨 `A` 접두 = 아레나 (예 "A1-6", "A1-6기"). 빈값·일반 기수=false. */
export function isArenaAudienceCohort(cohort: string | null | undefined): boolean {
  return /^A/i.test(String(cohort ?? "").trim());
}

/** KST 기준 오늘 YYYY-MM-DD (기간 비교용 — 시트 start/end 와 동일 포맷). */
export function todayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 순수 필터 — 테스트 대상. active·기간·audience 매칭 + pinned 우선 정렬. */
export function filterNoticesFor(
  notices: Notice[],
  opts: { isArena: boolean; today: string },
): Notice[] {
  return notices
    .filter((n) => {
      if (!n.active) return false;
      if (n.start && opts.today < n.start) return false;
      if (n.end && opts.today > n.end) return false;
      if (n.audience === "arena" && !opts.isArena) return false;
      if (n.audience === "regular" && opts.isArena) return false;
      return true;
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.id < b.id ? 1 : -1));
}

/** 보관함(/updates) 공지용 순수 필터 — 팝업과 달리 만료(end<today)도 포함해
 *  '지난 공지 다시보기'. 미래(start>today) 제외, active·audience 매칭, 날짜 desc. */
export function filterNoticesArchiveFor(
  notices: Notice[],
  opts: { isArena: boolean; today: string },
): Notice[] {
  const dateOf = (n: Notice) => n.start || n.created || "";
  return notices
    .filter((n) => {
      if (!n.active) return false;
      if (n.start && opts.today < n.start) return false; // 미래 공지 제외
      if (n.audience === "arena" && !opts.isArena) return false;
      if (n.audience === "regular" && opts.isArena) return false;
      return true; // 만료(end<today) 포함
    })
    .sort((a, b) => {
      const da = dateOf(a);
      const db = dateOf(b);
      if (da !== db) return da < db ? 1 : -1; // 날짜 desc
      return a.id < b.id ? 1 : -1; // 동일 날짜 tie-break: id desc
    });
}

/** 순수 필터 — visible=TRUE 최신(pr desc) 6개. */
export function pickVisibleUpdates(updates: UpdateItem[]): UpdateItem[] {
  // 묶음(§7-4): limit 은 "항목(그룹=1)" 단위 — 항목 6개에 속한 행 전부 반환,
  // 그룹핑·표시는 클라(UpdateAccordion)가 같은 groupUpdates 규칙으로 수행.
  const visible = updates.filter((u) => u.visible);
  const top = groupUpdates(visible).slice(0, VISIBLE_LIMIT);
  const keep = new Set(top.flatMap((g) => g.prs));
  return visible.filter((u) => keep.has(u.pr)).sort((a, b) => b.pr - a.pr);
}

/** 보관함(/updates) — 항목(그룹) 단위 페이징. offset/limit 은 항목 개수. */
export async function listUpdatesArchive(
  offset: number,
  limit: number,
): Promise<{ rows: UpdateItem[]; totalItems: number }> {
  const tabs = await cachedTabs();
  const visible = tabs.updates.filter((u) => u.visible);
  const groups = groupUpdates(visible);
  const page = groups.slice(offset, offset + limit);
  const keep = new Set(page.flatMap((g) => g.prs));
  return {
    rows: visible.filter((u) => keep.has(u.pr)).sort((a, b) => b.pr - a.pr),
    totalItems: groups.length,
  };
}

/** 보관함 공지 — 사용자 audience 매칭 + 만료 포함(지난 공지 다시보기), 날짜 desc. */
export async function listNoticesArchiveFor(email: string): Promise<Notice[]> {
  const [tabs, user] = await Promise.all([
    cachedTabs(),
    findUserByEmail(email).catch(() => null),
  ]);
  const isArena = isArenaAudienceCohort(user?.cohort);
  return filterNoticesArchiveFor(tabs.notices, { isArena, today: todayKST() });
}

// 탭 read 10분 캐시 — me-bundle 과 동일 패턴. admin 이 수정하면 다음 갱신에 반영
// (즉시 필요 시 invalidateTag("announcements") — PR③ admin CRUD 에서 사용 예정).
const cachedTabs = unstable_cache(
  async () => {
    const [updates, notices] = await Promise.all([readUpdates(), readNotices()]);
    return { updates, notices };
  },
  ["announcements-v1"],
  { revalidate: 600, tags: ["announcements"] },
);

export interface AnnouncementsView {
  notices: Notice[];
  updates: UpdateItem[];
  /** 클라 lastSeenPr 비교용 — visible 업데이트 최신 pr (없으면 0). */
  latestPr: number;
}

/** 사용자 이메일 기준 새소식 조회 — 미등록(prep/admin 미배정)은 regular 취급. */
export async function getAnnouncementsFor(email: string): Promise<AnnouncementsView> {
  const [tabs, user] = await Promise.all([
    cachedTabs(),
    findUserByEmail(email).catch(() => null),
  ]);
  const isArena = isArenaAudienceCohort(user?.cohort);
  const notices = filterNoticesFor(tabs.notices, { isArena, today: todayKST() });
  const updates = pickVisibleUpdates(tabs.updates);
  const latestPr = tabs.updates.reduce((m, u) => (u.visible && u.pr > m ? u.pr : m), 0);
  return { notices, updates, latestPr };
}

// ── admin 팝업관리 (announcement-popup §4, PR③) ─────────────────

/** admin 화면용 — 필터·캐시 없이 raw 전체 (updates 는 pr desc). */
export async function listAnnouncementsAdmin(): Promise<{
  notices: Notice[];
  updates: UpdateItem[];
}> {
  const [updates, notices] = await Promise.all([readUpdates(), readNotices()]);
  return { notices, updates: updates.sort((a, b) => b.pr - a.pr) };
}

/** 공지 저장 — id 없으면 신규 생성(타임스탬프 id). 저장 후 수강생 캐시 무효화. */
export async function saveNoticeAdmin(
  input: Omit<Notice, "id" | "created" | "updated"> & { id?: string },
): Promise<Notice> {
  const now = new Date().toISOString();
  const existing = input.id?.trim();
  const notice = Notice.parse({
    ...input,
    id: existing || `n-${Date.now()}`,
    created: existing ? (input as { created?: string }).created || now : now,
    updated: now,
  });
  await upsertNotice(notice);
  revalidateTag("announcements");
  return notice;
}

/** 업데이트 행 보정 (title_user/body_md/milestone/visible) + 캐시 무효화. */
export async function patchUpdateAdmin(pr: number, patch: UpdatePatch): Promise<boolean> {
  const ok = await patchUpdateRow(pr, patch);
  if (ok) revalidateTag("announcements");
  return ok;
}

/** 공지 이미지 업로드 — Drive 폴더 + anyoneWithLink reader → MD 삽입용 URL. */
export async function uploadNoticeImageAdmin(
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<{ fileId: string; url: string }> {
  return uploadNoticeImage(fileName, mimeType, data);
}
