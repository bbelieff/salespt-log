/** 구조 개선 ⑩ — 실무/수납 선택 상태 전이. 옛 page.tsx 의 setState 묶음과 같은 결과인지 고정. */
import { describe, expect, it } from "vitest";
import { INITIAL_PAYMENT_SELECTION as S0, paymentSelectionReducer as r } from "@/app/(app)/payment/_lib/payment-selection";

describe("paymentSelectionReducer", () => {
  it("진행건·업체 선택은 상세를 펼치고 포커스를 다시 요청", () => {
    const a = r({ ...S0, detailExpanded: false }, { type: "selectWork", key: "w1", row: 7 });
    expect(a).toMatchObject({ workKey: "w1", row: 7, detailExpanded: true, focusId: 1 });
    const b = r(a, { type: "selectCompany", key: "c1", row: 8 });
    expect(b).toMatchObject({ companyKey: "c1", row: 8, focusId: 2 });
  });
  it("보기 전환은 이어지는 항목으로, 같은 보기면 그대로", () => {
    const base = { ...S0, query: "검색", detailExpanded: false };
    expect(r(base, { type: "switchMode", mode: "company", workKey: "x", companyKey: "x", row: 1 })).toBe(base);
    expect(r(base, { type: "switchMode", mode: "institution", workKey: "w9", companyKey: null, row: null })).toMatchObject({ listMode: "institution", workKey: "w9", query: "", detailExpanded: true, row: null });
    const inst = { ...base, listMode: "institution" as const, row: 3 };
    expect(r(inst, { type: "switchMode", mode: "company", workKey: null, companyKey: "c2", row: 5 })).toMatchObject({ listMode: "company", companyKey: "c2", row: 5, query: "" });
  });
  it("성과 요약에서 이동은 업체 보기로, 상세 펼침은 건드리지 않는다", () => {
    const s = r({ ...S0, listMode: "institution", query: "q", detailExpanded: false }, { type: "navigate", row: 4, companyKey: "c4" });
    expect(s).toMatchObject({ listMode: "company", query: "", row: 4, companyKey: "c4", detailExpanded: false, focusId: 1 });
  });
  it("새 업체 추가·외부 포커스·접기", () => {
    expect(r({ ...S0, companyKey: "old", query: "q" }, { type: "created", row: 11 })).toMatchObject({ companyKey: null, query: "", row: 11, detailExpanded: true, focusId: 1 });
    expect(r(S0, { type: "focusTarget", row: 2, companyKey: "c" })).toMatchObject({ row: 2, companyKey: "c", focusId: 1, detailExpanded: true });
    expect(r(S0, { type: "toggleDetail" }).detailExpanded).toBe(false);
    expect(r(S0, { type: "collapseDetail" }).detailExpanded).toBe(false);
  });
});
