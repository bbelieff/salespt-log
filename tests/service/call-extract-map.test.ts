/**
 * 통화 정리 변환 — 0단계 정답지 15건(합성 c01~c12·실제 목소리 r01~r03, 모두 지어낸 업체)의 Gemini 원답을
 * 0단계 convert.py 와 똑같이 바꾸는지 고정 시험. 사례 파일은 convert.py 출력(받아쓰기 제외)을 CallExtraction 모양으로 옮긴 것.
 */
import { describe, expect, it } from "vitest";
import { mapCallExtraction, spokenWon } from "@/service/call-extract-map";
import { CALL_EXTRACT_CASES as cases } from "./call-extract.cases";

describe("0단계 정답지 — convert.py 와 같은 결과", () => {
  it("15건", () => expect(cases).toHaveLength(15));
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_, c) => {
    const { evidence, ...out } = mapCallExtraction(c.raw, c.callAt);
    expect(out).toEqual(c.expected);
    // 채운 칸마다 근거 문장이 있다
    for (const key of Object.keys(out.company)) if (key !== "매출기준연도") expect(evidence[key], key).toBeTruthy();
    for (const key of Object.keys(out.custom)) expect(evidence[`custom.${key}`], key).toBeTruthy();
    if (out.meeting) expect(evidence.meeting).toBeTruthy();
  });
});

const AT = "2026-10-30T01:05:00Z"; // 한국 2026-10-30(금) 10:05

it("말 금액 → 원: 한자 수사·억 뒤 천·단위 없는 숫자", () => {
  expect(spokenWon("십이억")).toBe(1_200_000_000);
  expect(spokenWon("4억 2천")).toBe(420_000_000);
  expect(spokenWon("7000")).toBe(70_000_000);
  expect(spokenWon("3년")).toBeNull();
  expect(spokenWon("")).toBeNull();
});

it("근거 문장 없는 답은 버리고, 자택주소·주민번호는 실리지 않는다", () => {
  const r = mapCallExtraction({
    q11_credit: { said: "820점", evidence: "" },
    q8_employees: { said: "다섯 명", evidence: "상대: 다섯 명이요" },
    자택주소지: { said: "어딘가", evidence: "x" },
  }, AT);
  expect(r.company).toEqual({ 사대보험직원: "5명" });
  expect(r.answered).toEqual([8]);
});

it("미팅: 요일이 어긋나면 날짜를 비우고, 사무실이면 주소를 붙인다", () => {
  const r = mapCallExtraction({
    address: { said: "서울 중구 세종대로 1번지", evidence: "e" },
    meeting: { date_said: "11월 3일 수요일", time_said: "두 시 반", place_said: "사무실", evidence: "e" },
  }, AT);
  expect(r.meeting).toEqual({ meetingDate: "", time: "14:30", place: "사무실(서울 중구 세종대로 1)", reservationNote: "" });
  const next = mapCallExtraction({ meeting: { date_said: "다음 주 월요일", time_said: "오전 11시 50분", place_said: "카페", evidence: "e" } }, AT);
  expect(next.meeting).toMatchObject({ meetingDate: "2026-11-02", time: "11:45" });
});
