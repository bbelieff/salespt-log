import { describe, it, expect, vi } from "vitest";

vi.mock("@/config", () => ({ authConfig: () => ({ secret: "synthetic-test-secret-value" }) }));

import { hashPin, issueUnlockTicket, openVault, readUnlockTicket, sealVault, verifyPin } from "@/repo/vault-crypto";

describe("보관함 암호화", () => {
  it("잠근 내용을 그대로 다시 연다", () => {
    const sealed = sealVault('[{"label":"홈택스","secret":"pw!"}]');
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("pw!");
    expect(openVault(sealed)).toBe('[{"label":"홈택스","secret":"pw!"}]');
  });

  it("변조된 암호문은 열지 않는다", () => {
    const parts = sealVault("abc").split(":");
    parts[3] = Buffer.from("xyz").toString("base64url");
    expect(() => openVault(parts.join(":"))).toThrow();
  });
});

describe("PIN", () => {
  it("맞는 PIN 만 통과하고 PIN 자체는 저장 값에 없다", () => {
    const stored = hashPin("4821");
    expect(stored).not.toContain("4821");
    expect(verifyPin("4821", stored)).toBe(true);
    expect(verifyPin("4822", stored)).toBe(false);
  });
});

describe("열림표", () => {
  it("같은 시트·유효 시간 안에서만 열려 있다", () => {
    const t = issueUnlockTicket("sheet-a", 10_000);
    expect(readUnlockTicket(t, "sheet-a", 5_000)).toBe(10_000);
    expect(readUnlockTicket(t, "sheet-a", 10_001)).toBeNull();
    expect(readUnlockTicket(t, "sheet-b", 5_000)).toBeNull();
  });

  it("끝나는 시각을 고친 열림표는 거절한다", () => {
    const [sheet, , sig] = issueUnlockTicket("sheet-a", 10_000).split(".");
    expect(readUnlockTicket(`${sheet}.99999999999999.${sig}`, "sheet-a", 5_000)).toBeNull();
  });
});
