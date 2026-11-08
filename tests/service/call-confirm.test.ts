/** 통화 정리 확정 — DB관리시트 명령(save → contact → meeting)을 순서대로, 두 번 눌러도 한 번, 실패하면 잠금을 푼다. 가상 값만. */
import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getCall: vi.fn(), lockConfirmCall: vi.fn(), unlockConfirmCall: vi.fn() }));
const sheet = vi.hoisted(() => ({ loadDbSheet: vi.fn(), executeDbSheet: vi.fn() }));
vi.mock("@/repo/db/call-records", async (orig) => ({ ...(await orig<typeof import("@/repo/db/call-records")>()), ...db }));
vi.mock("@/service/db-sheet", () => sheet);
vi.mock("@/repo/db/db-sheet", () => ({
  DbSheetConflict: class extends Error { constructor() { super("DB_SHEET_CONFLICT"); } },
  DbSheetDuplicate: class extends Error {}, DbSheetLinkedMeetingReadOnly: class extends Error {}, DbSheetOperationBlocked: class extends Error {},
}));

import { DbSheetConflict } from "@/repo/db/db-sheet";
import { DbSheetLeadInput } from "@/types/db-sheet";
import { confirmCall } from "@/service/call-confirm";

const ctx = { email: "caller@example.test", spreadsheetId: "sheet-synthetic", cohort: "연습" };
const ID = "00000000-0000-4000-8000-000000000001";
const LEAD = "00000000-0000-4000-8000-000000000002";
const lead = {
  ...DbSheetLeadInput.parse({
    id: LEAD, date: "2026-11-01", channel: "매입DB", company: "", owner: "기존대표",
    contact: { ci: { 신용점수: "700", 업종주생산품목: "기존 업종", 커스텀: { 업체: { 기존칸: "x" } } }, note: "옛 메모" },
  }),
  revision: 4,
};
const body = {
  revision: 4, date: "2026-11-03", result: "컨택진행", note: "옛 메모\n작년 매출 12억",
  company: { 과년도매출: "1,200", 신용점수: "820", 주민등록번호: "000000-0000000", 자택주소지: "집" },
  custom: { 필요자금: "500백만" }, lead: { company: "합성정밀", owner: "다른이름" },
  meeting: { meetingDate: "2026-11-11", time: "14:30", place: "공장(합성 주소)", reservationNote: "" },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALL_SUMMARY_EMAILS", "caller@example.test");
  db.getCall.mockResolvedValue({ id: ID, leadId: LEAD, status: "review" });
  db.lockConfirmCall.mockResolvedValue(true);
  sheet.loadDbSheet.mockResolvedValue([lead]);
  let rev = 4;
  sheet.executeDbSheet.mockImplementation(async () => ({ leads: [{ id: LEAD, revision: ++rev }] }));
});

it("save → meeting → contact 을 이어진 revision 으로(미팅 먼저 = STEP 3 보장), 업체정보는 덮되 다른 칸은 보존", async () => {
  expect(await confirmCall(ctx, ID, body)).toEqual({ lead: { id: LEAD, revision: 7 } });
  const [save, meeting, contact] = sheet.executeDbSheet.mock.calls.map(c => c[1]);
  expect(save).toMatchObject({ action: "save", revision: 4 });
  expect(save.lead.company).toBe("합성정밀");
  expect(save.lead.owner).toBe("기존대표");
  expect(save.lead.contact.ci).toMatchObject({ 과년도매출: "1,200", 신용점수: "820", 업종주생산품목: "기존 업종", 주민등록번호: "", 자택주소지: "" });
  expect(save.lead.contact.ci.커스텀).toEqual({ 업체: { 기존칸: "x", 필요자금: "500백만" } });
  expect(save.lead.contact).toMatchObject({ date: "2026-11-03", meetingDate: "2026-11-11", time: "14:30", place: "공장(합성 주소)" });
  expect(meeting).toEqual({ action: "meeting", id: LEAD, revision: 5, place: "공장(합성 주소)" });
  expect(contact).toEqual({ action: "contact", id: LEAD, revision: 6, date: "2026-11-03", result: "컨택진행", note: body.note });
  expect(db.unlockConfirmCall).not.toHaveBeenCalled();
});

it("미팅 없이 미팅예약은 저장하지 않는다(STEP 3 누락 방지, 2026-11-08)", async () => {
  await expect(confirmCall(ctx, ID, { ...body, result: "컨택진행", meeting: null })).rejects.toThrow("미팅예약은 미팅 날짜·시간");
  expect(sheet.executeDbSheet).not.toHaveBeenCalled();
});

it("미팅 없이 확정하면 미팅카드를 만들지 않는다", async () => {
  await confirmCall(ctx, ID, { ...body, result: "재통화", meeting: null });
  expect(sheet.executeDbSheet.mock.calls.map(c => c[1].action)).toEqual(["save", "contact"]);
});

it("미팅은 날짜·시간이 있어야 하고 결과는 미팅예약(컨택진행)", async () => {
  await expect(confirmCall(ctx, ID, { ...body, meeting: { ...body.meeting, time: "" } })).rejects.toMatchObject({ status: 400 });
  await expect(confirmCall(ctx, ID, { ...body, result: "재통화" })).rejects.toMatchObject({ status: 400 });
  expect(db.lockConfirmCall).not.toHaveBeenCalled();
});

it("이미 확정했으면 다시 쓰지 않는다(동시에 두 번 눌러도)", async () => {
  db.getCall.mockResolvedValue({ id: ID, leadId: LEAD, status: "confirmed" });
  expect(await confirmCall(ctx, ID, body)).toEqual({ already: true });
  db.getCall.mockResolvedValueOnce({ id: ID, leadId: LEAD, status: "review" });
  db.lockConfirmCall.mockResolvedValue(false);
  expect(await confirmCall(ctx, ID, body)).toEqual({ already: true });
  expect(sheet.executeDbSheet).not.toHaveBeenCalled();
});

it("그사이 DB 가 바뀌었거나 저장이 실패하면 확인 대기로 되돌린다", async () => {
  await expect(confirmCall(ctx, ID, { ...body, revision: 3 })).rejects.toBeInstanceOf(DbSheetConflict);
  expect(db.unlockConfirmCall).toHaveBeenCalledWith(ID);
  expect(sheet.executeDbSheet).not.toHaveBeenCalled();
  sheet.executeDbSheet.mockRejectedValueOnce(new Error("save failed"));
  await expect(confirmCall(ctx, ID, body)).rejects.toThrow("save failed");
  expect(db.unlockConfirmCall).toHaveBeenCalledTimes(2);
});

it("스위치 밖·없는 통화·확인 대기가 아닌 통화", async () => {
  vi.stubEnv("CALL_SUMMARY_EMAILS", "");
  await expect(confirmCall(ctx, ID, body)).rejects.toMatchObject({ status: 404 });
  vi.stubEnv("CALL_SUMMARY_EMAILS", "caller@example.test");
  db.getCall.mockResolvedValue(null);
  await expect(confirmCall(ctx, ID, body)).rejects.toMatchObject({ status: 404 });
  db.getCall.mockResolvedValue({ id: ID, leadId: LEAD, status: "processing" });
  db.lockConfirmCall.mockResolvedValue(false);
  await expect(confirmCall(ctx, ID, body)).rejects.toMatchObject({ status: 409 });
});
