/** 공급처별 성과 순수 집계(app/(app)/db-sheet/_components/supplier-summary.ts) — 합성 리드만 사용. */
import { describe, expect, it } from "vitest";
import { DbSheetLeadInput, type DbSheetFunnelStep, type DbSheetLead } from "@/types/db-sheet";
import {
  SUPPLIER_MIN_SAMPLE, SUPPLIER_TOP_LIMIT, headlineText, pct, periodLabel, summarizeSuppliers, visibleSupplierRows,
} from "@/app/(app)/db-sheet/_components/supplier-summary";

let seq = 0;
function lead(supplier: string, funnel: DbSheetFunnelStep | undefined, date = "2026-10-05", channel: "매입DB" | "직접생산" = "매입DB"): DbSheetLead {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return { ...DbSheetLeadInput.parse({ id, supplier, date, channel, company: `샘플상사 ${seq}` }), revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null, ...(funnel ? { funnel } : {}) };
}
function many(n: number, supplier: string, funnel: DbSheetFunnelStep | undefined, date?: string, channel?: "매입DB" | "직접생산") {
  return Array.from({ length: n }, () => lead(supplier, funnel, date, channel));
}
const all = { from: "", to: "" };
const pick = (rows: ReturnType<typeof summarizeSuppliers>["rows"], supplier: string) => rows.find(row => row.supplier === supplier)!;

describe("summarizeSuppliers", () => {
  it("groups by the raw supplier string (same exact match as the filter) and keeps the blank bucket last", () => {
    const { rows } = summarizeSuppliers([...many(5, "", undefined), lead("샘플디비A", "유입"), lead("샘플디비A ", "유입"), lead("샘플디비A", "연락")], all);
    expect(rows.map(row => [row.supplier, row.label, row.total])).toEqual([["샘플디비A", "샘플디비A", 2], ["샘플디비A ", "샘플디비A ", 1], ["", "공급처 미입력", 5]]);
  });

  it("counts steps cumulatively and treats a missing funnel (optimistic row) as untouched", () => {
    const { rows, total } = summarizeSuppliers([lead("가상식품", "계약"), lead("가상식품", "미팅"), lead("가상식품", "상담"), lead("가상식품", "연락"), lead("가상식품", "유입"), lead("가상식품", undefined)], all);
    expect(pick(rows, "가상식품")).toMatchObject({ total: 6, untouched: 2, consulted: 3, meetings: 2, contracts: 1 });
    expect(total).toMatchObject({ label: "합계", total: 6, untouched: 2, consulted: 3, meetings: 2, contracts: 1 });
  });

  it("filters only by 유입일, inclusive on both ends", () => {
    const leads = [lead("샘플상사", "유입", "2026-09-30"), lead("샘플상사", "유입", "2026-10-01"), lead("샘플상사", "유입", "2026-10-12"), lead("샘플상사", "유입", "2026-10-13")];
    expect(summarizeSuppliers(leads, { from: "2026-10-01", to: "2026-10-12" }).total.total).toBe(2);
    expect(summarizeSuppliers(leads, { from: "2026-10-01", to: "" }).total.total).toBe(3);
    expect(summarizeSuppliers(leads, { from: "", to: "2026-10-01" }).total.total).toBe(2);
  });

  it("sorts by 들어온 DB desc, then name; lists channels in fixed order", () => {
    const { rows } = summarizeSuppliers([...many(3, "나상사", "유입"), ...many(3, "가상사", "유입", undefined, "직접생산"), lead("가상사", "유입"), ...many(5, "다상사", "유입")], all);
    expect(rows.map(row => row.supplier)).toEqual(["다상사", "가상사", "나상사"]);
    expect(pick(rows, "가상사").channels).toEqual(["매입DB", "직접생산"]);
  });

  it("reproduces the browser fixture numbers exactly", () => {
    const before = "2026-09-25", after = "2026-10-05";
    const leads = [
      ...many(10, "샘플디비A", "유입", after), ...many(14, "샘플디비A", "연락", after), ...many(10, "샘플디비A", "상담", after), ...many(4, "샘플디비A", "미팅", after), ...many(2, "샘플디비A", "계약", after),
      ...many(5, "샘플디비B", "유입", before), ...many(14, "샘플디비B", "연락", before), ...many(5, "샘플디비B", "상담", before), ...many(1, "샘플디비B", "미팅", before),
      ...many(6, "메타 광고", "유입", after, "직접생산"), ...many(10, "메타 광고", "연락", after, "직접생산"), ...many(10, "메타 광고", "상담", after, "직접생산"), ...many(2, "메타 광고", "미팅", after, "직접생산"), ...many(2, "메타 광고", "계약", after, "직접생산"),
      ...many(3, "", "유입", after),
    ];
    const summary = summarizeSuppliers(leads, all);
    const table = [...summary.rows, summary.total].map(row => [row.label, row.total, row.consulted, row.meetings, row.contracts, pct(row.contracts, row.total), row.untouched]);
    expect(table).toEqual([
      ["샘플디비A", 40, 16, 6, 2, "5.0%", 10],
      ["메타 광고", 30, 14, 4, 2, "6.7%", 6],
      ["샘플디비B", 25, 6, 1, 0, "0.0%", 5],
      ["공급처 미입력", 3, 0, 0, 0, "0.0%", 3],
      ["합계", 98, 36, 11, 4, "4.1%", 24],
    ]);
    expect(summary.best).toBe("메타 광고");
    expect(headlineText(summary.headline)).toBe("전체 기간 계약률 1위 공급처 ‘메타 광고’ · DB 30건 중 계약 2건");
    const october = summarizeSuppliers(leads, { from: "2026-10-01", to: "" });
    expect(october.rows.map(row => row.supplier)).toEqual(["샘플디비A", "메타 광고", ""]);
    expect(headlineText(october.headline)).toBe("이 기간 계약률 1위 공급처 ‘메타 광고’ · DB 30건 중 계약 2건");
  });
});

describe("pct", () => {
  it.each([[2, 40, "5.0%"], [0, 25, "0.0%"], [1, 30, "3.3%"], [2, 30, "6.7%"], [4, 98, "4.1%"], [0, 0, "—"], [3, 0, "—"]])("%i / %i → %s", (n, total, expected) => {
    expect(pct(n, total)).toBe(expected);
  });
});

describe("headline", () => {
  it(`waits until a supplier has ${SUPPLIER_MIN_SAMPLE} DB (19 is not enough; blank bucket never qualifies)`, () => {
    const summary = summarizeSuppliers([...many(SUPPLIER_MIN_SAMPLE - 1, "샘플상사", "계약"), ...many(40, "", "계약")], all);
    expect(summary.best).toBeNull();
    expect(headlineText(summary.headline)).toBe("공급처별 DB가 20건 이상 쌓이면 어디가 잘 맞는지 알려 드릴게요");
    expect(summarizeSuppliers(many(SUPPLIER_MIN_SAMPLE, "샘플상사", "계약"), all).best).toBe("샘플상사");
  });

  it("falls back to the consultation rate when no qualifying supplier has a contract", () => {
    const summary = summarizeSuppliers([...many(8, "가상식품", "상담"), ...many(12, "가상식품", "유입"), ...many(5, "샘플상사", "미팅"), ...many(20, "샘플상사", "연락")], all);
    expect(summary.best).toBeNull();
    expect(headlineText(summary.headline)).toBe("아직 계약한 공급처는 없어요 · 상담률 1위 ‘가상식품’ (40.0%)");
    expect(summary.headline.name).toBe("가상식품");
  });

  it("says nobody reached consultation instead of naming a 0% winner", () => {
    const summary = summarizeSuppliers([...many(20, "가상식품", "연락"), ...many(25, "샘플상사", "유입")], all);
    expect(summary.headline).toEqual({ before: "아직 상담까지 간 DB가 없어요", after: "" });
  });

  it("breaks rate ties by more contracts, then more DB, then name", () => {
    const tieRate = [...many(1, "가상A", "계약"), ...many(19, "가상A", "유입"), ...many(2, "가상B", "계약"), ...many(38, "가상B", "유입")];
    expect(summarizeSuppliers(tieRate, all).best).toBe("가상B");
    const tieAll = [...many(1, "나상사", "계약"), ...many(19, "나상사", "유입"), ...many(1, "가상사", "계약"), ...many(19, "가상사", "유입")];
    expect(summarizeSuppliers(tieAll, all).best).toBe("가상사");
  });
});

describe("visibleSupplierRows", () => {
  const rows = summarizeSuppliers([
    ...Array.from({ length: 11 }, (_, i) => many(20 - i, `공급처${String(i + 1).padStart(2, "0")}`, "유입")).flat(),
    ...many(30, "", "유입"),
  ], all).rows;

  it(`shows the top ${SUPPLIER_TOP_LIMIT} named suppliers; the blank bucket is separate and not counted`, () => {
    const view = visibleSupplierRows(rows, "", false);
    expect(view.shown.map(row => row.supplier)).toEqual(["공급처01", "공급처02", "공급처03", "공급처04", "공급처05", "공급처06", "공급처07", "공급처08"]);
    expect(view.blank?.total).toBe(30);
    expect(view.hidden).toBe(3);
  });

  it("keeps a selected supplier beyond the top rows visible", () => {
    const view = visibleSupplierRows(rows, "공급처10", false);
    expect(view.shown.map(row => row.supplier).slice(-2)).toEqual(["공급처08", "공급처10"]);
    expect(view.hidden).toBe(2);
    expect(visibleSupplierRows(rows, "", true)).toMatchObject({ hidden: 0 });
    expect(visibleSupplierRows(rows, "", true).shown).toHaveLength(11);
  });
});

describe("periodLabel", () => {
  it.each([
    ["", "", "유입일 전체"],
    ["2026-10-01", "", "유입일 10/1부터"],
    ["", "2026-10-12", "유입일 10/12까지"],
    ["2026-10-01", "2026-10-12", "유입일 10/1 ~ 10/12"],
    ["2025-12-20", "2026-01-05", "유입일 2025/12/20 ~ 2026/1/5"],
  ])("%s ~ %s → %s", (from, to, expected) => {
    expect(periodLabel(from, to)).toBe(expected);
  });
});
