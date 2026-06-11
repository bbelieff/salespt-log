/**
 * Layer: repo — 레지스트리 `updates`·`notices` 탭 (새소식, announcement-popup §1).
 *
 * 개인 시트가 아니라 SHEETS_REGISTRY_ID 의 탭 2개:
 *   updates (A~G) — 배포 시 scripts/append-updates.mjs 자동 append (코드 밖, 멱등).
 *   notices (A~K) — 운영자 공지 (admin 팝업관리가 작성 — PR③ admin-popup-mgmt).
 *
 * 이 모듈은 read + 탭 자동 생성만 담당 (PR① announcement-backend 범위).
 * 탭 생성 = ensureTodoTab 동일 패턴 (promise 캐시로 TOCTOU 직렬화).
 * §2.5 가드: 이 파일의 쓰기는 빈 탭 헤더 1행뿐 — 기존 셀 비접촉.
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
