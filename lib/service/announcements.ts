/**
 * Layer: service — 새소식 (공지 + 업데이트) 조회 (announcement-popup §3).
 *
 * GET /api/announcements 가 호출. 레지스트리 updates/notices 탭을 10분 캐시로
 * 읽고(me.ts me-bundle 동일 패턴), 사용자 cohort 기준으로 공지 대상을 필터한다.
 *
 * 노출 규칙 (SoR §1-2·§3):
 *   notices — active=TRUE && 기간(start~end, 빈값 무제한) && audience 매칭
 *             (arena 판정 = cohort 라벨 `A` 접두, 예 "A1-6").
 *   updates — visible=TRUE 최신(pr desc) 10개.
 * 빈도 제어(once/daily/always)는 클라 localStorage — 서버는 후보만 내려준다.
 */
import { unstable_cache } from "next/cache";
import { readNotices, readUpdates } from "@/repo/announcements";
import { findUserByEmail } from "@/repo/users";
import { Notice, UpdateItem } from "@/types";

const VISIBLE_LIMIT = 10;

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

/** 순수 필터 — visible=TRUE 최신(pr desc) 10개. */
export function pickVisibleUpdates(updates: UpdateItem[]): UpdateItem[] {
  return updates
    .filter((u) => u.visible)
    .sort((a, b) => b.pr - a.pr)
    .slice(0, VISIBLE_LIMIT);
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
  return { notices, updates, latestPr: updates[0]?.pr ?? 0 };
}
