/** DB 시트 자동 확인 저장소·매시간 실행(0016 + service) — 가상 이메일·가상 시트만. 내려받기·DB관리시트 저장은 흉내. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: null as unknown,
  csv: "" as string,
  fail: null as Error | null,
  leads: [] as { company: string; phone: string; biz: string }[],
  imported: [] as { recording?: { inflow: boolean } ; company: string }[][],
  pushes: [] as [string, number, string][],
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => h.db }));
vi.mock("@/repo/google-sheet-export", () => ({
  GoogleSheetImportError: class extends Error {},
  fetchGoogleSheetCsv: async () => { if (h.fail) throw h.fail; return h.csv; },
}));
vi.mock("@/repo/db/db-sheet", () => ({ listDbSheet: async () => h.leads, listDbSheetTrash: async () => [] }));
vi.mock("@/service/db-sheet", () => ({
  DbSheetUnavailable: class extends Error {},
  resolveDbSheetContext: async (email: string) => ({ email, spreadsheetId: "sheet-a", cohort: "12기" }),
  executeDbSheet: async (_ctx: unknown, cmd: { leads: { id: string; company: string; phone: string; biz: string; recording?: { inflow: boolean } }[] }) => {
    h.imported.push(cmd.leads); h.leads.push(...cmd.leads);
    return { leads: cmd.leads.map((l) => ({ id: l.id })) };
  },
}));
vi.mock("@/service/push", () => ({ sendDbFeedPush: async (email: string, added: number, slot: string) => { h.pushes.push([email, added, slot]); return true; } }));

import { connectDbSheetFeed, dispatchDbSheetFeeds, listDbSheetFeeds, answerDbSheetFeedInflow, setDbSheetFeedEnabled, removeDbSheetFeed } from "@/service/db-sheet-feed";

const ctx = { email: "a@example.test", spreadsheetId: "sheet-a", cohort: "12기" };
const URL_A = "https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAA/edit?usp=sharing";
const HEAD = "업체명,이름,연락처,접수일시,메모";
const at = (hhmm: string) => new Date(`2026-11-06T${hhmm}:00+09:00`);

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  const sql = readFileSync("lib/repo/db/migrations/0016_db_sheet_feeds.sql", "utf8");
  await db.exec(sql); await db.exec(sql);
  h.db = db;
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("delete from public.db_sheet_feeds"); h.leads = []; h.imported = []; h.pushes = []; h.fail = null; });

describe("연결", () => {
  it("연결 때 시트에 있던 줄은 들어오지 않고, 그 뒤 붙은 줄만 매시간 들어온다(유입 반영 안 함)", async () => {
    h.csv = [HEAD, "가상상회,김가상,010-0000-1001,2026-11-05,"].join("\n");
    const feed = await connectDbSheetFeed(ctx, { url: URL_A, supplier: "애드프로", channel: "매입DB", rules: {} });
    expect(feed).toMatchObject({ supplier: "애드프로", enabled: true, sheetUrl: "https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAA/edit" });
    h.csv += "\n가상꽃집,이가상,010-0000-1002,2026-11-06,";
    const stats = await dispatchDbSheetFeeds(at("09:00"));
    expect(stats).toMatchObject({ slot: "2026-11-06 09", checked: 1, added: 1 });
    expect(h.imported.flat().map((l) => [l.company, l.recording?.inflow])).toEqual([["가상꽃집", false]]);
    expect(h.pushes).toEqual([["a@example.test", 1, "2026-11-06 09"]]);
    const [view] = await listDbSheetFeeds(ctx);
    expect(view!.pendingInflow).toHaveLength(1);
    expect(view!.lastAdded).toBe(1);
  });
  it("같은 시각 칸에 두 번 불려도 한 번만, 다음 시각엔 새 줄이 없으면 알림 없음", async () => {
    h.csv = [HEAD, "가상상회,김가상,010-0000-1001,2026-11-05,"].join("\n");
    await connectDbSheetFeed(ctx, { url: URL_A, supplier: "애드프로", channel: "매입DB", rules: {} });
    h.csv += "\n가상꽃집,이가상,010-0000-1002,2026-11-06,";
    await dispatchDbSheetFeeds(at("10:00"));
    expect((await dispatchDbSheetFeeds(at("10:15"))).checked).toBe(0);
    expect((await dispatchDbSheetFeeds(at("11:00"))).checked).toBe(1);
    expect(h.imported).toHaveLength(1);
    expect(h.pushes).toHaveLength(1);
  });
  it("22시~다음 날 07시 전에는 확인하지 않는다", async () => {
    h.csv = HEAD + "\n가상상회,김가상,010-0000-1001,2026-11-05,";
    await connectDbSheetFeed(ctx, { url: URL_A, supplier: "애드프로", channel: "매입DB", rules: {} });
    expect(await dispatchDbSheetFeeds(at("22:00"))).toMatchObject({ slot: null, due: 0 });
  });
  it("3번 연속 실패하면 멈추고, 다시 켜면 이어서 확인", async () => {
    h.csv = HEAD + "\n가상상회,김가상,010-0000-1001,2026-11-05,";
    const feed = await connectDbSheetFeed(ctx, { url: URL_A, supplier: "애드프로", channel: "매입DB", rules: {} });
    h.fail = new Error("network");
    for (const t of ["07:00", "08:00", "09:00"]) await dispatchDbSheetFeeds(at(t));
    let [view] = await listDbSheetFeeds(ctx);
    expect(view).toMatchObject({ enabled: false });
    expect(view!.lastError).toBeTruthy();
    expect((await dispatchDbSheetFeeds(at("10:00"))).due).toBe(0);
    h.fail = null;
    await setDbSheetFeedEnabled(ctx, feed.id, true);
    [view] = await listDbSheetFeeds(ctx);
    expect(view).toMatchObject({ enabled: true, lastError: null });
  });
  it("팝업에 답한 DB는 다시 묻지 않고, 해제는 내 시트 연결만", async () => {
    h.csv = HEAD;
    const feed = await connectDbSheetFeed(ctx, { url: URL_A, supplier: "애드프로", channel: "매입DB", rules: {} });
    h.csv = [HEAD, "가상꽃집,이가상,010-0000-1002,2026-11-06,"].join("\n");
    await dispatchDbSheetFeeds(at("12:00"));
    const [view] = await listDbSheetFeeds(ctx);
    await answerDbSheetFeedInflow(ctx, view!.pendingInflow);
    expect((await listDbSheetFeeds(ctx))[0]!.pendingInflow).toEqual([]);
    await expect(removeDbSheetFeed({ ...ctx, spreadsheetId: "sheet-b" }, feed.id)).rejects.toThrow();
    await removeDbSheetFeed(ctx, feed.id);
    expect(await listDbSheetFeeds(ctx)).toEqual([]);
  });
  it("구글시트 주소가 아니거나 공급처가 비면 연결하지 않는다", async () => {
    await expect(connectDbSheetFeed(ctx, { url: "https://example.com/x", supplier: "애드프로", channel: "매입DB", rules: {} })).rejects.toThrow(/구글시트/);
    await expect(connectDbSheetFeed(ctx, { url: URL_A, supplier: " ", channel: "매입DB", rules: {} })).rejects.toThrow(/공급처/);
  });
});
