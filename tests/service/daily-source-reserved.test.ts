/**
 * 유보 수강생의 저장 위치(2026-10-06): 유보는 명단 숨김 표시라 원래 기수로 DB/시트를 고른다.
 * 0기(관리자 시험 계정 GM)는 처음부터 DB 정본.
 */
import { describe, expect, it } from "vitest";
import { chooseDailySource, chooseWriteSource, isDbReadPilot, sourceCohort } from "@/service/daily-source";

describe("sourceCohort", () => {
  it("유보면 원래 기수(cohortLabel)", () => {
    expect(sourceCohort({ cohort: "유보", cohortLabel: "11" })).toBe("11");
    expect(chooseDailySource(sourceCohort({ cohort: "유보", cohortLabel: "11" }), true)).toBe("db");
    expect(chooseWriteSource(sourceCohort({ cohort: "유보", cohortLabel: "0" }), true)).toBe("db");
  });
  it("유보가 아니면 그대로 — 다른 수강생은 바뀌지 않는다", () => {
    expect(sourceCohort({ cohort: "5", cohortLabel: "11" })).toBe("5");
    expect(sourceCohort({ cohort: "A2-6기", cohortLabel: "" })).toBe("A2-6기");
  });
  it("원래 기수를 모르면 유보 그대로(시트 경로 — 예전과 같음)", () => {
    expect(sourceCohort({ cohort: "유보", cohortLabel: "" })).toBe("유보");
    expect(sourceCohort({ cohort: "유보" })).toBe("유보");
  });
  it("0기는 DB 정본", () => {
    expect(isDbReadPilot("0")).toBe(true);
    expect(isDbReadPilot("0기")).toBe(true);
    expect(isDbReadPilot("5")).toBe(false);
  });
});
