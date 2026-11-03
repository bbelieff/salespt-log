/** 「통화 정리 확인」 규칙 — 칸 상태·기본 체크, 업체 기준 연도로 매출 옮기기, 확정 본문. 가상 값만. */
import { expect, it } from "vitest";
import { CallExtraction } from "@/types/call";
import { CompanyInfo } from "@/types/meeting";
import { buildCiRows, confirmBlocker, confirmBody, missingQuestions, noteDraft, rebaseSales, timeOptions, type ConfirmState } from "@/app/(app)/db-sheet/_components/call-confirm-model";

const call = { calledAt: "2026-11-03T05:00:00Z" };
const x = CallExtraction.parse({
  answered: [1, 4, 11],
  company: { 과년도매출: "3,500", 금년도매출: "2,800", 매출기준연도: "2026", 신용점수: "780", 소재지: "합성시 새주소 1", 대표자이름: "김가상" },
  custom: { 필요자금: "300백만" },
  evidence: { 과년도매출: "상대: 작년에 35억", 신용점수: "상대: 780점", "custom.필요자금": "상대: 3억 필요" },
});

it("빈칸은 채우고 체크, 다른 지금 값은 해제, 같은 값은 체크 불가 — 민감 칸 표시", () => {
  const ci = CompanyInfo.parse({ 소재지: "합성시 옛주소", 대표자이름: "김 가상" });
  const { rows, baseYear } = buildCiRows(call, x, ci);
  expect(baseYear).toBe(2026);
  const by = Object.fromEntries(rows.map(r => [r.key, r]));
  expect(by.신용점수).toMatchObject({ status: "new", checked: true, sensitive: true, group: "대표자", evidence: "상대: 780점" });
  expect(by.소재지).toMatchObject({ status: "keep", checked: false, current: "합성시 옛주소" });
  expect(by.대표자이름).toMatchObject({ status: "same", checked: false });
  expect(by.필요자금).toMatchObject({ custom: true, group: "추가 칸", evidence: "상대: 3억 필요" });
  expect(by.과년도매출!.label).toContain("2025");
  expect(rows.some(r => r.key === "매출기준연도")).toBe(false);
});

it("업체 기준 연도가 2025 면 통화 연도 매출을 그 기준 칸으로 옮기고, 칸 밖 해는 뺀다", () => {
  expect(rebaseSales({ 과년도매출: "1", 금년도매출: "2", 신용점수: "3" }, 2026, 2025).company).toEqual({ 금년도매출: "1", 신용점수: "3" });
  expect(rebaseSales({ 금년도매출: "2" }, 2026, 2025).dropped).toEqual([2026]);
  const { rows, baseYear, dropped } = buildCiRows(call, x, CompanyInfo.parse({ 매출기준연도: "2025" }));
  expect(baseYear).toBe(2025);
  expect(dropped).toEqual([2026]);
  const sales = rows.find(r => r.key === "금년도매출")!;
  expect(sales).toMatchObject({ value: "3,500", evidence: "상대: 작년에 35억" });
  expect(sales.label).toContain("2025");
});

const state = (over: Partial<ConfirmState> = {}): ConfirmState => {
  const { rows, baseYear } = buildCiRows(call, x, CompanyInfo.parse({ 소재지: "합성시 옛주소" }));
  return { revision: 3, date: "2026-11-03", result: "", note: "메모", rows, baseYear, hasBaseYear: false, meetingOn: false,
    meeting: { meetingDate: "", time: "", place: "", reservationNote: "" }, lead: { company: "가상기계" }, ...over };
};

it("확정 본문: 체크한 칸만, 매출을 넣으면 기준 연도도(업체에 없을 때만), 미팅이면 결과는 컨택진행", () => {
  const b = confirmBody({ ...state(), result: "재통화" });
  expect(b.company).toEqual({ 과년도매출: "3,500", 금년도매출: "2,800", 신용점수: "780", 대표자이름: "김가상", 매출기준연도: "2026" });
  expect(b.custom).toEqual({ 필요자금: "300백만" });
  expect(b).toMatchObject({ revision: 3, result: "재통화", meeting: null, lead: { company: "가상기계" } });
  expect(confirmBody({ ...state(), hasBaseYear: true }).company.매출기준연도).toBeUndefined();
  const m = { meetingDate: "2026-11-11", time: "14:30", place: "공장", reservationNote: "" };
  expect(confirmBody({ ...state(), meetingOn: true, meeting: m })).toMatchObject({ result: "컨택진행", meeting: m });
});

it("막는 이유: 결과 없음, 미팅 날짜·시간·장소 빠짐", () => {
  expect(confirmBlocker(state())).toBe("컨택결과를 골라 주세요");
  expect(confirmBlocker(state({ result: "부재" }))).toBe("");
  expect(confirmBlocker(state({ meetingOn: true, meeting: { meetingDate: "2026-11-11", time: "", place: "", reservationNote: "" } }))).toBe("미팅 시간·장소를 정해 주세요");
  expect(confirmBlocker(state({ meetingOn: true, meeting: { meetingDate: "", time: "14:00", place: "공장", reservationNote: "" } }))).toBe("미팅 날짜를 정해 주세요");
});

it("빠진 질문·메모 초안·15분 시간", () => {
  expect(missingQuestions([1, 2, 3, 4, 5, 6, 7, 8, 11, 12])).toEqual([9, 10]);
  expect(noteDraft("옛 메모 ", "새 메모")).toBe("옛 메모\n\n새 메모");
  expect(noteDraft("", "새 메모")).toBe("새 메모");
  expect(timeOptions("")).toContain("14:45");
  expect(timeOptions("07:30")[0]).toBe("07:30");
});
