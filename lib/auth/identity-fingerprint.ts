/** 비교 전용 신원 지문 — 원문 이메일을 클라이언트로 내보내지 않기 위해(whoami·쓰기 검사 공용). 서버 전용. */
import { createHash } from "node:crypto";

export function identityFingerprint(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}
