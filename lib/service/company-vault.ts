/**
 * Layer: service — 업체 계정 보관함 (company-vault, belie 2026-10-08).
 *
 * 시트(수강생)마다 PIN 하나. PIN 으로 한 번 열면 그 시트의 모든 업체 보관함이 10분 열린다.
 * 열림 상태는 서명된 열림표(쿠키)로 들고 다니고, 쓸 때마다 10분으로 다시 늘린다.
 * 업체 키: 미팅 id 가 있으면 `m:<id>`, 계약일+업체명만 있으면 그 계약의 미팅을 찾아 같은 키를 쓰고,
 * 미팅이 없는(영업기록 없이 추가한) 업체만 `c:<계약일>|<업체명>` 을 쓴다.
 * 쿠키를 읽고 쓰는 일은 라우트가 맡는다 — 여기서는 열림표 글만 주고받는다.
 */
import { findUserByEmail } from "@/repo/users";
import { dbEnabled } from "@/repo/db/client";
import {
  deletePin,
  readPinRow,
  readVaultRow,
  recordPinResult,
  writePin,
  writeVaultRow,
} from "@/repo/db/company-vault";
import { hashPin, issueUnlockTicket, openVault, readUnlockTicket, sealVault, verifyPin } from "@/repo/vault-crypto";
import {
  VAULT_LOCKOUT_MS,
  VAULT_MAX_FAILS,
  VAULT_UNLOCK_MS,
  VaultItems,
  type VaultItem,
  type VaultTarget,
  type VaultView,
} from "@/types/company-vault";
import { findMeetingsByDateRecord } from "./meetings-write";
import { sourceCohort } from "./daily-source";

export class VaultError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface Owner { email: string; sheetId: string; cohort: string }

async function ownerOf(email: string): Promise<Owner> {
  if (!dbEnabled()) throw new VaultError(503, "보관함을 지금 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.");
  const user = await findUserByEmail(email);
  if (!user?.spreadsheetId) throw new VaultError(403, "수강생 계정에서만 보관함을 쓸 수 있어요.");
  return { email, sheetId: user.spreadsheetId, cohort: sourceCohort(user) };
}

async function companyKeyOf(owner: Owner, target: VaultTarget): Promise<string> {
  const meetingId = target.meetingId?.trim();
  if (meetingId) return `m:${meetingId}`;
  const date = target.계약일?.trim() ?? "";
  const name = target.업체명?.trim() ?? "";
  if (!date || !name) throw new VaultError(400, "어느 업체인지 알 수 없어요.");
  const meetings = await findMeetingsByDateRecord(
    { spreadsheetId: owner.sheetId, cohort: owner.cohort, email: owner.email },
    date,
    "meeting",
  );
  const m = meetings.find((x) => x.업체명.trim() === name);
  return m ? `m:${m.id}` : `c:${date}|${name}`;
}

function decode(sealed: string): VaultItem[] {
  return VaultItems.parse(JSON.parse(openVault(sealed)));
}

export interface VaultResult { view: VaultView; ticket: string | null }

function unlockedUntil(owner: Owner, ticket: string | undefined, now: number): number | null {
  return readUnlockTicket(ticket, owner.sheetId, now);
}

/** 보관함 보기. 열려 있으면 항목을 풀어 주고 열림 시간을 다시 10분으로 늘린다. */
export async function loadVault(email: string, target: VaultTarget, ticket: string | undefined, now = Date.now()): Promise<VaultResult> {
  const owner = await ownerOf(email);
  const [pin, row] = await Promise.all([readPinRow(owner.sheetId), readVaultRow(owner.sheetId, await companyKeyOf(owner, target))]);
  const open = pin ? unlockedUntil(owner, ticket, now) : null;
  if (!open) {
    return { view: { hasPin: !!pin, unlocked: false, unlockedUntil: null, count: row?.itemCount ?? 0, items: null }, ticket: null };
  }
  const until = now + VAULT_UNLOCK_MS;
  const items = row ? decode(row.sealed) : [];
  return {
    view: { hasPin: true, unlocked: true, unlockedUntil: new Date(until).toISOString(), count: items.length, items },
    ticket: issueUnlockTicket(owner.sheetId, until),
  };
}

/** 보관함 저장 — 열려 있을 때만. 빈 항목은 버린다. */
export async function saveVault(email: string, target: VaultTarget, items: unknown, ticket: string | undefined, now = Date.now()): Promise<VaultResult> {
  const owner = await ownerOf(email);
  if (!unlockedUntil(owner, ticket, now)) throw new VaultError(401, "보관함이 잠겼어요. PIN을 다시 입력해 주세요.");
  const parsed = VaultItems.safeParse(items);
  if (!parsed.success) throw new VaultError(400, "보관 항목을 확인해 주세요.");
  const kept = parsed.data.filter((i) => i.label.trim() || i.id.trim() || i.secret.trim() || i.note.trim());
  await writeVaultRow(owner.sheetId, await companyKeyOf(owner, target), sealVault(JSON.stringify(kept)), kept.length);
  const until = now + VAULT_UNLOCK_MS;
  return {
    view: { hasPin: true, unlocked: true, unlockedUntil: new Date(until).toISOString(), count: kept.length, items: kept },
    ticket: issueUnlockTicket(owner.sheetId, until),
  };
}

/** PIN 으로 열기. 5번 틀리면 5분 동안 막는다. */
export async function unlockVault(email: string, pin: string, now = Date.now()): Promise<string> {
  const owner = await ownerOf(email);
  const row = await readPinRow(owner.sheetId);
  if (!row) throw new VaultError(409, "먼저 PIN을 만들어 주세요.");
  if (row.lockedUntil && row.lockedUntil.getTime() > now) {
    const min = Math.ceil((row.lockedUntil.getTime() - now) / 60000);
    throw new VaultError(429, `PIN을 여러 번 틀렸어요. ${min}분 뒤에 다시 시도해 주세요.`);
  }
  if (!verifyPin(pin, row.pinHash)) {
    const fails = row.failedCount + 1;
    const locked = fails >= VAULT_MAX_FAILS ? new Date(now + VAULT_LOCKOUT_MS) : null;
    await recordPinResult(owner.sheetId, locked ? 0 : fails, locked);
    throw new VaultError(401, locked ? "PIN을 5번 틀려서 5분 동안 잠겼어요." : `PIN이 맞지 않아요. (${fails}/${VAULT_MAX_FAILS})`);
  }
  if (row.failedCount || row.lockedUntil) await recordPinResult(owner.sheetId, 0, null);
  return issueUnlockTicket(owner.sheetId, now + VAULT_UNLOCK_MS);
}

/** PIN 만들기·바꾸기. 이미 있으면 지금 PIN 이 맞아야 바꾼다. 만들거나 바꾸면 바로 열린다. */
export async function setVaultPin(email: string, pin: string, currentPin: string | undefined, now = Date.now()): Promise<string> {
  const owner = await ownerOf(email);
  const row = await readPinRow(owner.sheetId);
  if (row && !(currentPin && verifyPin(currentPin, row.pinHash))) {
    throw new VaultError(401, "지금 쓰는 PIN이 맞지 않아요.");
  }
  await writePin(owner.sheetId, hashPin(pin));
  return issueUnlockTicket(owner.sheetId, now + VAULT_UNLOCK_MS);
}

/** 관리자 PIN 초기화 — 보관 내용은 그대로 두고 PIN 만 지운다(수강생이 새로 만든다). */
export async function resetVaultPin(email: string): Promise<void> {
  const owner = await ownerOf(email);
  await deletePin(owner.sheetId);
}
