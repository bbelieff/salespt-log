/**
 * Layer: repo — 구글 캘린더 refresh token 암호화 (ADR-0028).
 *
 * per-user refresh token 을 레지스트리 시트 `gcal_token` 컬럼에 저장하기 전 **AES-256-GCM**
 * 으로 암호화. 키는 `AUTH_SECRET` 에서 **HKDF-SHA256** 파생(시트 열람 권한과 토큰 사용 권한
 * 분리 — 복호화는 AUTH_SECRET 보유 서버만).
 *
 * ⚠️ **평문 저장 절대 금지**(ADR-0028 §3). AUTH_SECRET 로테이션 시 기존 토큰 전부 복호화
 * 불가 → 전원 "다시 연결"(ADR-0028 영향). 포맷: `v1:{iv}:{tag}:{ct}` (전부 base64url).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { authConfig } from "@/config";

const SALT = "salespt-gcal-token.v1"; // 고정 앱 상수(키 결정성 — 랜덤이면 복호화 불가)
const INFO = "gcal-refresh-token";
const IV_LEN = 12; // GCM 표준 nonce
const TAG_LEN = 16;

/** AUTH_SECRET → 32바이트 대칭키 (HKDF-SHA256). 매 호출 파생(캐시 불필요 — 저비용). */
function deriveKey(): Buffer {
  const secret = authConfig().secret;
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from(SALT), Buffer.from(INFO), 32));
}

const b64u = (b: Buffer): string => b.toString("base64url");
const fromB64u = (s: string): Buffer => Buffer.from(s, "base64url");

/** 평문 refresh token → `v1:iv:tag:ct`. 빈 문자열은 빈 문자열 그대로(미연결 표현). */
export function encryptToken(plaintext: string): string {
  if (plaintext === "") return "";
  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${b64u(iv)}:${b64u(tag)}:${b64u(ct)}`;
}

/** `v1:iv:tag:ct` → 평문. 포맷/버전 불일치·변조(GCM 인증 실패)는 throw(호출부에서 "다시 연결" 유도).
 *  빈 문자열은 빈 문자열(미연결). */
export function decryptToken(token: string): string {
  if (token === "") return "";
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("[gcal-crypto] 지원하지 않는 토큰 포맷/버전");
  }
  const iv = fromB64u(parts[1]!);
  const tag = fromB64u(parts[2]!);
  const ct = fromB64u(parts[3]!);
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("[gcal-crypto] iv/tag 길이 불일치");
  }
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  // final() 이 인증 실패(변조·잘못된 키) 시 throw — GCM 무결성 보장.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** 암호화 토큰인지(로그·마스킹용) — 평문이 실수로 저장됐는지 가드에 사용. */
export function isEncrypted(token: string): boolean {
  return token.startsWith("v1:") && token.split(":").length === 4;
}

/** 두 토큰이 같은 평문인지 타이밍 안전 비교(디버그·테스트용, 실사용 드묾). */
export function sameToken(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
