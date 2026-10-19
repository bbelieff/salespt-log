/** 구조 개선 ⑤ — 계약 연결 키는 한 함수로 만들고, 비교는 공백 차이를 무시. 합성값. */
import { describe, expect, it } from "vitest";
import { contractRef, normalizeContractRef, sameContractRef } from "@/util/contract-ref";
import { companyContractRef } from "@/repo/company-info-archive";
import { slotActivityKey } from "@/lib/analytics/payment-work-status";

describe("contractRef", () => {
  it("새 키는 앞뒤 공백을 지운다", () => {
    expect(contractRef("2026-10-01", " 예시상사 ")).toBe("2026-10-01|예시상사");
    expect(companyContractRef("2026-10-01", "예시상사 ")).toBe("2026-10-01|예시상사");
  });
  it("이미 저장된 공백 섞인 키와도 같은 계약으로 본다", () => {
    expect(sameContractRef("2026-10-01|예시상사 ", contractRef("2026-10-01", "예시상사"))).toBe(true);
    expect(normalizeContractRef(" 2026-10-01 | 예시상사")).toBe("2026-10-01|예시상사");
    expect(sameContractRef("2026-10-01|예시상사", "2026-10-02|예시상사")).toBe(false);
  });
  it("활동 색인 키도 공백 차이를 무시", () => {
    expect(slotActivityKey("2026-10-01|예시상사 ", "가은행")).toBe(slotActivityKey("2026-10-01|예시상사", "가은행"));
  });
});
