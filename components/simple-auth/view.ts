/**
 * 간편인증 서류 조회 화면용 보기 모델 — 서버 SimpleAuthRequest 의 보낸 시각(ISO)을 한국시간 「MM-DD HH:mm」로 바꿔
 * 목록의 날짜 묶음·수단 띠가 그대로 쓰게 한다. 서류 이름은 config 정본.
 */
import type { SimpleAuthBusiness, SimpleAuthDocKey, SimpleAuthLink, SimpleAuthRequest } from "@/types/simple-auth";
import { simpleAuthDocLabel, simpleAuthDocShort } from "@/config/simple-auth";

export type AuthRequest = SimpleAuthRequest;
export type Biz = SimpleAuthBusiness;
export type Link = SimpleAuthLink;
export type DocKey = SimpleAuthDocKey;

export const docLabel = simpleAuthDocLabel;
export const docShort = simpleAuthDocShort;

/** DB 연결 + 업체정보 반영까지 끝난 사업자 — 목록에서 뺀다(belie 2026-11-08). */
export const isFinished = (b: Biz) => b.applied && b.link.state === "linked";

/** ISO → 한국시간 「MM-DD HH:mm」. */
export function kstStamp(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return `${k.slice(5, 10)} ${k.slice(11, 16)}`;
}

export const toView = (r: SimpleAuthRequest): AuthRequest => ({ ...r, sentAt: kstStamp(r.sentAt) });
