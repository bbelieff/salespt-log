/** 구조 개선 ⑥ — DB관리시트 업체 동일성은 화면·서버가 같은 판정. 합성값만. */
import { describe, expect, it } from "vitest";
import { domesticPhoneDigits, formatMobilePhone, isSameLead } from "@/util/db-sheet-identity";
import { duplicate, blank, formatPhone } from "@/app/(app)/db-sheet/_components/model";
import { normalizeImportPhone } from "@/app/(app)/db-sheet/_components/adaptive-import";

const lead = (phone: string, company = "", biz = "") => ({ phone, company, biz });

describe("국내 번호 숫자", () => {
  it.each([
    ["+821000004001", "01000004001"],
    ["p:+821000004001", "01000004001"],
    ["+82 10-0000-4001", "01000004001"],
    ["+82 010-0000-4001", "01000004001"],
    ["010-0000-4001", "01000004001"],
  ])("%s → %s", (raw, want) => { expect(domesticPhoneDigits(raw)).toBe(want); });
  it("휴대폰만 하이픈", () => {
    expect(formatMobilePhone("+821000004001")).toBe("010-0000-4001");
    expect(formatMobilePhone("확인 필요")).toBe("확인 필요");
  });
  it("가져오기·표시도 같은 변환", () => {
    expect(normalizeImportPhone("+82 010-0000-4001")).toBe("010-0000-4001");
    expect(formatPhone("p:+821000004001")).toBe("010-0000-4001");
  });
});

describe("같은 업체 판정 — 화면 경고 = 서버 차단", () => {
  it("전화·이름·사업자번호 중 하나", () => {
    expect(isSameLead(lead("+82 010-0000-4001"), lead("010-0000-4001"))).toBe(true);
    expect(isSameLead(lead("", "샘플 상사"), lead("", "샘플상사"))).toBe(true);
    expect(isSameLead(lead("", "", "123-45-67890"), lead("", "", "1234567890"))).toBe(true);
    expect(isSameLead(lead("010-0000-4001", "가"), lead("010-0000-4002", "나"))).toBe(false);
    expect(isSameLead(lead("1234"), lead("1234"))).toBe(false);
  });
  it("화면 duplicate 는 같은 함수를 쓴다", () => {
    const a = { ...blank(), phone: "+82 010-0000-4001" };
    const b = { ...blank(), phone: "010-0000-4001" };
    expect(duplicate(a, [b])).toBe(true);
  });
});
