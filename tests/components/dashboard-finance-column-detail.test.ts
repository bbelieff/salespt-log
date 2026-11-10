/** 대시보드 매출·비용·영업이익(2026-11-11 belie): 제목 글자 없음 · 세 칸 균등 · 누른 칸 바로 아래에만 상세 · 직접 설정 안내 문장 없음. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boxes = readFileSync("components/dashboard/FinanceSummaryBoxes.tsx", "utf8");
const finance = readFileSync("components/dashboard/DashboardFinance.tsx", "utf8");

describe("대시보드 재무 세 칸", () => {
  it("기간 칩 왼쪽 「매출·비용·영업이익」 글자가 없다", () => {
    expect(finance).not.toContain(">매출·비용·영업이익</strong>");
  });
  it("세 칸 균등(PC 4칸·매출 2칸 차지 없음)", () => {
    expect(boxes).toContain('className="stat-split grid min-w-0 grid-cols-3"');
    expect(boxes).not.toContain("pc:grid-cols-4");
    expect(boxes).not.toContain("pc:col-span-2");
  });
  it("상세는 누른 칸 안(그 칸 아래)에만 그린다", () => {
    for (const k of ["revenue", "cost", "profit"]) expect(boxes).toContain(`{open === "${k}" && detail}`);
  });
  it("직접 설정 미완료 안내를 대시보드에서 넘기지 않는다", () => {
    expect(finance).not.toContain("incomplete=");
  });
});
