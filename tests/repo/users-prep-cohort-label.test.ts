/**
 * 사전등록 기수 표시값 = 관리자 입력 기수 (2026-11-08 belie 「0기 코스텝이 8기로 보인다」 재발 방지).
 * 양식 시트 B3 잔재("8")가 I 캐시로 들어가면 수강생 목록이 8기 상자에 넣는다.
 */
import { describe, it, expect } from "vitest";
import { resolvePrepCohortLabel } from "@/repo/users-prep";

describe("resolvePrepCohortLabel", () => {
  it("숫자 기수인데 시트 B3 가 다르면 입력 기수 + 시트 B3 맞춤", () => {
    expect(resolvePrepCohortLabel("0", "8")).toEqual({ cohortLabel: "0", fixSheet: true });
    expect(resolvePrepCohortLabel("13기", "8")).toEqual({ cohortLabel: "13", fixSheet: true });
  });
  it("같으면 그대로(「기」 접미 무시)", () => {
    expect(resolvePrepCohortLabel("12", "12기")).toEqual({ cohortLabel: "12기", fixSheet: false });
  });
  it("시트 읽기 실패(빈 B3)는 건드리지 않는다", () => {
    expect(resolvePrepCohortLabel("0", "")).toEqual({ cohortLabel: "", fixSheet: false });
  });
  it("아레나 라벨은 시트 규칙 그대로", () => {
    expect(resolvePrepCohortLabel("A2-3", "A2-3기")).toEqual({ cohortLabel: "A2-3기", fixSheet: false });
    expect(resolvePrepCohortLabel("A2-3", "8")).toEqual({ cohortLabel: "8", fixSheet: false });
  });
});
