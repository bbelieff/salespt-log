/** 컨택결과 규칙(2026-10-23 belie) — 화면 이름·현재상태·최초상담일·부재 다음 연락일·재통화 안내. 합성값. */
import { describe, expect, it } from "vitest";
import { autoDbSheetNextContact, dbSheetContactStage, dbSheetResultLabel, DB_SHEET_RESULTS, nextDbSheetFirstContact } from "@/types/db-sheet";
import { blank, needsRecallDate, outcomeDisplayLabel, outcomeLabel, recordContact } from "@/app/(app)/db-sheet/_components/model";
import { STATUS_FILTERS } from "@/app/(app)/db-sheet/_components/status-filter";

describe("result display labels (stored values unchanged)", () => {
  it("renames only the display text", () => {
    expect(dbSheetResultLabel("컨택진행")).toBe("미팅예약");
    expect(dbSheetResultLabel("상담 후 거절")).toBe("컨택 후 거절");
    expect(dbSheetResultLabel("AS예정")).toBe("AS신청");
    for (const v of ["미컨택", "부재", "단순거절", "재통화"]) expect(dbSheetResultLabel(v)).toBe(v);
    expect(DB_SHEET_RESULTS).toEqual(["미컨택", "부재", "단순거절", "재통화", "컨택진행", "상담 후 거절", "AS예정"]);
  });
  it("routes select options and filters through the same label", () => {
    expect(outcomeDisplayLabel).toBe(dbSheetResultLabel);
    expect(outcomeLabel("컨택진행")).toBe("미팅예약 · STEP 2 컨택진행 +1");
    expect(outcomeLabel("상담 후 거절")).toBe("컨택 후 거절 · STEP 2 컨택진행 +1");
    expect(STATUS_FILTERS.find(f => f.id === "progress")!.label).toBe("미팅예약·컨택 후 거절");
  });
});

describe("현재상태 from contact result", () => {
  const stage = (result: string, hasQualifiedContact = false, extra: { meetingId?: string | null; stage?: string } = {}) =>
    dbSheetContactStage({ stage: "미컨택", result, hasQualifiedContact, ...extra });
  it("maps refusal/recall to DB컨택중 and AS to 진행종료", () => {
    expect(stage("단순거절")).toBe("DB컨택중");
    expect(stage("재통화")).toBe("DB컨택중");
    expect(stage("AS예정")).toBe("진행종료");
    expect(stage("AS예정", true)).toBe("진행종료");
    expect(stage("부재")).toBe("미컨택");
    expect(stage("미컨택")).toBe("미컨택");
    expect(stage("컨택진행", true)).toBe("상담 중");
    expect(stage("재통화", true)).toBe("상담 중");
  });
  it("never touches meeting/contract stages", () => {
    expect(stage("재통화", false, { meetingId: "m1", stage: "미팅예약" })).toBe("미팅예약");
    expect(stage("AS예정", false, { stage: "실무진행" })).toBe("실무진행");
    expect(recordContact({ ...blank(), stage: "미팅예약" }, "단순거절", "2027-01-10").stage).toBe("미팅예약");
    expect(recordContact(blank(), "재통화", "2027-01-10").stage).toBe("DB컨택중");
    expect(recordContact(blank(), "AS예정", "2027-01-10").stage).toBe("진행종료");
  });
});

describe("최초상담일", () => {
  it("fills once for refusal/recall/consultation and keeps an existing date", () => {
    for (const r of ["단순거절", "재통화", "컨택진행", "상담 후 거절"]) expect(nextDbSheetFirstContact("", r, "2027-01-10")).toBe("2027-01-10");
    for (const r of ["미컨택", "부재", "AS예정"]) expect(nextDbSheetFirstContact("", r, "2027-01-10")).toBe("");
    expect(nextDbSheetFirstContact("2027-01-02", "재통화", "2027-01-10")).toBe("2027-01-02");
  });
});

describe("부재 다음 연락일", () => {
  it("sets tomorrow only when empty", () => {
    expect(autoDbSheetNextContact("부재", "", "2027-01-11")).toBe("2027-01-11");
    expect(autoDbSheetNextContact("부재", "2027-01-20", "2027-01-11")).toBe("2027-01-20");
    expect(autoDbSheetNextContact("재통화", "", "2027-01-11")).toBe("2027-01-11"); // 재통화도 자동(2026-10-25)
    for (const r of ["단순거절", "컨택진행", "미컨택"]) expect(autoDbSheetNextContact(r, "", "2027-01-11")).toBe("");
  });
});

describe("재통화 일정 안내", () => {
  it("shows only for 재통화 without a 다음 연락일", () => {
    expect(needsRecallDate({ result: "재통화", next: "" })).toBe(true);
    expect(needsRecallDate({ result: "재통화", next: "2027-01-12" })).toBe(false);
    expect(needsRecallDate({ result: "부재", next: "" })).toBe(false);
  });
});
