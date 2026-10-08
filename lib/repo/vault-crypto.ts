/**
 * Layer: repo — 업체 계정 보관함 암호화·PIN·열림표 (company-vault).
 *
 * - 보관 내용: AES-256-GCM. 키는 AUTH_SECRET 에서 HKDF 로 파생(gcal-crypto 와 같은 방식, 다른 salt).
 *   AUTH_SECRET 을 바꾸면 기존 보관 내용은 열 수 없다 — 바꾸기 전에 내보내야 한다.
 * - PIN: scrypt 해시(+무작위 salt)만 저장한다. PIN 자체는 어디에도 남기지 않는다.
 * - 열림표: "이 시트를 언제까지 열어 둔다"를 HMAC 으로 서명한 짧은 글. 쿠키에 담는다.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { authConfig } from "@/config";

const SALT = "salespt-company-vault.v1";
const IV_LEN = 12;
const TAG_LEN = 16;

function key(info: string): Buffer {
  const secret = authConfig().secret;
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from(SALT), Buffer.from(info), 32));
}

const b64u = (b: Buffer): string => b.toString("base64url");
const fromB64u = (s: string): Buffer => Buffer.from(s, "base64url");

/** 평문 → `v1:iv:tag:ct`. */
export function sealVault(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key("vault-data"), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${b64u(iv)}:${b64u(cipher.getAuthTag())}:${b64u(ct)}`;
}

/** `v1:iv:tag:ct` → 평문. 형식이 틀리거나 변조되면 throw. */
export function openVault(sealed: string): string {
  const parts = sealed.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("[vault-crypto] 지원하지 않는 형식");
  const iv = fromB64u(parts[1]!);
  const tag = fromB64u(parts[2]!);
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error("[vault-crypto] iv/tag 길이 불일치");
  const decipher = createDecipheriv("aes-256-gcm", key("vault-data"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(fromB64u(parts[3]!)), decipher.final()]).toString("utf8");
}

/** PIN → `s1:salt:hash`. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `s1:${b64u(salt)}:${b64u(scryptSync(pin, salt, 32))}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const expected = fromB64u(parts[2]!);
  const actual = scryptSync(pin, fromB64u(parts[1]!), expected.length);
  return timingSafeEqual(actual, expected);
}

function sign(body: string): string {
  return b64u(createHmac("sha256", key("vault-unlock")).update(body).digest());
}

/** 열림표 — `{시트}.{끝나는 ms}.{서명}`. */
export function issueUnlockTicket(sheetId: string, untilMs: number): string {
  const body = `${b64u(Buffer.from(sheetId, "utf8"))}.${untilMs}`;
  return `${body}.${sign(body)}`;
}

/** 열림표가 이 시트의 것이고 아직 유효하면 끝나는 ms, 아니면 null. */
export function readUnlockTicket(ticket: string | undefined, sheetId: string, nowMs: number): number | null {
  if (!ticket) return null;
  const parts = ticket.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(parts[2]!);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (fromB64u(parts[0]!).toString("utf8") !== sheetId) return null;
  const until = Number(parts[1]);
  return Number.isFinite(until) && until > nowMs ? until : null;
}
