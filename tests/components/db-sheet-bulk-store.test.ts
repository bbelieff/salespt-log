/** 여러 줄 작업(2026-10-23 belie) — 유입 반영 일괄·삭제(2026-10-26 바로 휴지통)·공급처 바꾸기·현재상태 직접 정하기. 가짜 전송·가짜 타이머, 합성값. */
import { describe, expect, it, vi } from "vitest";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import { createDbSheetStore } from "@/app/(app)/db-sheet/_components/db-sheet-store";
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

describe("bulk delete goes straight to the trash (2026-10-26)", () => {
  it("previews, then deletes each row on the server right away — no hidden 10-second window", async () => {
    const rows = [lead(0), lead(1), lead(2)];
    const { store, calls } = setup(rows); store.load(); await settle();
    const out = await store.scheduleDelete([ids[0]!, ids[2]!]);
    expect(out.done).toBe(2);
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[1]]);
    expect(store.getState().deleting).toEqual({ count: 2, inflow: 2, contacts: 0, meetings: 0 });
    expect(calls.filter((c) => c.action === "delete").map((c) => c.id)).toEqual([ids[0], ids[2]]);
    store.undoDelete();
    expect(store.getState().deleting).toBeNull();
  });
  it("keeps blocked rows and rows whose delete fails, with the reason", async () => {
    const { store } = setup([lead(0), lead(1)], (b) => {
      if (b.action === "delete-preview" && b.id === ids[1]) return { impact: { inflow: 0, contacts: 0, meetings: 0, rows: [], blockedReason: "미팅이 남아 있어요. STEP 3에서 먼저 확인해 주세요." } };
      if (b.action === "delete") throw new Error("동시 수정");
      return undefined;
    });
    store.load(); await settle();
    const out = await store.scheduleDelete([ids[0]!, ids[1]!]);
    expect(out.done).toBe(0);
    expect(out.blocked.map((x) => x.id)).toEqual([ids[0], ids[1]]);
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[0], ids[1]]);
    expect(store.getState().deleting).toBeNull();
  });
  it("restores from the trash and puts the rows back in the list", async () => {
    const back = lead(0, { revision: 3 });
    const { store, calls } = setup([lead(1)], (b) => (b.action === "trash-restore" ? { leads: [back] } : undefined));
    store.load(); await settle();
    expect(await store.restoreTrash([ids[0]!])).toBe(1);
    expect(calls.at(-1)).toMatchObject({ action: "trash-restore", ids: [ids[0]] });
    expect(store.getState().leads.map((r) => r.id)).toEqual([ids[0], ids[1]]);
    await store.emptyTrash();
    expect(calls.at(-1)).toEqual({ action: "trash-empty" });
  });
});

describe("bulk supplier change (2026-10-26)", () => {
  it("changes channel and supplier, skips unchanged rows, never changes a meeting-linked row's channel", async () => {
    const rows = [lead(0, { supplier: "메타 광고", channel: "직접생산" }), lead(1), lead(2, { meetingId: "m1", channel: "직접생산", supplier: "메타 광고" })];
    const { store, calls } = setup(rows, (b) => (b.action === "save" ? { leads: [] } : undefined));
    store.load(); await settle();
    const out = await store.bulkSupplier([ids[0]!, ids[1]!, ids[2]!], { channel: "매입DB", supplier: "가상공급처" });
    expect(out.done).toBe(1);
    expect(out.unchanged).toBe(1);
    expect(out.blocked).toEqual([{ id: ids[2], company: "예시상사2", reason: "미팅이 연결돼 유형은 STEP 3 일정·계약에서 바꿔 주세요" }]);
    const saves = calls.filter((c) => c.action === "save") as unknown as { lead: { id: string; channel: string; supplier: string } }[];
    expect(saves.map((c) => [c.lead.id, c.lead.channel, c.lead.supplier])).toEqual([[ids[0], "매입DB", "가상공급처"], [ids[2], "직접생산", "가상공급처"]]);
  });
});

it("sets a manual 현재상태 through the stage action", async () => {
  const { store, calls } = setup([lead(0)]); store.load(); await settle();
  await store.stage(ids[0]!, "장기관리");
  expect(calls.at(-1)).toMatchObject({ action: "stage", id: ids[0], stage: "장기관리" });
  expect(store.getState().leads[0]).toMatchObject({ stage: "장기관리", manualStage: "장기관리", revision: 2 });
});
