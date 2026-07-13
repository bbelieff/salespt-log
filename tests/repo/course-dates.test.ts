/**
 * O1/O2 날짜 쓰기 결정 (R3-5). §2.5 가드 + 원자적 쌍(O2=O1+50) 유지.
 * 리뷰 CONFIRMED 회귀: O1 보존 + O2 덮어쓰기로 O1↔O2 가 어긋나면 안 됨.
 */
import { describe, it, expect } from "vitest";
import { planCourseDateWrite } from "@/repo/course-dates";

const CELLS = { o1Cell: "O1", o2Cell: "O2", startISO: "2026-07-10", gradISO: "2026-08-29" };

describe("planCourseDateWrite (§2.5 가드 + 원자적 쌍)", () => {
  it("빈 시트(O1·O2 빈칸) → 둘 다 기록", () => {
    const p = planCourseDateWrite({ ...CELLS, o1Cur: "", o2Cur: "" });
    expect(p.writes).toEqual([
      { cell: "O1", value: "2026-07-10" },
      { cell: "O2", value: "2026-08-29" },
    ]);
    expect(p.preserved).toEqual([]);
  });

  it("O2 가 수식(=O1+50) → 덮어쓰기 허용(둘 다 기록)", () => {
    const p = planCourseDateWrite({ ...CELLS, o1Cur: "", o2Cur: "=O1+50" });
    expect(p.writes.map((w) => w.cell)).toEqual(["O1", "O2"]);
  });

  it("★O1 raw(사용자 날짜) → 둘 다 보존(O2만 덮어써 어긋나는 것 방지)", () => {
    const p = planCourseDateWrite({ ...CELLS, o1Cur: "2026-01-01", o2Cur: "" });
    expect(p.writes).toEqual([]);
    expect(p.preserved).toEqual(["O1", "O2"]);
  });

  it("★O1 raw + O2 legacy 수식(=O1+57) → 둘 다 보존", () => {
    const p = planCourseDateWrite({ ...CELLS, o1Cur: "2026-03-01", o2Cur: "=O1+57" });
    expect(p.writes).toEqual([]);
    expect(p.preserved).toEqual(["O1", "O2"]);
  });

  it("O2 가 raw(사용자 종강일) → 둘 다 보존", () => {
    const p = planCourseDateWrite({ ...CELLS, o1Cur: "", o2Cur: "2026-09-09" });
    expect(p.writes).toEqual([]);
  });

  it("start 빈값 → 무기록", () => {
    const p = planCourseDateWrite({ ...CELLS, startISO: "", o1Cur: "", o2Cur: "" });
    expect(p.writes).toEqual([]);
    expect(p.preserved).toEqual([]);
  });

  it("grad 빈값(O1만) → O1만 기록(O2 미접촉)", () => {
    const p = planCourseDateWrite({ ...CELLS, gradISO: "", o1Cur: "", o2Cur: "" });
    expect(p.writes).toEqual([{ cell: "O1", value: "2026-07-10" }]);
    expect(p.preserved).toEqual([]);
  });
});
