import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 세션 리플레이(PostHog, ADR-0009 마스킹 OFF)가 고객 계정 비밀번호를 녹화하지 않게 한다(2026-10-12).
 * 보관함은 펼치면 비밀번호를 글자로 보여 주고, 미팅 메모 붙여넣기 칸에는 원문 비밀번호가 들어간다.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("계정 보관함·미팅 메모는 녹화 제외", () => {
  it("보관함 영역 전체에 ph-no-capture", () => {
    expect(read("components/company-info/CompanyVaultSection.tsx")).toMatch(/<section aria-label="계정 보관함" className="ph-no-capture /);
  });
  it("보관함으로 보낼 항목·남은 메모 미리보기에 ph-no-capture", () => {
    expect(read("components/company-doc/CompanyDocMemoExtras.tsx")).toContain('<div className="ph-no-capture mt-3 space-y-2">');
  });
  it("미팅 메모 붙여넣기 칸에 ph-no-capture", () => {
    const dialog = read("components/company-doc/CompanyDocAutofillDialog.tsx");
    const paste = dialog.slice(dialog.indexOf("<textarea"), dialog.indexOf("/>", dialog.indexOf("<textarea")));
    expect(paste).toContain("ph-no-capture");
  });
});
