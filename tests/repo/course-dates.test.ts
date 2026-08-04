/**
 * O1/O2 날짜 쓰기 결정 (R3-5). §2.5 가드 + 원자적 쌍(O2=O1+50) 유지.
 * 리뷰 CONFIRMED 회귀: O1 보존 + O2 덮어쓰기로 O1↔O2 가 어긋나면 안 됨.
 */
import { describe, it, expect } from "vitest";
import { planCourseDateWrite, parseCourseDateCells } from "@/repo/course-dates";

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

  // ── allowTemplateOverwrite (AR-2b 개막 안전) ────────────────────────────
  // 갓 복제한 시트에는 **템플릿에서 딸려온 이전 기수 날짜**가 들어있다. 그걸 보존하면 새 기수의
  // 주차 앵커가 어긋나 대시보드 1~8주 표에서 통째로 빠진다(전광판 전원 0.0). 호출부가 "방금
  // copyTemplateSheet 로 만든 빈 시트"임을 보증할 때만 켠다 — 재사용 시트에는 절대 쓰지 않는다.
  it("★allowTemplateOverwrite: 템플릿 잔재 날짜(raw)를 덮어쓴다", () => {
    const p = planCourseDateWrite({
      ...CELLS,
      o1Cur: "2026-06-12", // 이전 시즌 개강일이 복제본에 남아있는 상태
      o2Cur: "2026-08-01",
      allowTemplateOverwrite: true,
    });
    expect(p.writes).toEqual([
      { cell: "O1", value: "2026-07-10" },
      { cell: "O2", value: "2026-08-29" },
    ]);
    expect(p.preserved).toEqual([]);
  });

  it("allowTemplateOverwrite 없으면 기존대로 보존 — 기본 동작 불변(§2.5)", () => {
    const p = planCourseDateWrite({ ...CELLS, o1Cur: "2026-06-12", o2Cur: "2026-08-01" });
    expect(p.writes).toEqual([]);
    expect(p.preserved).toEqual(["O1", "O2"]);
  });

  it("allowTemplateOverwrite 여도 start 빈값이면 무기록", () => {
    const p = planCourseDateWrite({
      ...CELLS,
      startISO: "",
      o1Cur: "2026-06-12",
      o2Cur: "2026-08-01",
      allowTemplateOverwrite: true,
    });
    expect(p.writes).toEqual([]);
  });
});

// 생성 리포트용 실측 readback — "날짜가 안 들어갔다"를 화면에서 즉시 보이게 하는 입력.
describe("parseCourseDateCells (O1·O2·B3:C3 batchGet → 셀 문자열)", () => {
  it("★템플릿 잔재 그대로 노출 — O2 는 계산값이 아니라 수식으로 보여야 한다", () => {
    expect(
      parseCourseDateCells([
        { values: [["2026-06-12"]] },
        { values: [["=O1+50"]] },
        { values: [["8", "김믿음"]] },
      ]),
    ).toEqual({ o1: "2026-06-12", o2: "=O1+50", b3: "8", c3: "김믿음" });
  });

  it("빈 셀·없는 range 는 빈 문자열", () => {
    expect(parseCourseDateCells([{ values: [[""]] }, {}, { values: [["10"]] }])).toEqual({
      o1: "",
      o2: "",
      b3: "10",
      c3: "",
    });
    expect(parseCourseDateCells(undefined)).toEqual({ o1: "", o2: "", b3: "", c3: "" });
  });

  it("숫자·null 도 문자열로 정규화하고 공백은 자른다", () => {
    expect(
      parseCourseDateCells([
        { values: [[45815]] },
        { values: null },
        { values: [[10, "  김도연  "]] },
      ]),
    ).toEqual({ o1: "45815", o2: "", b3: "10", c3: "김도연" });
  });
});
