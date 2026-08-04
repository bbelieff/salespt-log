/**
 * 기수 날짜 계산 (R3-5). ADR-0005: 종강 = 수강시작 + 50일(7기+).
 */
import { describe, it, expect } from "vitest";
import {
  computeGraduationISO,
  isValidISODate,
  GRADUATION_OFFSET_DAYS,
  resolveCourseStartInput,
  classifyCourseDateOutcome,
  needsSheetReadback,
} from "@/service/cohort-dates";

describe("isValidISODate", () => {
  it("유효 ISO 날짜만 true", () => {
    expect(isValidISODate("2026-07-10")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false); // 2026 평년 — 2/29 없음
    expect(isValidISODate("2024-02-29")).toBe(true); // 윤년
    expect(isValidISODate("2026-13-01")).toBe(false); // 월 오류
    expect(isValidISODate("2026-07-32")).toBe(false); // 일 오류
    expect(isValidISODate("2026-7-10")).toBe(false); // zero-pad 필요
    expect(isValidISODate("")).toBe(false);
    expect(isValidISODate("2026/07/10")).toBe(false);
  });
});

describe("computeGraduationISO (+50일, ADR-0005)", () => {
  it("기본 offset=50 — 월 넘김 산술 정확", () => {
    // 07-10 + 50일 = 08-29 (finalize-cohort9 목표값과 일치)
    expect(computeGraduationISO("2026-07-10")).toBe("2026-08-29");
    expect(GRADUATION_OFFSET_DAYS).toBe(50);
  });
  it("연말 넘김", () => {
    expect(computeGraduationISO("2026-12-01")).toBe("2027-01-20"); // 12-01 +30=12-31 +20=01-20
  });
  it("윤년 2월 통과", () => {
    // 2024-01-20 + 50 = 03-10 (1월 남11 + 2월 29 + 3월 10 = 50)
    expect(computeGraduationISO("2024-01-20")).toBe("2024-03-10");
  });
  it("legacy offset=57 도 지원(6기 이하)", () => {
    expect(computeGraduationISO("2026-07-10", 57)).toBe("2026-09-05");
  });
  it("잘못된 입력 → 빈 문자열", () => {
    expect(computeGraduationISO("")).toBe("");
    expect(computeGraduationISO("2026-13-01")).toBe("");
    expect(computeGraduationISO("아무거나")).toBe("");
  });
});

// ── 사고 2회 회귀 (연습용2 · 10기 6명) ────────────────────────────────────────
// 자동화가 date input 의 DOM value 를 직접 세팅하면 React onChange 가 안 뜨고 state 는 빈 채로
// 제출된다 → 서버가 "날짜 없음" 경로를 타 템플릿(이전 기수) 날짜가 새 시트에 그대로 남는다.
describe("resolveCourseStartInput (제출 시 ref 폴백)", () => {
  it("state 에 값이 있으면 state 우선 — 사람이 고른 값이 정본", () => {
    expect(resolveCourseStartInput("2026-08-07", "2026-06-12")).toBe("2026-08-07");
  });

  it("★state 가 비고 DOM 에만 값이 있으면 DOM 폴백 (자동화·자동완성)", () => {
    expect(resolveCourseStartInput("", "2026-08-07")).toBe("2026-08-07");
  });

  it("둘 다 비면 빈 문자열 — 호출부가 '날짜 없음'으로 확인 게이트를 띄운다", () => {
    expect(resolveCourseStartInput("", "")).toBe("");
    expect(resolveCourseStartInput("   ", "  ")).toBe("");
  });

  it("공백은 잘라내고, 형식 검증은 하지 않는다(서버 400 이 정본)", () => {
    expect(resolveCourseStartInput(" 2026-08-07 ", "")).toBe("2026-08-07");
    expect(resolveCourseStartInput("", "2026-13-45")).toBe("2026-13-45");
  });

  it("null/undefined 가 들어와도 터지지 않는다", () => {
    expect(
      resolveCourseStartInput(
        undefined as unknown as string,
        null as unknown as string,
      ),
    ).toBe("");
  });
});

describe("classifyCourseDateOutcome / needsSheetReadback (결과 가시화)", () => {
  it("입력 있고 O1/O2 기록됨 → written (정상, 추가 시트 read 없음)", () => {
    const s = classifyCourseDateOutcome({
      courseStartISO: "2026-08-07",
      written: ["O1", "O2"],
    });
    expect(s).toBe("written");
    expect(needsSheetReadback(s)).toBe(false);
  });

  it("★날짜 미입력 → no_input + 실측 readback 필요 (사고 2회의 그 경로)", () => {
    const s = classifyCourseDateOutcome({ courseStartISO: "", written: [] });
    expect(s).toBe("no_input");
    expect(needsSheetReadback(s)).toBe(true);
  });

  it("입력은 왔는데 아무것도 안 써짐 → preserved + readback 필요", () => {
    const s = classifyCourseDateOutcome({
      courseStartISO: "2026-08-07",
      written: [],
    });
    expect(s).toBe("preserved");
    expect(needsSheetReadback(s)).toBe(true);
  });

  it("예외는 입력 유무보다 우선 → error + readback 필요", () => {
    const s = classifyCourseDateOutcome({
      courseStartISO: "",
      written: [],
      error: "PERMISSION_DENIED",
    });
    expect(s).toBe("error");
    expect(needsSheetReadback(s)).toBe(true);
  });
});
