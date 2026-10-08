/**
 * Layer: repo — 업체 계정 보관함 DB (company-vault).
 *
 * company_vault: (spreadsheet_id, company_key) 한 줄 = 업체 하나의 보관 항목 묶음. 내용은 암호문만.
 * vault_pins: 수강생 시트마다 PIN 해시와 연속 실패 기록.
 * 시트 미러로 보내지 않는 DB 전용 표다 — sheet_rows 와 섞지 않는다.
 * sealed·pin_hash 열은 로그에 남기지 않는다.
 */
import { getDbPool } from "./client";

let schemaReady: Promise<void> | null = null;

export function ensureVaultSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = doEnsure().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

async function doEnsure(): Promise<void> {
  await getDbPool().query(`
    create table if not exists company_vault (
      spreadsheet_id text not null,
      company_key text not null,
      sealed text not null,
      item_count int not null default 0,
      updated_at timestamptz not null default now(),
      primary key (spreadsheet_id, company_key)
    )`);
  await getDbPool().query(`
    create table if not exists vault_pins (
      spreadsheet_id text primary key,
      pin_hash text not null,
      failed_count int not null default 0,
      locked_until timestamptz,
      updated_at timestamptz not null default now()
    )`);
}

export interface VaultRow {
  sealed: string;
  itemCount: number;
}

export async function readVaultRow(sheetId: string, companyKey: string): Promise<VaultRow | null> {
  await ensureVaultSchema();
  const res = await getDbPool().query<{ sealed: string; item_count: number }>(
    `select sealed, item_count from company_vault where spreadsheet_id = $1 and company_key = $2`,
    [sheetId, companyKey],
  );
  const row = res.rows[0];
  return row ? { sealed: row.sealed, itemCount: row.item_count } : null;
}

export async function writeVaultRow(sheetId: string, companyKey: string, sealed: string, itemCount: number): Promise<void> {
  await ensureVaultSchema();
  await getDbPool().query(
    `insert into company_vault (spreadsheet_id, company_key, sealed, item_count, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (spreadsheet_id, company_key)
     do update set sealed = excluded.sealed, item_count = excluded.item_count, updated_at = now()`,
    [sheetId, companyKey, sealed, itemCount],
  );
}

export async function deleteVaultRow(sheetId: string, companyKey: string): Promise<void> {
  await ensureVaultSchema();
  await getDbPool().query(`delete from company_vault where spreadsheet_id = $1 and company_key = $2`, [sheetId, companyKey]);
}

export interface PinRow {
  pinHash: string;
  failedCount: number;
  lockedUntil: Date | null;
}

export async function readPinRow(sheetId: string): Promise<PinRow | null> {
  await ensureVaultSchema();
  const res = await getDbPool().query<{ pin_hash: string; failed_count: number; locked_until: Date | null }>(
    `select pin_hash, failed_count, locked_until from vault_pins where spreadsheet_id = $1`,
    [sheetId],
  );
  const row = res.rows[0];
  return row ? { pinHash: row.pin_hash, failedCount: row.failed_count, lockedUntil: row.locked_until } : null;
}

export async function writePin(sheetId: string, pinHash: string): Promise<void> {
  await ensureVaultSchema();
  await getDbPool().query(
    `insert into vault_pins (spreadsheet_id, pin_hash, failed_count, locked_until, updated_at)
     values ($1, $2, 0, null, now())
     on conflict (spreadsheet_id)
     do update set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null, updated_at = now()`,
    [sheetId, pinHash],
  );
}

export async function recordPinResult(sheetId: string, failedCount: number, lockedUntil: Date | null): Promise<void> {
  await getDbPool().query(
    `update vault_pins set failed_count = $2, locked_until = $3 where spreadsheet_id = $1`,
    [sheetId, failedCount, lockedUntil],
  );
}

export async function deletePin(sheetId: string): Promise<void> {
  await ensureVaultSchema();
  await getDbPool().query(`delete from vault_pins where spreadsheet_id = $1`, [sheetId]);
}
