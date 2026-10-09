import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 업체정보 다듬기(belie 2026-10-09).
 * [1] 연매출 줄을 옅은 파랑 띠로 강조 · [2] 계정 보관함은 이름이 먼저, 종류 select 는 좁게.
 * ([3]·[4]·[5] 소유여부·4대보험|특허 = company-info-restructure.test.ts, [6] 주간목표 = desktop-glass-shell.test.ts)
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sales = read("components/company-info/CompanyInfoSalesFields.tsx");
const vault = read("components/company-info/CompanyVaultSection.tsx");

describe("[1] 연매출 강조", () => {
  it("연매출 줄의 머리·칸이 같은 띠 색, 띠가 끊기지 않게 가로 간격 0", () => {
    expect(sales).toContain('data-sales-line={line === 0 ? "total" : undefined}');
    expect(sales).toContain('"rounded-l-md bg-blue-50 py-1 font-bold text-blue-900"');
    expect(sales).toContain("min-w-0 bg-blue-50 px-0.5 py-1 align-top");
    expect(sales).toContain("border-spacing-x-0");
  });
});

describe("[2] 계정 보관함 한 줄", () => {
  it("이름 칸이 먼저(늘어남), 종류 select 는 w-full 없이 좁게", () => {
    const label = vault.indexOf("id={`${idBase}-label-${i}`}");
    const kind = vault.indexOf("<select id={`${idBase}-kind-${i}`}");
    expect(label).toBeGreaterThan(0);
    expect(label).toBeLessThan(kind);
    expect(vault).toContain("className={`${inputCls} min-w-0 flex-1 font-semibold`}");
    expect(vault).toContain("className={`${kindCls} w-20 shrink-0 px-1`}");
    expect(vault).toContain('const kindCls = inputCls.replace("w-full ", "");');
  });
});
