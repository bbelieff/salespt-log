/** 통화 정리 계약(call-summary PR-1) — 제외 칸은 실리지 않고, 미팅 초안은 15분 단위만 받는다. 가상 값만 쓴다. */
import { describe, expect, it } from "vitest";
import { CallExtraction, CallMeetingDraft, CallStatus, CALL_EXCLUDED_FIELDS } from "@/types/call";

describe("CallExtraction", () => {
  it("집 주소·주민번호는 업체정보 제안에서 빠진다", () => {
    const x = CallExtraction.parse({ company: { 신용점수: "860", 자택주소지: "가상시 가상동 1", 주민등록번호: "900101-1234567" } });
    expect(x.company.신용점수).toBe("860");
    for (const k of CALL_EXCLUDED_FIELDS) expect(k in x.company).toBe(false);
  });

  it("빈 정리는 기본값으로 채워지고 미팅은 null", () => {
    const x = CallExtraction.parse({});
    expect(x).toMatchObject({ summary: [], memo: "", answered: [], lead: {}, company: {}, custom: {}, meeting: null, evidence: {} });
  });

  it("요약은 3줄, 질문 번호는 1~12 만", () => {
    expect(() => CallExtraction.parse({ summary: ["a", "b", "c", "d"] })).toThrow();
    expect(() => CallExtraction.parse({ answered: [13] })).toThrow();
  });
});

describe("CallMeetingDraft", () => {
  it("시간은 15분 단위 HH:MM 또는 빈값(미정)", () => {
    expect(CallMeetingDraft.parse({ meetingDate: "2026-11-04", time: "10:00", place: "공장" }).time).toBe("10:00");
    expect(CallMeetingDraft.parse({ meetingDate: "2026-11-06" }).time).toBe("");
    expect(() => CallMeetingDraft.parse({ time: "14:10" })).toThrow();
  });

  it("예약비고는 500자까지", () => {
    expect(() => CallMeetingDraft.parse({ reservationNote: "가".repeat(501) })).toThrow();
  });
});

it("상태는 6가지", () => {
  expect(CallStatus.options).toEqual(["queued", "processing", "review", "confirmed", "failed", "discarded"]);
});
