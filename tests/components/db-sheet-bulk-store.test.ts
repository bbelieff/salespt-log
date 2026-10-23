/** 여러 줄 작업(2026-10-23 belie) — 유입 반영 일괄·삭제 10초 되돌리기·현재상태 직접 정하기. 가짜 전송·가짜 타이머, 합성값. */
import { describe, expect, it, vi } from "vitest";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import { createDbSheetStore, DELETE_UNDO_MS } from "@/app/(app)/db-sheet/_components/db-sheet-store";
import { bulkOutcomeText } from "@/app/(app)/db-sheet/_components/BulkBar";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
const lead = (i: number, over: Partial<DbSheetLead> = {}): DbSheetLead => ({
  ...DbSheetLeadInput.parse({ id: ids[i], supplier: "가상공급처", date: "2026-10-19", channel: "매입DB", company: `예시상사${i}`, owner: "가상", phone: `010-0000-000${i}` }),
  revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null, inflowStatus: { state: "recorded", date: "2026-10-19", channel: "매입DB", count: 1 }, ...over,
});
type Body = { action?: string; id?: string; inflow?: boolean; stage?: string };
function setup(rows: DbSheetLead[], respond: (body: Body) => unknown = () => ({})) {
  const timers: Array<{ fn: () => void; ms: number; live: boolean }> = [];
  const calls: Body[] = [];
  const transport = vi.fn(async (body?: Body) => {
    if (!body) return { leads: rows };
    calls.push(body);
    const custom = respond(body) as { leads?: DbSheetLead[]; impact?: unknown } | undefined;
    const row = rows.find((r) => r.id === body.id)!;
    if (body.action?.endsWith("-preview")) return { leads: [row], impact: { inflow: -1, contacts: 0, meetings: 0, rows: [] }, ...custom };
    if (body.action === "inflow") return { leads: [{ ...row, revision: row.revision + 1, inflowStatus: body.inflow ? row.inflowStatus : { state: "excluded", count: 0 } }] };
    if (body.action === "stage") return { leads: [{ ...row, revision: row.revision + 1, manualStage: body.stage, stage: body.stage }] };
    return { leads: [], ...custom };
  });
  const store = createDbSheetStore({
    transport: transport as never, invalidate: async () => {}, today: () => "2026-10-19", contactDraft: () => ({}) as never,
    setTimer: (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: (t) => { const x = timers[(t as unknown as number) - 1]; if (x) x.live = false; },
  });
  const fire = (ms: number) => timers.filter((t) => t.live && t.ms === ms).forEach((t) => { t.live = false; t.fn(); });
  return { store, calls, fire };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("bulk inflow", () => {
  it("previews then applies each changed row and skips rows already in that state", async () => {
    const rows = [lead(0), lead(1, { inflowStatus: { state: "excluded", count: 0 } })];
    const { store, calls } = setup(rows); store.load(); await settle();
    const out = await store.bulkInflow([ids[0]!, ids[1]!], false);
    expect(out).toEqual({ done: 1, unchanged: 1, blocked: [] });
    expect(calls.map((c) => `${c.action}:${c.id}`)).toEqual([`inflow-preview:${ids[0]}`, `inflow:${ids[0]}`]);
    expect(bulkOutcomeText("유입 미반영", out)).toBe("1건 유입 미반영 · 1건은 이미 유입 미반영돼 있어요");
  });
  it("reports blocked rows with the reason instead of applying them", async () => {
    const { store, calls } = setup([lead(0)], (b) => (b.action === "inflow-preview" ? { impact: { inflow: 0, contacts: 0, meetings: 0, rows: [], blockedReason: "해당 날짜의 유입 기록이 맞지 않아 변경할 수 없습니다." } } : undefined));
    store.load(); await settle();
    const out = await store.bulkInflow([ids[0]!], false);
    expect(out.blocked).toEqual([{ id: ids[0], company: "예시상사0", reason: "해당 날짜의 유입 기록이 맞지 않아 변경할 수 없습니다." }]);
    expect(calls.some((c) => c.action === "inflow")).toBe(false);
  });
});

describe("bulk delete with 10-second undo", () => {
  it("hides rows without deleting, and undo restores the exact same rows in place", async () => {
    const rows = [lead(0), lead(1), lead(2)];
    const { store, calls } = setup(rows); store.load(); await settle();
    const before = store.getState().leads;
    const out = await store.scheduleDelete([ids[0]!, ids[2]!]);
    expect(out.done).toBe(2);
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[1]]);
    expect(store.getState().deleting).toEqual({ count: 2, inflow: 2, contacts: 0, meetings: 0 });
    store.undoDelete();
    expect(store.getState().leads).toEqual(before);
    expect(store.getState().leads[0]).toBe(before[0]);
    expect(store.getState().deleting).toBeNull();
    expect(calls.every((c) => c.action === "delete-preview")).toBe(true);
  });
  it("commits the deletes when the 10 seconds pass", async () => {
    const { store, calls, fire } = setup([lead(0), lead(1)]); store.load(); await settle();
    await store.scheduleDelete([ids[0]!]);
    fire(DELETE_UNDO_MS); await settle(); await settle();
    expect(calls.filter((c) => c.action === "delete").map((c) => c.id)).toEqual([ids[0]]);
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[1]]);
  });
  it("leaving the page (flushAll) commits a pending delete; discard undoes it", async () => {
    const a = setup([lead(0), lead(1)]); a.store.load(); await settle();
    await a.store.scheduleDelete([ids[0]!]); await a.store.flushAll();
    expect(a.calls.filter((c) => c.action === "delete")).toHaveLength(1);
    const b = setup([lead(0), lead(1)]); b.store.load(); await settle();
    await b.store.scheduleDelete([ids[0]!]); b.store.discard();
    expect(b.calls.filter((c) => c.action === "delete")).toHaveLength(0);
    expect(b.store.getState().leads.map((r) => r.id)).toEqual([ids[0], ids[1]]);
  });
  it("keeps blocked rows visible and restores rows whose final delete fails", async () => {
    const { store, fire } = setup([lead(0), lead(1)], (b) => {
      if (b.action === "delete-preview" && b.id === ids[1]) return { impact: { inflow: 0, contacts: 0, meetings: 0, rows: [], blockedReason: "미팅이 남아 있어요. STEP 3에서 먼저 확인해 주세요." } };
      if (b.action === "delete") throw new Error("동시 수정");
      return undefined;
    });
    store.load(); await settle();
    const out = await store.scheduleDelete([ids[0]!, ids[1]!]);
    expect(out.blocked.map((x) => x.id)).toEqual([ids[1]]);
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[1]]);
    fire(DELETE_UNDO_MS); await settle(); await settle();
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[0], ids[1]]);
    expect(store.getState().notice).toContain("예시상사0 삭제를 확정하지 못해");
  });
});

it("sets a manual 현재상태 through the stage action", async () => {
  const { store, calls } = setup([lead(0)]); store.load(); await settle();
  await store.stage(ids[0]!, "장기관리");
  expect(calls.at(-1)).toMatchObject({ action: "stage", id: ids[0], stage: "장기관리" });
  expect(store.getState().leads[0]).toMatchObject({ stage: "장기관리", manualStage: "장기관리", revision: 2 });
});
