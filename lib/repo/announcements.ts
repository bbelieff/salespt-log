/**
 * Layer: repo — 레지스트리 `updates`·`notices` 탭 (새소식, announcement-popup §1).
 *
 * 개인 시트가 아니라 SHEETS_REGISTRY_ID 의 탭 2개:
 *   updates (A~G) — 배포 시 scripts/append-updates.mjs 자동 append (코드 밖, 멱등).
 *   notices (A~K) — 운영자 공지 (admin 팝업관리가 작성 — PR③ admin-popup-mgmt).
 *
 * read + 탭 자동 생성 (PR①) + admin 쓰기 (PR③ admin-popup-mgmt):
 *   upsertNotice — 자기 키(id) 행만 update / 신규는 빈 행 탐색 append.
 *   patchUpdateRow — pr 키 행의 D~G(title_user/body_md/milestone/visible)만 타격.
 * 탭 생성 = ensureTodoTab 동일 패턴 (promise 캐시로 TOCTOU 직렬화).
 * §2.5 가드: append 는 A열 빈 행 + 그 행 FORMULA pre-read 로 raw 잔존 시 다음 행
 * 재탐색(company-info-archive findSafeEmptyRow 패턴). update 는 자기 키 행만.
 */
import { registry, SHEET_RANGES } from "@/config";
import { Notice, UpdateItem } from "@/types";
import { sheetsClient } from "./sheets-client";

const U = SHEET_RANGES.updates;
const N = SHEET_RANGES.notices;

const HEADERS: Record<string, string[]> = {
  [U.tab]: ["pr", "date", "type", "title_user", "body_md", "milestone", "visible"],
  [N.tab]: [
    "id", "created", "updated", "title", "body_md",
    "audience", "display_mode", "start", "end", "pinned", "active",
  ],
};

// ── 탭 자동 생성 (todos.ts ensureTodoTab 동일 패턴) ──────────────
let ensuring: Promise<void> | null = null;

export function ensureAnnouncementTabs(): Promise<void> {
  if (!ensuring) {
    ensuring = doEnsure().catch((e) => {
      ensuring = null;
      throw e;
    });
  }
  return ensuring;
}

async function doEnsure(): Promise<void> {
  const spreadsheetId = registry().spreadsheetId;
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""),
  );
  for (const tab of [U.tab, N.tab] as string[]) {
    if (existing.has(tab)) continue;
    try {
      await sheetsClient().spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
    } catch (e) {
      // 동시 생성 경합 — 이미 존재하면 무시
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already exists")) throw e;
    }
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS[tab]!] },
    });
  }
}

// ── read ─────────────────────────────────────────────────────────
const toBool = (v: unknown) => String(v ?? "").trim().toUpperCase() === "TRUE";
const toStr = (v: unknown) => String(v ?? "").trim();

async function readTab(tab: string, range: string): Promise<string[][]> {
  await ensureAnnouncementTabs();
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: registry().spreadsheetId,
    range: `'${tab}'!${range}`,
  });
  return (res.data.values ?? []) as string[][];
}

/** updates 전체 read → UpdateItem[] (pr 파싱 불가 행은 제외). */
export async function readUpdates(): Promise<UpdateItem[]> {
  const rows = await readTab(U.tab, U.range);
  const out: UpdateItem[] = [];
  for (const r of rows) {
    const pr = Number(toStr(r[0]));
    if (!Number.isInteger(pr) || pr <= 0) continue;
    out.push(
      UpdateItem.parse({
        pr,
        date: toStr(r[1]),
        type: toStr(r[2]),
        titleUser: toStr(r[3]),
        bodyMd: String(r[4] ?? ""),
        milestone: toStr(r[5]),
        visible: toBool(r[6]),
      }),
    );
  }
  return out;
}

/** notices 전체 read → Notice[] (id 없는 행·enum 불일치 행은 제외). */
export async function readNotices(): Promise<Notice[]> {
  const rows = await readTab(N.tab, N.range);
  const out: Notice[] = [];
  for (const r of rows) {
    const id = toStr(r[0]);
    if (!id) continue;
    const parsed = Notice.safeParse({
      id,
      created: toStr(r[1]),
      updated: toStr(r[2]),
      title: toStr(r[3]),
      bodyMd: String(r[4] ?? ""),
      audience: toStr(r[5]) || "all",
      displayMode: toStr(r[6]) || "once",
      start: toStr(r[7]),
      end: toStr(r[8]),
      pinned: toBool(r[9]),
      active: toBool(r[10]),
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

// ── admin 쓰기 (PR③) ─────────────────────────────────────────────
const noticeToRow = (n: Notice): (string | boolean)[] => [
  n.id, n.created, n.updated, n.title, n.bodyMd,
  n.audience, n.displayMode, n.start, n.end,
  n.pinned ? "TRUE" : "FALSE", n.active ? "TRUE" : "FALSE",
];

/** A열에서 키 행 탐색 (notices id / updates pr 공용) — 시트 행번호 반환. */
async function findKeyRow(tab: string, key: string): Promise<number | null> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: registry().spreadsheetId,
    range: `'${tab}'!A2:A`,
  });
  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (toStr(rows[i]?.[0]) === key) return i + 2;
  }
  return null;
}

/** §2.5 — A열 빈 행 후보를 FORMULA pre-read 로 raw 잔존 검사 후 확정. */
async function findSafeEmptyNoticeRow(): Promise<number> {
  const spreadsheetId = registry().spreadsheetId;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `'${N.tab}'!A2:A`,
  });
  const rows = res.data.values ?? [];
  let candidate = 2 + rows.length; // 기본: 마지막 다음 행
  for (let i = 0; i < rows.length; i++) {
    if (!toStr(rows[i]?.[0])) { candidate = i + 2; break; } // 중간 빈 행(클리어 행) 재사용
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const probe = await sheetsClient().spreadsheets.values.get({
      spreadsheetId,
      range: `'${N.tab}'!A${candidate}:K${candidate}`,
      valueRenderOption: "FORMULA",
    });
    const cells = probe.data.values?.[0] ?? [];
    const hasRaw = cells.some((c) => {
      const s = String(c ?? "").trim();
      return s !== "" && !s.startsWith("=");
    });
    if (!hasRaw) return candidate;
    candidate++;
  }
  throw new Error("notices 빈 행 탐색 실패 (§2.5 가드 10회 초과)");
}

/** 공지 upsert — 기존 id 행이면 그 행만 update, 없으면 §2.5 빈 행에 기록. */
export async function upsertNotice(n: Notice): Promise<{ row: number; created: boolean }> {
  await ensureAnnouncementTabs();
  const existing = await findKeyRow(N.tab, n.id);
  const row = existing ?? (await findSafeEmptyNoticeRow());
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: registry().spreadsheetId,
    range: `'${N.tab}'!A${row}:K${row}`,
    valueInputOption: "RAW",
    requestBody: { values: [noticeToRow(n)] },
  });
  return { row, created: existing === null };
}

export interface UpdatePatch {
  titleUser?: string;
  bodyMd?: string;
  milestone?: string;
  visible?: boolean;
}

/** 업데이트 행 보정 — pr 키 행의 전달된 필드 셀(D/E/F/G)만 개별 update. */
export async function patchUpdateRow(pr: number, patch: UpdatePatch): Promise<boolean> {
  await ensureAnnouncementTabs();
  const row = await findKeyRow(U.tab, String(pr));
  if (row === null) return false;
  const cells: { col: string; value: string }[] = [];
  if (patch.titleUser !== undefined) cells.push({ col: "D", value: patch.titleUser });
  if (patch.bodyMd !== undefined) cells.push({ col: "E", value: patch.bodyMd });
  if (patch.milestone !== undefined) cells.push({ col: "F", value: patch.milestone });
  if (patch.visible !== undefined)
    cells.push({ col: "G", value: patch.visible ? "TRUE" : "FALSE" });
  if (cells.length === 0) return true;
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: registry().spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: cells.map((c) => ({
        range: `'${U.tab}'!${c.col}${row}`,
        values: [[c.value]],
      })),
    },
  });
  return true;
}
