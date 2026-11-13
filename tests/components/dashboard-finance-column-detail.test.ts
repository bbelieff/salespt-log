/** 대시보드 매출·비용·영업이익(2026-11-11 belie): 제목 글자 없음 · 칸 균등(A안 2026-11-13: PC 진행건 네 번째 칸) · 누른 칸 바로 아래에만 상세 · 직접 설정 안내 문장 없음. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boxes = readFileSync("components/dashboard/FinanceSummaryBoxes.tsx", "utf8");
const finance = readFileSync("components/dashboard/DashboardFinance.tsx", "utf8");

describe("대시보드 재무 세 칸", () => {
  it("기간 칩 왼쪽 「매출·비용·영업이익」 글자가 없다", () => {
    expect(finance).not.toContain(">매출·비용·영업이익</strong>");
  });
  it("칸은 균등 — 폰 세 칸, PC 는 진행건이 있을 때만 네 칸(매출 2칸 차지 없음, A안 2026-11-13)", () => {
    expect(boxes).toContain('className={`stat-split grid min-w-0 grid-cols-3${work ? " pc:grid-cols-4" : ""}`}');
    expect(boxes).not.toContain("col-span-2");
  });
  it("상세는 누른 칸 안(그 칸 아래)에만 그린다", () => {
    for (const k of ["revenue", "cost", "profit"]) expect(boxes).toContain(`{open === "${k}" && detail}`);
    // 진행건 칸도 같은 detail 을 자기 칸 아래에 그린다.
    expect(boxes).toContain('open={open === "work"}');
    expect(readFileSync("components/dashboard/FinanceWorkColumn.tsx", "utf8")).toContain("{open && detail}");
  });
  it("직접 설정 미완료 안내를 대시보드에서 넘기지 않는다", () => {
    expect(finance).not.toContain("incomplete=");
  });
});
