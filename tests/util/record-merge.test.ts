/** 두 기록 합치기 — 최근 쪽 기본, 칸별 선택, 빈 칸 채우기, 업체명 비교(contract-meeting-link). */
import { describe, expect, it } from "vitest";
import { findConflicts, mergeRecords, newerSide, sameCompanyName } from "@/util/record-merge";

describe("record-merge", () => {
  it("newerSide — 최근 저장 쪽, 모르면 실무/수납", () => {
    expect(newerSide("2026-09-01", "2026-09-02")).toBe("meeting");
    expect(newerSide("2026-09-03", "2026-09-02")).toBe("contract");
    expect(newerSide(null, "2026-09-02")).toBe("meeting");
    expect(newerSide(null, null)).toBe("contract");
  });

  it("빈 칸은 채우고, 다른 칸은 기본 쪽 — 칸별 선택이 이긴다", () => {
    const c = { 업태: "제조", 소재지: "", 신용점수: "800", 커스텀: { 업체: { A: "1" } } };
    const m = { 업태: "도매", 소재지: "서울", 신용점수: "900", 커스텀: { 업체: { B: "2" } } };
    expect(findConflicts(c, m, "meeting").map((f) => f.key).sort()).toEqual(["신용점수", "업태"]);
    expect(mergeRecords(c, m, "meeting", { 업태: "contract" })).toEqual({
      업태: "제조", 소재지: "서울", 신용점수: "900", 커스텀: { 업체: { A: "1", B: "2" } },
    });
  });

  it("sameCompanyName — (주)·띄어쓰기 무시, 한쪽이 다른 쪽을 품으면 같은 업체", () => {
    expect(sameCompanyName("(주)예시 상사", "예시상사")).toBe(true);
    expect(sameCompanyName("예시상사 본점", "예시상사")).toBe(true);
    expect(sameCompanyName("가나다", "라마바")).toBe(false);
    expect(sameCompanyName("", "라마바")).toBe(false);
  });
});
