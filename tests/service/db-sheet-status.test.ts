import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContractPayment } from "@/types/contract";
import { DbSheetLeadInput, DB_SHEET_MEETING_DELETED, DB_SHEET_MEETING_STAGE, type DbSheetLead } from "@/types/db-sheet";

const mocks = vi.hoisted(() => ({ contracts: vi.fn(), todos: vi.fn() }));
vi.mock("@/repo/db/read-daily", () => ({ readContractsFromDb: mocks.contracts, readTodosFromDb: mocks.todos }));
import { dbSheetFunnelStep, projectDbSheetWorkStatus } from "@/service/db-sheet-status";

const ctx = { spreadsheetId: "synthetic-owner", email: "synthetic@example.test", cohort: "연습" };
function lead(overrides: Partial<DbSheetLead> = {}): DbSheetLead {
  return { ...DbSheetLeadInput.parse({ id: "11111111-1111-4111-8111-111111111111", date: "2026-10-11", channel: "매입DB", company: "합성업체" }),
    revision: 1, result: "컨택진행", first: "2026-10-11", stage: "계약", meetingId: "root-meeting", ...overrides };
}
const contract = (values: Record<string, unknown> = {}) => ContractPayment.parse({ 업체명: "합성업체", 계약일: "2026-10-11", linkedMeetingId: "root-meeting", ...values });
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-11T03:00:00Z"));
  mocks.contracts.mockResolvedValue([]); mocks.todos.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

it("uses effective rescheduled meeting link without matching another company's contract", async () => {
  mocks.contracts.mockResolvedValue([
    contract({ linkedMeetingId: "child-meeting", 수납1: { 승인금액: 500 } }),
    contract({ linkedMeetingId: "unrelated-meeting", 수납1: { 수납액: 999 } }),
  ]);
  const [row] = await projectDbSheetWorkStatus(ctx, [lead({ effectiveMeetingId: "child-meeting" })]);
  expect(row!.stage).toBe("승인");
});
it("passes only the server-resolved tenant to both readers", async () => {
  const other = { ...ctx, spreadsheetId: "synthetic-other" };
  await projectDbSheetWorkStatus(other, [lead()]);
  expect(mocks.contracts).toHaveBeenCalledWith(other.spreadsheetId);
  expect(mocks.todos).toHaveBeenCalledWith(other.spreadsheetId);
  expect(mocks.contracts).not.toHaveBeenCalledWith(ctx.spreadsheetId);
});
it("keeps a middle-node contract visible after another follow-up meeting", async () => {
  mocks.contracts.mockResolvedValue([contract({ linkedMeetingId: "middle-meeting", 수납1: { 승인금액: 500 } })]);
  const rows = await projectDbSheetWorkStatus(ctx, [lead({ effectiveMeetingId: "latest-meeting", meetingLineageIds: ["root-meeting", "middle-meeting", "latest-meeting"] })]);
  expect(rows[0]!.stage).toBe("승인");
});
it("ignores unlinked contracts even if company and date happen to match", async () => {
  mocks.contracts.mockResolvedValue([contract({ linkedMeetingId: undefined, 수납1: { 수납액: 999 } })]);
  // Projection contract: every lead also carries the derived funnel step (meeting 상태 계약 → 계약).
  const original = lead(); expect((await projectDbSheetWorkStatus(ctx, [original]))[0]).toEqual({ ...original, funnel: "계약" });
});
it("keeps partial collection visible and deduplicates status across multiple slots", async () => {
  mocks.contracts.mockResolvedValue([contract({ 수납1: { 진행상품: "합성 진행" }, 수납2: { 수납액: 100 }, 수납3: { 진행상품: "또 다른 진행" } })]);
  expect((await projectDbSheetWorkStatus(ctx, [lead()]))[0]!.stage).toBe("진행 · 수납완료");
});
it("uses actual todo association and future collection date classifications", async () => {
  mocks.contracts.mockResolvedValue([contract({ 수납1: { 진행기관: "기관A" }, 수납2: { 수납일: "2026-10-12" } })]);
  mocks.todos.mockResolvedValue([{ contractRef: "2026-10-11|합성업체", institutionRef: "기관A" }]);
  expect((await projectDbSheetWorkStatus(ctx, [lead()]))[0]!.stage).toBe("진행 · 수납대기");
});
it("marks exclusively terminated/hidden contracts as terminated, preserving source info", async () => {
  mocks.contracts.mockResolvedValue([contract({ 해지일: "2026-10-11" }), contract({ 해지숨김: true })]);
  const row = (await projectDbSheetWorkStatus(ctx, [lead()]))[0];
  expect(row!.stage).toBe("계약해지"); expect(row!.company).toBe("합성업체"); expect(row!.first).toBe("2026-10-11");
});
it("ignores terminated slots while an active linked contract exists", async () => {
  mocks.contracts.mockResolvedValue([contract({ 해지일: "2026-10-11", 수납1: { 수납액: 500 } }), contract()]);
  expect((await projectDbSheetWorkStatus(ctx, [lead()]))[0]!.stage).toBe("진행대기");
});
it("does not query contracts or todos for an empty/unlinked list", async () => {
  expect(await projectDbSheetWorkStatus(ctx, [])).toEqual([]);
  // The early-return path still adds funnel (first set → 상담) without reading contracts/todos.
  const rows = [lead({ meetingId: null })]; expect(await projectDbSheetWorkStatus(ctx, rows)).toEqual(rows.map(row => ({ ...row, funnel: "상담" })));
  expect(mocks.contracts).not.toHaveBeenCalled(); expect(mocks.todos).not.toHaveBeenCalled();
});
it.each([
  ["untouched", { meetingId: null, stage: "미컨택", first: "", result: "미컨택" }, [], "유입"],
  ["absence only", { meetingId: null, stage: "미컨택", first: "", result: "부재" }, [], "연락"],
  ["simple refusal only", { meetingId: null, stage: "미컨택", first: "", result: "단순거절" }, [], "연락"],
  ["simple refusal with display date", { meetingId: null, stage: "미컨택", first: "2026-10-10", hasQualifiedContact: false, result: "단순거절" }, [], "연락"],
  ["recall with display date", { meetingId: null, stage: "미컨택", first: "2026-10-10", hasQualifiedContact: false, result: "재통화" }, [], "연락"],
  ["qualified history survives recall", { meetingId: null, stage: "상담 중", first: "2026-10-10", hasQualifiedContact: true, result: "재통화" }, [], "상담"],
  ["first consultation date", { meetingId: null, stage: "상담 중", first: "2026-10-10", result: "상담 후 거절" }, [], "상담"],
  ["meeting booked", { stage: "미팅예약" }, [], "미팅"],
  ["meeting rescheduled", { stage: "미팅변경" }, [], "미팅"],
  ["meeting done", { stage: "완료" }, [], "미팅"],
  ["meeting cancelled", { stage: "미팅취소" }, [], "상담"],
  ["meeting deleted", { stage: "미팅 삭제됨" }, [], "상담"],
  ["meeting 상태 계약 without a contract row", { stage: "계약" }, [], "계약"],
  ["active linked contract", { stage: "완료" }, [{}], "계약"],
  ["only terminated contracts", { stage: "계약" }, [{ 해지일: "2026-10-11" }], "미팅"],
  ["only hidden contracts", { stage: "계약" }, [{ 해지숨김: true }], "미팅"],
  ["terminated + active contracts", { stage: "계약" }, [{ 해지일: "2026-10-11" }, {}], "계약"],
] as const)("dbSheetFunnelStep: %s → %s", (_name, overrides, contracts, expected) => {
  expect(dbSheetFunnelStep(lead(overrides as Partial<DbSheetLead>), contracts.map(values => contract(values)))).toBe(expected);
});
it.each<[string, Partial<DbSheetLead>, string]>([
  ["effective child meeting", { effectiveMeetingId: "child-meeting" }, "child-meeting"],
  ["lineage middle meeting", { effectiveMeetingId: "latest-meeting", meetingLineageIds: ["root-meeting", "middle-meeting", "latest-meeting"] }, "middle-meeting"],
])("projects funnel from a contract linked via %s, before the stage is overwritten", async (_name, overrides, linkedMeetingId) => {
  mocks.contracts.mockResolvedValue([contract({ linkedMeetingId })]);
  const [row] = await projectDbSheetWorkStatus(ctx, [lead({ stage: "미팅변경", ...overrides })]);
  expect(row).toMatchObject({ stage: "진행대기", funnel: "계약" });
  mocks.contracts.mockResolvedValue([contract({ linkedMeetingId, 해지일: "2026-10-11" })]);
  const [terminated] = await projectDbSheetWorkStatus(ctx, [lead({ stage: "계약", ...overrides })]);
  expect(terminated).toMatchObject({ stage: "계약해지", funnel: "미팅" });
});
it("pins the shared meeting stage labels the funnel reads", () => {
  expect(DB_SHEET_MEETING_STAGE).toEqual({ 예약: "미팅예약", 변경: "미팅변경", 계약: "계약", 완료: "완료", 취소: "미팅취소" });
  expect(DB_SHEET_MEETING_DELETED).toBe("미팅 삭제됨");
});
it.each(["contracts", "todos"] as const)("does not silently report stale status when %s read fails", async reader => {
  mocks[reader].mockRejectedValue(new Error("synthetic read failure"));
  await expect(projectDbSheetWorkStatus(ctx, [lead()])).rejects.toThrow("synthetic read failure");
});
