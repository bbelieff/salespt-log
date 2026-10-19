/** 구조 개선 ② — 「DB 로 읽고 쓰나」는 수강생을 넘기면 한 곳에서 판단(유보 보정 포함). 합성값. */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true }));
import { chooseDailySource, chooseWriteSource, usesDbStorage } from "@/service/daily-source";

describe("usesDbStorage", () => {
  it("유보로 숨긴 DB 기수 수강생도 DB(전에는 일부 화면이 시트로 갔다)", () => {
    expect(usesDbStorage({ cohort: "유보", cohortLabel: "11" })).toBe(true);
    expect(usesDbStorage({ cohort: "", cohortLabel: "0" })).toBe(true);
  });
  it("이미 고른 기수 문자열도 받는다", () => {
    expect(usesDbStorage("11")).toBe(true);
    expect(usesDbStorage("3")).toBe(false);
  });
  it("운영 스위치가 꺼지면 시트", () => {
    expect(usesDbStorage({ cohort: "11" }, false)).toBe(false);
  });
  it("읽기·쓰기 판정은 같은 함수(롤백 레버 하나)", () => {
    expect(chooseWriteSource).toBe(chooseDailySource);
  });
});
