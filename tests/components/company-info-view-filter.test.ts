import { describe, it, expect } from "vitest";
import { CompanyInfo } from "@/types";
import { 기업정보_ITEMS, 대표자_ITEMS, 재무_ITEMS, type EditorItem } from "@/components/company-info-defs";
import { countFields, visibleItems } from "@/components/company-info/view-filter";

const ci = (p: Partial<CompanyInfo>) => CompanyInfo.parse(p);
const keysOf = (items: EditorItem[], idx: number[]) =>
  idx.map((i) => {
    const it = items[i]!;
    return it.kind === "field" || it.kind === "money" ? it.def[0] : it.kind;
  });

describe("업체정보 보기 — 전체 / 적은 것 / 안 적은 것", () => {
  it("전체는 적은 항목이 위, 안 적은 항목이 아래(원래 순서 유지)", () => {
    const d = ci({ 특허및인증: "벤처", 사업자등록번호: "123-45-67890" });
    const order = keysOf(기업정보_ITEMS, visibleItems(기업정보_ITEMS, d, "all"));
    expect(order.slice(0, 2)).toEqual(["사업자등록번호", "특허및인증"]);
    expect(order).toHaveLength(visibleItems(기업정보_ITEMS, ci({}), "all").length);
  });

  it("적은 것·안 적은 것은 해당 항목만 보인다", () => {
    const d = ci({ 특허및인증: "벤처" });
    expect(keysOf(기업정보_ITEMS, visibleItems(기업정보_ITEMS, d, "filled"))).toEqual(["특허및인증"]);
    expect(keysOf(기업정보_ITEMS, visibleItems(기업정보_ITEMS, d, "empty"))).not.toContain("특허및인증");
  });

  it("한 줄에 칸이 둘(이름·주민번호)이면 하나만 적어도 양쪽 보기에 다 보인다", () => {
    const d = ci({ 대표자이름: "홍길동" });
    const pair = 대표자_ITEMS.findIndex((it) => it.kind === "pair");
    expect(visibleItems(대표자_ITEMS, d, "filled")).toContain(pair);
    expect(visibleItems(대표자_ITEMS, d, "empty")).toContain(pair);
  });

  it("자동 계산 비율은 세지 않고, 연도별 매출은 반기만 적어도 그 해를 적은 것으로 센다", () => {
    const empty = countFields([대표자_ITEMS, 기업정보_ITEMS, 재무_ITEMS], ci({}));
    const withHalf = countFields([대표자_ITEMS, 기업정보_ITEMS, 재무_ITEMS], ci({ 매출Y상: "50", 부채비율: "120%" }));
    expect(withHalf[0]).toBe(1);
    expect(withHalf[0] + withHalf[1]).toBe(empty[0] + empty[1]);
    const ratio = 재무_ITEMS.findIndex((it) => it.kind === "ratio");
    expect(visibleItems(재무_ITEMS, ci({ 부채비율: "120%" }), "filled")).not.toContain(ratio);
    expect(visibleItems(재무_ITEMS, ci({}), "all").at(-1)).toBeGreaterThanOrEqual(ratio);
  });
});
