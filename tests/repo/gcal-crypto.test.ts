/** gcal 토큰 AES-256-GCM 암복호화 — 왕복·변조감지·포맷·빈값 (ADR-0028). */
import { beforeAll, describe, expect, it } from "vitest";
import { decryptToken, encryptToken, isEncrypted } from "@/repo/gcal-crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-gcal-crypto-3568";
  process.env.AUTH_GOOGLE_ID = "x";
  process.env.AUTH_GOOGLE_SECRET = "x";
});

describe("gcal-crypto", () => {
  it("왕복: 암호화 → 복호화 = 원문", () => {
    const token = "1//0gRefreshTokenExample_abcDEF-123";
    const enc = encryptToken(token);
    expect(enc).not.toBe(token); // 평문 아님
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptToken(enc)).toBe(token);
  });

  it("비결정적 IV — 같은 평문도 매번 다른 암호문(하지만 복호화는 동일)", () => {
    const t = "same-plaintext";
    const a = encryptToken(t), b = encryptToken(t);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(t);
    expect(decryptToken(b)).toBe(t);
  });

  it("변조 감지: ciphertext 1비트 변조 시 복호화 throw (GCM 무결성)", () => {
    const enc = encryptToken("secret-token");
    const parts = enc.split(":");
    const ctBuf = Buffer.from(parts[3]!, "base64url");
    ctBuf[0] = ctBuf[0]! ^ 0x01; // 1비트 flip
    const tampered = `v1:${parts[1]}:${parts[2]}:${ctBuf.toString("base64url")}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("변조 감지: authTag 변조 시 throw", () => {
    const enc = encryptToken("secret-token");
    const parts = enc.split(":");
    const tagBuf = Buffer.from(parts[2]!, "base64url");
    tagBuf[0] = tagBuf[0]! ^ 0xff;
    const tampered = `v1:${parts[1]}:${tagBuf.toString("base64url")}:${parts[3]}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("잘못된 포맷/버전 throw", () => {
    expect(() => decryptToken("plaintext-not-encrypted")).toThrow();
    expect(() => decryptToken("v2:a:b:c")).toThrow();
    expect(() => decryptToken("v1:only:three")).toThrow();
  });

  it("빈 문자열 = 미연결 (빈 문자열 그대로, 암호화 안 함)", () => {
    expect(encryptToken("")).toBe("");
    expect(decryptToken("")).toBe("");
    expect(isEncrypted("")).toBe(false);
  });

  it("긴 토큰·유니코드 안전", () => {
    const t = "1//" + "x".repeat(500) + "_한글토큰";
    expect(decryptToken(encryptToken(t))).toBe(t);
  });
});
