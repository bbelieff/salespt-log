/**
 * Layer: types — 업체 계정 보관함(company-vault, belie 2026-10-08).
 *
 * 수강생이 고객 대신 관리하는 아이디·비밀번호·계좌·주민번호 뒷자리를 업체별로 보관한다.
 * 저장은 서버에서 암호화(AES-256-GCM)하고 구글시트 사본에는 보내지 않는다.
 * 보려면 수강생이 정한 PIN(4~8자리 숫자)으로 한 번 열고, 열린 상태는 30분 유지된다.
 */
import { z } from "zod";

export const VAULT_KINDS = ["login", "bank", "rrn", "other"] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

const text = (max: number) => z.string().max(max).default("");

/** 보관 항목 1개 — login(아이디/비번), bank(은행/계좌), rrn(주민번호 전체), other(그 밖). */
export const VaultItem = z.object({
  kind: z.enum(VAULT_KINDS).default("other"),
  /** 무엇의 계정인지 — "공동인증서", "홈택스", "농협 주거래". */
  label: text(60),
  /** 아이디·은행명·예금주 등 앞쪽 값. */
  id: text(200),
  /** 비밀번호·계좌번호·주민번호 등 가릴 값. */
  secret: text(500),
  note: text(500),
});
export type VaultItem = z.infer<typeof VaultItem>;

export const VaultItems = z.array(VaultItem).max(50);
export type VaultItems = z.infer<typeof VaultItems>;

/** PIN — 숫자 4~8자리. */
export const VaultPin = z.string().regex(/^\d{4,8}$/, "PIN은 숫자 4~8자리예요.");

/** 업체를 가리키는 값 — 미팅 화면은 meetingId, 실무/수납은 계약일+업체명. */
export const VaultTarget = z.object({
  meetingId: z.string().max(200).optional(),
  계약일: z.string().max(20).optional(),
  업체명: z.string().max(200).optional(),
});
export type VaultTarget = z.infer<typeof VaultTarget>;

/** 보관함 상태 — 잠겨 있으면 항목 수만, 열려 있으면 항목까지. */
export interface VaultView {
  hasPin: boolean;
  unlocked: boolean;
  /** 열린 상태가 끝나는 시각(ISO). 잠겨 있으면 null. */
  unlockedUntil: string | null;
  count: number;
  items: VaultItem[] | null;
}

/** 열린 상태 유지 시간 — 쓸 때마다 다시 30분으로 늘어난다(belie 2026-10-09 10분→30분). */
export const VAULT_UNLOCK_MS = 30 * 60 * 1000;
/** PIN 연속 실패 허용 횟수와 잠금 시간. */
export const VAULT_MAX_FAILS = 5;
export const VAULT_LOCKOUT_MS = 5 * 60 * 1000;
