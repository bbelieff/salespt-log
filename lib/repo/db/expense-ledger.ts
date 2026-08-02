/**
 * Layer: repo/db — 비용 원장 전용 관계형 저장소.
 * 기존 03 DB관리/시트 미러와 완전히 분리한다. 모든 SQL은 spreadsheet_id를 함께 조건으로 둔다.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { dbEnabled, ensureSchema, getDbPool } from "./client";
import type { CreateExpenseBody, CreateRecurringRuleBody, DeleteExpenseCategoryResult, ExpenseCategory, ExpenseCategoryUsage, ExpenseEntry, ExpenseReclassificationRef, ReclassifyUnclassifiedResult, RecurringRule } from "@/types/expense-ledger";

type Row = Record<string, unknown>;
let ledgerSchemaReady: Promise<void> | null = null;
const MIGRATION_FREEZE_ENV = "EXPENSE_CATEGORY_MIGRATION_FREEZE_R6";
const LIFECYCLE_SCHEMA_KEY = "expense_category_lifecycle_r6";
export const EXPENSE_CATEGORY_LIFECYCLE_SQL_SHA256 = "8b8be41141c55119fc6d2693199baea2914f8353e77ec224386efe8707094c7c";

function migrationFreezeEnabled(): boolean {
  return process.env[MIGRATION_FREEZE_ENV]?.trim() === "1";
}

function requireLedgerWritable(): void {
  if (migrationFreezeEnabled()) throw new Error("expense_ledger_unavailable");
}

async function readExistingSnapshot<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (migrationFreezeEnabled()) throw new Error("expense_ledger_unavailable");
    throw error;
  }
}

function requiredDb(): void {
  if (!dbEnabled()) throw new Error("expense_ledger_unavailable");
}

const FRESH_SCHEMA_SQL = `create table expense_categories (
 id uuid primary key, spreadsheet_id text not null, name text not null, name_normalized text not null,
 is_system boolean not null default false, system_key text, archived_at timestamptz, deleted_at timestamptz, deleted_by text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by_email text not null, updated_by_email text not null,
 constraint expense_categories_system_shape_ck check ((is_system is true and system_key is not null and system_key='unclassified' and name='미분류' and name_normalized='미분류' and archived_at is null and deleted_at is null and deleted_by is null) or (is_system is false and system_key is null)),
 constraint expense_categories_tombstone_ck check ((deleted_at is null and deleted_by is null) or (deleted_at is not null and deleted_by is not null)));
create unique index expense_categories_system_key_uq on expense_categories(spreadsheet_id,system_key) where system_key is not null;
create unique index expense_categories_active_name_uq on expense_categories(spreadsheet_id,name_normalized) where deleted_at is null and archived_at is null;
create index expense_categories_scope_lifecycle_idx on expense_categories(spreadsheet_id,deleted_at,archived_at);
create table expense_category_audits (id uuid primary key, category_id uuid not null references expense_categories(id), spreadsheet_id text not null,
 action text not null check(action in ('created','renamed','archived','restored','system_bootstrapped','deleted','reclassified','legacy_migrated')),
 previous_name text, next_name text, target_category_id uuid references expense_categories(id), operation_key uuid, request_hash text,
 terminal_deleted boolean not null default false, prior_category_state jsonb, moved_entry_count int not null default 0, moved_rule_count int not null default 0,
 moved_occurrence_count int not null default 0, actor_email text not null, created_at timestamptz not null default now());
create unique index expense_category_terminal_audit_uq on expense_category_audits(spreadsheet_id,category_id) where action in ('deleted','legacy_migrated') and terminal_deleted;
create unique index expense_category_operation_key_uq on expense_category_audits(spreadsheet_id,operation_key) where operation_key is not null;
create table expense_category_audit_items (audit_id uuid not null references expense_category_audits(id), entity_kind text not null check(entity_kind in ('entry','recurring_rule','recurring_occurrence')), entity_id uuid not null, previous_category_id uuid not null, previous_category_name text not null, previous_is_override boolean, primary key(audit_id,entity_kind,entity_id));
create table expense_entries (id uuid primary key, spreadsheet_id text not null, category_id uuid not null references expense_categories(id), category_name_at_entry text not null, item_name text not null, amount_won bigint not null check(amount_won>0), period_start date not null, period_end date not null, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by_email text not null, updated_by_email text not null, check(period_end>=period_start));
create table expense_recurring_rules (id uuid primary key, spreadsheet_id text not null, category_id uuid not null references expense_categories(id), category_name_at_rule text not null, item_name text not null, amount_won bigint not null check(amount_won>0), frequency text not null default 'monthly' check(frequency='monthly'), anchor_day int not null check(anchor_day between 1 and 31), starts_on date not null, ends_on date, status text not null default 'active' check(status in ('active','paused','archived')), supersedes_rule_id uuid references expense_recurring_rules(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by_email text not null, updated_by_email text not null, check(ends_on is null or ends_on>=starts_on));
create table expense_recurring_occurrences (id uuid primary key, rule_id uuid not null references expense_recurring_rules(id), spreadsheet_id text not null, occurrence_date date not null, occurrence_month date not null, category_id uuid not null references expense_categories(id), category_name_at_occurrence text not null, item_name text not null, amount_won bigint not null check(amount_won>0), status text not null default 'active' check(status in ('active','skipped','voided')), is_override boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by_email text not null, updated_by_email text not null, unique(rule_id,occurrence_month));
create table expense_recurring_skips (id uuid primary key, rule_id uuid not null references expense_recurring_rules(id), spreadsheet_id text not null, occurrence_month date not null, reason text not null default '', created_by_email text not null, created_at timestamptz not null default now(), unique(rule_id,occurrence_month));
create table expense_recurring_pauses (id uuid primary key, rule_id uuid not null references expense_recurring_rules(id), spreadsheet_id text not null, paused_on date not null, resumed_on date, created_by_email text not null, resumed_by_email text, created_at timestamptz not null default now(), resumed_at timestamptz, check(resumed_on is null or resumed_on>=paused_on));
create index expense_entries_scope_period on expense_entries(spreadsheet_id,period_start,period_end) where deleted_at is null;
create index expense_rules_scope on expense_recurring_rules(spreadsheet_id,status,starts_on);
create index expense_occurrences_scope_month on expense_recurring_occurrences(spreadsheet_id,occurrence_month);
create index expense_pauses_scope_rule on expense_recurring_pauses(spreadsheet_id,rule_id,paused_on);
create table expense_schema_migrations(key text primary key,state text not null check(state in ('applying','ready','rollback_required')),script_sha256 text not null,scopes_sha256 text not null,completed_at timestamptz,details jsonb not null default '{}');
insert into expense_schema_migrations(key,state,script_sha256,scopes_sha256,completed_at,details) values('${LIFECYCLE_SCHEMA_KEY}','ready','${EXPENSE_CATEGORY_LIFECYCLE_SQL_SHA256}','fresh',now(),'{"source":"fresh_schema"}');`;

/** 비용 원장 DDL은 기존 DB 파일럿 테이블에 가산만 한다. */
export function ensureExpenseLedgerSchema(): Promise<void> {
  if (migrationFreezeEnabled()) return Promise.resolve();
  if (!ledgerSchemaReady) {
    ledgerSchemaReady = (async () => {
      const lifecyclePool = getDbPool();
      const existing = await lifecyclePool.query("select to_regclass('expense_categories') as categories, to_regclass('expense_schema_migrations') as marker");
      const probe = existing.rows[0] as Row | undefined;
      if (!probe?.categories) {
        await ensureSchema();
        await lifecyclePool.query(FRESH_SCHEMA_SQL);
        return;
      }
      if (!probe.marker) throw new Error("expense_schema_not_ready");
      const ready = await lifecyclePool.query("select state,script_sha256 from expense_schema_migrations where key=$1", [LIFECYCLE_SCHEMA_KEY]);
      const marker = ready.rows[0] as Row | undefined;
      if (marker?.state !== "ready" || marker.script_sha256 !== EXPENSE_CATEGORY_LIFECYCLE_SQL_SHA256) throw new Error("expense_schema_not_ready");
      return;
      await ensureSchema();
      const pool = getDbPool();
      await pool.query(`create table if not exists expense_categories (
        id uuid primary key, spreadsheet_id text not null, name text not null, name_normalized text not null,
        archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        created_by_email text not null, updated_by_email text not null, unique (spreadsheet_id, name_normalized)
      )`);
      await pool.query(`create table if not exists expense_category_audits (
        id uuid primary key, category_id uuid not null references expense_categories(id), spreadsheet_id text not null,
        action text not null check (action in ('created','renamed','archived','restored')),
        previous_name text, next_name text, actor_email text not null, created_at timestamptz not null default now()
      )`);
      await pool.query(`create table if not exists expense_entries (
        id uuid primary key, spreadsheet_id text not null, category_id uuid not null references expense_categories(id),
        category_name_at_entry text not null, item_name text not null, amount_won bigint not null check (amount_won > 0),
        period_start date not null, period_end date not null, deleted_at timestamptz,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        created_by_email text not null, updated_by_email text not null, check (period_end >= period_start)
      )`);
      await pool.query(`create table if not exists expense_recurring_rules (
        id uuid primary key, spreadsheet_id text not null, category_id uuid not null references expense_categories(id),
        category_name_at_rule text not null, item_name text not null, amount_won bigint not null check (amount_won > 0),
        frequency text not null default 'monthly' check (frequency = 'monthly'), anchor_day int not null check (anchor_day between 1 and 31),
        starts_on date not null, ends_on date, status text not null default 'active' check (status in ('active','paused','archived')),
        supersedes_rule_id uuid references expense_recurring_rules(id),
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        created_by_email text not null, updated_by_email text not null, check (ends_on is null or ends_on >= starts_on)
      )`);
      await pool.query(`create table if not exists expense_recurring_occurrences (
        id uuid primary key, rule_id uuid not null references expense_recurring_rules(id), spreadsheet_id text not null,
        occurrence_date date not null, occurrence_month date not null, category_id uuid not null references expense_categories(id),
        category_name_at_occurrence text not null, item_name text not null, amount_won bigint not null check (amount_won > 0),
        status text not null default 'active' check (status in ('active','skipped','voided')), is_override boolean not null default false,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        created_by_email text not null, updated_by_email text not null, unique (rule_id, occurrence_month)
      )`);
      await pool.query(`create table if not exists expense_recurring_skips (
        id uuid primary key, rule_id uuid not null references expense_recurring_rules(id), spreadsheet_id text not null,
        occurrence_month date not null, reason text not null default '', created_by_email text not null,
        created_at timestamptz not null default now(), unique (rule_id, occurrence_month)
      )`);
      await pool.query(`create table if not exists expense_recurring_pauses (
        id uuid primary key, rule_id uuid not null references expense_recurring_rules(id), spreadsheet_id text not null,
        paused_on date not null, resumed_on date, created_by_email text not null, resumed_by_email text,
        created_at timestamptz not null default now(), resumed_at timestamptz,
        check (resumed_on is null or resumed_on >= paused_on)
      )`);
      await Promise.all([
        pool.query("create index if not exists expense_entries_scope_period on expense_entries (spreadsheet_id, period_start, period_end) where deleted_at is null"),
        pool.query("create index if not exists expense_rules_scope on expense_recurring_rules (spreadsheet_id, status, starts_on)"),
        pool.query("create index if not exists expense_occurrences_scope_month on expense_recurring_occurrences (spreadsheet_id, occurrence_month)"),
        pool.query("create index if not exists expense_pauses_scope_rule on expense_recurring_pauses (spreadsheet_id, rule_id, paused_on)"),
      ]);
    })().catch((error) => { ledgerSchemaReady = null; throw error; });
  }
  return ledgerSchemaReady;
}

export function normalizeCategoryName(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}
/** pg `date` 컬럼 → "YYYY-MM-DD".
 *
 * ⚠️ pg-types 는 date(OID 1082)를 **로컬 자정 Date 객체**로 파싱한다. 옛 구현
 * `String(v).slice(0,10)` 은 그 Date 를 "Wed Jul 01" 로 만들어 일할 인식·materialize 를
 * 조용히 0 건으로 만들었다(2026-07-28 P1: 저장은 되는데 조회·계산에 안 잡힘).
 * Date 는 **로컬 게터**로 포맷한다 — toISOString 은 KST(+9)에서 하루 앞당겨진다.
 * 형식이 어긋나면 throw: 조용한 0 보다 시끄러운 실패가 낫다(§0). */
export function isoDateFromDb(v: unknown): string {
  const s = v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
    : String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("expense_invalid_stored_date");
  return s;
}
const iso = isoDateFromDb;
function timestamp(v: unknown): string { return new Date(String(v)).toISOString(); }
function category(row: Row): ExpenseCategory { const deletedAt = row.deleted_at ? timestamp(row.deleted_at) : null; return { id: String(row.id), name: String(row.name), isSystem: row.is_system === true, deletedAt, archivedAt: deletedAt ?? (row.archived_at ? timestamp(row.archived_at) : null), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }; }
function entry(row: Row): ExpenseEntry { return { id: String(row.id), categoryId: String(row.category_id), categoryName: String(row.category_name), itemName: String(row.item_name), amountWon: Number(row.amount_won), periodStart: iso(row.period_start), periodEnd: iso(row.period_end), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }; }
function rule(row: Row): RecurringRule { return { id: String(row.id), categoryId: String(row.category_id), categoryName: String(row.category_name), itemName: String(row.item_name), amountWon: Number(row.amount_won), anchorDay: Number(row.anchor_day), startsOn: iso(row.starts_on), endsOn: row.ends_on ? iso(row.ends_on) : null, status: String(row.status) as RecurringRule["status"], supersedesRuleId: row.supersedes_rule_id ? String(row.supersedes_rule_id) : null, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }; }
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01", "55P03"]);
function sqlState(error: unknown): string | undefined { return (error as { code?: string })?.code; }
function isPostgresClient(client: PoolClient): boolean { return typeof (client as PoolClient & { processID?: unknown }).processID === "number"; }
async function tx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const c = await getDbPool().connect();
    try {
      await c.query("begin");
      if (isPostgresClient(c)) { await c.query("set transaction isolation level serializable"); await c.query("set local lock_timeout='3s'"); }
      const out = await work(c); await c.query("commit"); return out;
    } catch (error) {
      await c.query("rollback").catch(() => {});
      if (!RETRYABLE_SQLSTATES.has(sqlState(error) ?? "")) throw error;
      if (attempt === 3) throw new Error("expense_category_concurrent_change");
      await new Promise((resolve) => setTimeout(resolve, attempt * 11 + Math.floor(Math.random() * 17)));
    } finally { c.release(); }
  }
  throw new Error("expense_category_concurrent_change");
}
async function lockCategories(client: PoolClient, spreadsheetId: string, ids: string[], mode: "update" | "key share" = "update"): Promise<Row[]> {
  const ordered = [...new Set(ids)].sort();
  const r = await client.query(`select * from expense_categories where spreadsheet_id=$1 and id=any($2::uuid[]) order by id for ${mode}`, [spreadsheetId, ordered]);
  return r.rows as Row[];
}
async function activeCategory(client: PoolClient, spreadsheetId: string, categoryId: string): Promise<Row> {
  const rows = await lockCategories(client, spreadsheetId, [categoryId], "key share");
  const row = rows[0];
  if (!row || row.archived_at || row.deleted_at) throw new Error("expense_category_not_found");
  return row;
}
async function lockRuleCategory(client: PoolClient, spreadsheetId: string, ruleId: string, extra: string[] = []): Promise<string | null> { const exists = await client.query("select id,status from expense_recurring_rules where id=$1 and spreadsheet_id=$2", [ruleId, spreadsheetId]); if (!exists.rows[0]) throw new Error("expense_rule_not_found"); if (!isPostgresClient(client)) return null; const found = await client.query("select category_id from expense_recurring_rules where id=$1 and spreadsheet_id=$2", [ruleId, spreadsheetId]); if (!found.rows[0]) throw new Error("expense_rule_not_found"); const categoryId = String((found.rows[0] as Row).category_id); await lockCategories(client, spreadsheetId, [categoryId, ...extra], "key share"); return categoryId; }
async function revalidateRuleCategory(client: PoolClient, spreadsheetId: string, ruleId: string, expected: string | null): Promise<void> { if (!expected) return; const current = await client.query("select category_id from expense_recurring_rules where id=$1 and spreadsheet_id=$2", [ruleId, spreadsheetId]); if (String((current.rows[0] as Row | undefined)?.category_id) !== expected) throw new Error("expense_category_concurrent_change"); }
async function ensureUnclassifiedCategory(client: PoolClient, spreadsheetId: string, actorEmail: string): Promise<Row> {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`${spreadsheetId}:expense-unclassified-r6`]);
  const found = await client.query("select * from expense_categories where spreadsheet_id=$1 and system_key='unclassified' for update", [spreadsheetId]);
  if (found.rows[0]) return found.rows[0] as Row;
  const id = randomUUID();
  const inserted = await client.query("insert into expense_categories(id,spreadsheet_id,name,name_normalized,is_system,system_key,created_by_email,updated_by_email) values($1,$2,'미분류','미분류',true,'unclassified',$3,$3) returning *", [id, spreadsheetId, actorEmail]);
  await client.query("insert into expense_category_audits(id,category_id,spreadsheet_id,action,next_name,actor_email,prior_category_state) values($1,$2,$3,'system_bootstrapped','미분류',$4,'{}'::jsonb)", [randomUUID(), id, spreadsheetId, actorEmail]);
  return inserted.rows[0] as Row;
}
function duplicateError(error: unknown): never {
  const constraint = (error as { constraint?: string })?.constraint;
  if (sqlState(error) === "23505" && ["expense_categories_active_name_uq", "expense_categories_spreadsheet_id_name_normalized_key"].includes(constraint ?? "")) throw new Error("expense_category_duplicate");
  throw error;
}

export async function listExpenseCategories(spreadsheetId: string, includeArchived = false): Promise<ExpenseCategory[]> { requiredDb(); await ensureExpenseLedgerSchema(); const r = await readExistingSnapshot(() => getDbPool().query(`select * from expense_categories where spreadsheet_id=$1 ${includeArchived ? "" : "and deleted_at is null and archived_at is null"} order by deleted_at nulls first,archived_at nulls first,name_normalized`, [spreadsheetId])); return r.rows.map((x) => category(x as Row)); }
export async function createExpenseCategory(spreadsheetId: string, actorEmail: string, name: string): Promise<ExpenseCategory> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { await ensureUnclassifiedCategory(c, spreadsheetId, actorEmail); const id = randomUUID(); const normalized = normalizeCategoryName(name); try { const r = await c.query("insert into expense_categories(id,spreadsheet_id,name,name_normalized,created_by_email,updated_by_email) values($1,$2,$3,$4,$5,$5) returning *", [id, spreadsheetId, name.trim(), normalized, actorEmail]); await c.query("insert into expense_category_audits(id,category_id,spreadsheet_id,action,next_name,actor_email) values($1,$2,$3,'created',$4,$5)", [randomUUID(), id, spreadsheetId, name.trim(), actorEmail]); return category(r.rows[0] as Row); } catch (error) { return duplicateError(error); } }); }
export async function patchExpenseCategory(spreadsheetId: string, actorEmail: string, id: string, patch: { name?: string; archived?: boolean }): Promise<ExpenseCategory> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); if (patch.archived !== undefined || patch.name === undefined) throw new Error("invalid_request"); const requestedName = patch.name; return tx(async (c) => { const rows = await lockCategories(c, spreadsheetId, [id]); const previous = rows[0]; if (!previous) throw new Error("expense_category_not_found"); if (previous.is_system === true) throw new Error("expense_category_system_immutable"); if (previous.deleted_at) throw new Error("expense_category_deleted"); if (previous.archived_at) throw new Error("expense_category_not_found"); const nextName = requestedName.trim(); try { const r = await c.query("update expense_categories set name=$3,name_normalized=$4,updated_at=now(),updated_by_email=$5 where id=$1 and spreadsheet_id=$2 returning *", [id, spreadsheetId, nextName, normalizeCategoryName(nextName), actorEmail]); if (nextName !== String(previous.name)) await c.query("insert into expense_category_audits(id,category_id,spreadsheet_id,action,previous_name,next_name,actor_email) values($1,$2,$3,'renamed',$4,$5,$6)", [randomUUID(), id, spreadsheetId, String(previous.name), nextName, actorEmail]); return category(r.rows[0] as Row); } catch (error) { return duplicateError(error); } }); }

export async function getExpenseCategoryUsage(spreadsheetId: string, id: string): Promise<ExpenseCategoryUsage> {
  requiredDb(); await ensureExpenseLedgerSchema();
  const r = await getDbPool().query(`select c.*,
    (select count(*)::int from expense_entries e where e.spreadsheet_id=c.spreadsheet_id and e.category_id=c.id) entry_count,
    (select count(*)::int from expense_recurring_rules rr where rr.spreadsheet_id=c.spreadsheet_id and rr.category_id=c.id) rule_count,
    (select count(*)::int from expense_recurring_occurrences o where o.spreadsheet_id=c.spreadsheet_id and o.category_id=c.id) occurrence_count,
    (select count(*)::int from expense_recurring_occurrences o where o.spreadsheet_id=c.spreadsheet_id and o.category_id=c.id and o.is_override) override_count
    from expense_categories c where c.id=$1 and c.spreadsheet_id=$2`, [id, spreadsheetId]);
  const row = r.rows[0] as Row | undefined;
  if (!row) throw new Error("expense_category_not_found");
  if (row.is_system === true) throw new Error("expense_category_system_immutable");
  if (row.deleted_at || row.archived_at) throw new Error("expense_category_deleted");
  const entryCount = Number(row.entry_count); const ruleCount = Number(row.rule_count); const occurrenceCount = Number(row.occurrence_count);
  return { category: { id, name: String(row.name), isSystem: false, deletedAt: null }, usage: { entryCount, ruleCount, occurrenceCount, overrideOccurrenceCount: Number(row.override_count), totalCount: entryCount + ruleCount + occurrenceCount } };
}

function deleteResult(row: Row, categoryId: string): DeleteExpenseCategoryResult {
  return { ok: true, deletedCategoryId: categoryId, unclassifiedCategoryId: String(row.target_category_id), movedEntryCount: Number(row.moved_entry_count), movedRuleCount: Number(row.moved_rule_count), movedOccurrenceCount: Number(row.moved_occurrence_count) };
}

export async function deleteExpenseCategory(spreadsheetId: string, actorEmail: string, id: string): Promise<DeleteExpenseCategoryResult> {
  requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema();
  return tx(async (c) => {
    const replay = await c.query("select * from expense_category_audits where spreadsheet_id=$1 and category_id=$2 and action='deleted' and terminal_deleted order by created_at limit 1", [spreadsheetId, id]);
    if (replay.rows[0]) return deleteResult(replay.rows[0] as Row, id);
    const unclassified = await ensureUnclassifiedCategory(c, spreadsheetId, actorEmail);
    const categories = await lockCategories(c, spreadsheetId, [id, String(unclassified.id)]);
    const source = categories.find((x) => String(x.id) === id);
    const target = categories.find((x) => String(x.id) === String(unclassified.id));
    if (!source) throw new Error("expense_category_not_found");
    if (source.is_system === true) throw new Error("expense_category_system_immutable");
    if (source.deleted_at || source.archived_at) throw new Error("expense_category_deleted");
    if (!target) throw new Error("expense_ledger_failed");
    const entries = await c.query("select id,category_name_at_entry from expense_entries where spreadsheet_id=$1 and category_id=$2 order by id for update", [spreadsheetId, id]);
    const rules = await c.query("select id,category_name_at_rule from expense_recurring_rules where spreadsheet_id=$1 and category_id=$2 order by id for update", [spreadsheetId, id]);
    const occurrences = await c.query("select id,category_name_at_occurrence,is_override from expense_recurring_occurrences where spreadsheet_id=$1 and category_id=$2 order by id for update", [spreadsheetId, id]);
    const captured = await c.query("select transaction_timestamp() as at"); const at = (captured.rows[0] as Row).at;
    const auditId = randomUUID();
    const terminal = await c.query("insert into expense_category_audits(id,category_id,spreadsheet_id,action,previous_name,next_name,target_category_id,terminal_deleted,prior_category_state,moved_entry_count,moved_rule_count,moved_occurrence_count,actor_email,created_at) values($1,$2,$3,'deleted',$4,'미분류',$5,true,$6::jsonb,$7,$8,$9,$10,$11) on conflict(spreadsheet_id,category_id) where action in ('deleted','legacy_migrated') and terminal_deleted do nothing returning id", [auditId, id, spreadsheetId, String(source.name), String(target.id), JSON.stringify({ name: source.name, nameNormalized: source.name_normalized, archivedAt: source.archived_at ?? null, deletedAt: null }), entries.rowCount, rules.rowCount, occurrences.rowCount, actorEmail, at]);
    if (!terminal.rowCount) throw Object.assign(new Error("expense_category_concurrent_change"), { code: "40001" });
    for (const item of entries.rows as Row[]) await c.query("insert into expense_category_audit_items(audit_id,entity_kind,entity_id,previous_category_id,previous_category_name) values($1,'entry',$2,$3,$4)", [auditId, item.id, id, item.category_name_at_entry]);
    for (const item of rules.rows as Row[]) await c.query("insert into expense_category_audit_items(audit_id,entity_kind,entity_id,previous_category_id,previous_category_name) values($1,'recurring_rule',$2,$3,$4)", [auditId, item.id, id, item.category_name_at_rule]);
    for (const item of occurrences.rows as Row[]) await c.query("insert into expense_category_audit_items(audit_id,entity_kind,entity_id,previous_category_id,previous_category_name,previous_is_override) values($1,'recurring_occurrence',$2,$3,$4,$5)", [auditId, item.id, id, item.category_name_at_occurrence, item.is_override]);
    const movedEntries = await c.query("update expense_entries set category_id=$3,category_name_at_entry='미분류',updated_at=$4,updated_by_email=$5 where spreadsheet_id=$1 and category_id=$2", [spreadsheetId, id, target.id, at, actorEmail]);
    const movedRules = await c.query("update expense_recurring_rules set category_id=$3,category_name_at_rule='미분류',updated_at=$4,updated_by_email=$5 where spreadsheet_id=$1 and category_id=$2", [spreadsheetId, id, target.id, at, actorEmail]);
    const movedOccurrences = await c.query("update expense_recurring_occurrences set category_id=$3,category_name_at_occurrence='미분류',updated_at=$4,updated_by_email=$5 where spreadsheet_id=$1 and category_id=$2", [spreadsheetId, id, target.id, at, actorEmail]);
    const tombstone = await c.query("update expense_categories set deleted_at=$3,archived_at=coalesce(archived_at,$3),deleted_by=$4,updated_at=$3,updated_by_email=$4 where id=$1 and spreadsheet_id=$2", [id, spreadsheetId, at, actorEmail]);
    if (movedEntries.rowCount !== entries.rowCount || movedRules.rowCount !== rules.rowCount || movedOccurrences.rowCount !== occurrences.rowCount || tombstone.rowCount !== 1) throw new Error("expense_category_concurrent_change");
    return { ok: true, deletedCategoryId: id, unclassifiedCategoryId: String(target.id), movedEntryCount: entries.rowCount ?? 0, movedRuleCount: rules.rowCount ?? 0, movedOccurrenceCount: occurrences.rowCount ?? 0 };
  });
}

function reclassResult(row: Row, operationId: string): ReclassifyUnclassifiedResult {
  return { ok: true, operationId, unclassifiedCategoryId: String(row.category_id), targetCategoryId: String(row.target_category_id), movedEntryCount: Number(row.moved_entry_count), movedRuleCount: Number(row.moved_rule_count), movedOccurrenceCount: Number(row.moved_occurrence_count) };
}

export async function reclassifyUnclassified(spreadsheetId: string, actorEmail: string, operationId: string, requestHash: string, targetCategoryId: string, refs: ExpenseReclassificationRef[]): Promise<ReclassifyUnclassifiedResult> {
  requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema();
  return tx(async (c) => {
    const replay = await c.query("select * from expense_category_audits where spreadsheet_id=$1 and operation_key=$2", [spreadsheetId, operationId]);
    if (replay.rows[0]) {
      const old = replay.rows[0] as Row;
      if (old.request_hash !== requestHash) throw new Error("expense_idempotency_conflict");
      return reclassResult(old, operationId);
    }
    const source = await ensureUnclassifiedCategory(c, spreadsheetId, actorEmail);
    const cats = await lockCategories(c, spreadsheetId, [String(source.id), targetCategoryId]);
    const target = cats.find((x) => String(x.id) === targetCategoryId);
    if (!target) throw new Error("expense_target_category_not_found");
    if (target.is_system === true) throw new Error("expense_category_system_immutable");
    if (target.deleted_at || target.archived_at) throw new Error("expense_category_deleted");
    const entryIds = refs.filter((x) => x.kind === "entry").map((x) => x.id).sort();
    const ruleIds = refs.filter((x) => x.kind === "recurringRule").map((x) => x.id).sort();
    const occurrenceIds = refs.filter((x) => x.kind === "recurringOccurrence").map((x) => x.id).sort();
    const entries = await c.query("select id,category_id,category_name_at_entry,deleted_at from expense_entries where spreadsheet_id=$1 and id=any($2::uuid[]) order by id for update", [spreadsheetId, entryIds]);
    const rules = await c.query("select id,category_id,category_name_at_rule from expense_recurring_rules where spreadsheet_id=$1 and id=any($2::uuid[]) order by id for update", [spreadsheetId, ruleIds]);
    const occurrences = await c.query("select id,rule_id,category_id,category_name_at_occurrence,is_override from expense_recurring_occurrences where spreadsheet_id=$1 and (id=any($2::uuid[]) or (rule_id=any($3::uuid[]) and category_id=$4 and is_override=false)) order by id for update", [spreadsheetId, occurrenceIds, ruleIds, source.id]);
    if (entries.rowCount !== entryIds.length || rules.rowCount !== ruleIds.length || !occurrenceIds.every((id) => (occurrences.rows as Row[]).some((x) => String(x.id) === id))) throw new Error("expense_reclassification_ref_not_found");
    if ((entries.rows as Row[]).some((x) => x.deleted_at || x.category_id !== source.id) || (rules.rows as Row[]).some((x) => x.category_id !== source.id) || (occurrences.rows as Row[]).some((x) => x.category_id !== source.id)) throw new Error("expense_reclassification_source_mismatch");
    const explicitOccurrences = new Set(occurrenceIds);
    if ((occurrences.rows as Row[]).some((x) => explicitOccurrences.has(String(x.id)) && ruleIds.includes(String(x.rule_id)) && x.is_override === false)) throw new Error("expense_reclassification_overlap");
    const auditId = randomUUID();
    const audit = await c.query("insert into expense_category_audits(id,category_id,spreadsheet_id,action,previous_name,next_name,target_category_id,operation_key,request_hash,moved_entry_count,moved_rule_count,moved_occurrence_count,actor_email) values($1,$2,$3,'reclassified','미분류',$4,$5,$6,$7,$8,$9,$10,$11) on conflict(spreadsheet_id,operation_key) where operation_key is not null do nothing returning id", [auditId, source.id, spreadsheetId, target.name, target.id, operationId, requestHash, entries.rowCount, rules.rowCount, occurrences.rowCount, actorEmail]);
    if (!audit.rowCount) throw Object.assign(new Error("expense_category_concurrent_change"), { code: "40001" });
    for (const item of entries.rows as Row[]) await c.query("insert into expense_category_audit_items(audit_id,entity_kind,entity_id,previous_category_id,previous_category_name) values($1,'entry',$2,$3,$4)", [auditId, item.id, source.id, item.category_name_at_entry]);
    for (const item of rules.rows as Row[]) await c.query("insert into expense_category_audit_items(audit_id,entity_kind,entity_id,previous_category_id,previous_category_name) values($1,'recurring_rule',$2,$3,$4)", [auditId, item.id, source.id, item.category_name_at_rule]);
    for (const item of occurrences.rows as Row[]) await c.query("insert into expense_category_audit_items(audit_id,entity_kind,entity_id,previous_category_id,previous_category_name,previous_is_override) values($1,'recurring_occurrence',$2,$3,$4,$5)", [auditId, item.id, source.id, item.category_name_at_occurrence, item.is_override]);
    const movedEntries = await c.query("update expense_entries set category_id=$3,category_name_at_entry=$4,updated_at=now(),updated_by_email=$5 where spreadsheet_id=$1 and id=any($2::uuid[])", [spreadsheetId, entryIds, target.id, target.name, actorEmail]);
    const movedRules = await c.query("update expense_recurring_rules set category_id=$3,category_name_at_rule=$4,updated_at=now(),updated_by_email=$5 where spreadsheet_id=$1 and id=any($2::uuid[])", [spreadsheetId, ruleIds, target.id, target.name, actorEmail]);
    const allOccurrenceIds = (occurrences.rows as Row[]).map((x) => String(x.id));
    const movedOccurrences = await c.query("update expense_recurring_occurrences set category_id=$3,category_name_at_occurrence=$4,is_override=case when id=any($5::uuid[]) then true else is_override end,updated_at=now(),updated_by_email=$6 where spreadsheet_id=$1 and id=any($2::uuid[])", [spreadsheetId, allOccurrenceIds, target.id, target.name, occurrenceIds, actorEmail]);
    if (movedEntries.rowCount !== entries.rowCount || movedRules.rowCount !== rules.rowCount || movedOccurrences.rowCount !== occurrences.rowCount) throw new Error("expense_category_concurrent_change");
    return { ok: true, operationId, unclassifiedCategoryId: String(source.id), targetCategoryId: String(target.id), movedEntryCount: entries.rowCount ?? 0, movedRuleCount: rules.rowCount ?? 0, movedOccurrenceCount: occurrences.rowCount ?? 0 };
  });
}

export async function createExpenseEntry(spreadsheetId: string, actorEmail: string, input: CreateExpenseBody): Promise<ExpenseEntry> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const cat = await activeCategory(c, spreadsheetId, input.categoryId); const end = input.periodEnd ?? input.periodStart; const r = await c.query("insert into expense_entries (id,spreadsheet_id,category_id,category_name_at_entry,item_name,amount_won,period_start,period_end,created_by_email,updated_by_email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) returning *, $4 as category_name", [randomUUID(), spreadsheetId, input.categoryId, String(cat.name), input.itemName.trim(), input.amountWon, input.periodStart, end, actorEmail]); return entry(r.rows[0] as Row); }); }
export async function patchExpenseEntry(spreadsheetId: string, actorEmail: string, id: string, patch: Partial<CreateExpenseBody>): Promise<ExpenseEntry> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const discovered = await c.query("select category_id from expense_entries where id=$1 and spreadsheet_id=$2 and deleted_at is null", [id, spreadsheetId]); if (!discovered.rows[0]) throw new Error("expense_entry_not_found"); const categoryId = patch.categoryId ?? String((discovered.rows[0] as Row).category_id); const cats = await lockCategories(c, spreadsheetId, [String((discovered.rows[0] as Row).category_id), categoryId], "key share"); const cat = cats.find((x) => String(x.id) === categoryId); if (!cat || cat.deleted_at || cat.archived_at) throw new Error("expense_category_not_found"); const existing = await c.query("select * from expense_entries where id=$1 and spreadsheet_id=$2 and deleted_at is null for update", [id, spreadsheetId]); if (!existing.rows[0] || String((existing.rows[0] as Row).category_id) !== String((discovered.rows[0] as Row).category_id)) throw new Error("expense_category_concurrent_change"); const before = existing.rows[0] as Row; const start = patch.periodStart ?? iso(before.period_start); const end = patch.periodEnd ?? (patch.periodStart ? patch.periodStart : iso(before.period_end)); if (end < start) throw new Error("expense_invalid_period"); const r = await c.query("update expense_entries set category_id=$3,category_name_at_entry=$4,item_name=$5,amount_won=$6,period_start=$7,period_end=$8,updated_at=now(),updated_by_email=$9 where id=$1 and spreadsheet_id=$2 returning *, $4 as category_name", [id, spreadsheetId, categoryId, String(cat.name), patch.itemName?.trim() ?? String(before.item_name), patch.amountWon ?? Number(before.amount_won), start, end, actorEmail]); return entry(r.rows[0] as Row); }); }
export async function deleteExpenseEntry(spreadsheetId: string, actorEmail: string, id: string): Promise<void> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { const discovered = await c.query("select category_id from expense_entries where id=$1 and spreadsheet_id=$2 and deleted_at is null", [id, spreadsheetId]); if (!discovered.rows[0]) throw new Error("expense_entry_not_found"); await lockCategories(c, spreadsheetId, [String((discovered.rows[0] as Row).category_id)], "key share"); const locked = await c.query("select id,category_id from expense_entries where id=$1 and spreadsheet_id=$2 and deleted_at is null for update", [id, spreadsheetId]); if (!locked.rows[0] || String((locked.rows[0] as Row).category_id) !== String((discovered.rows[0] as Row).category_id)) throw new Error("expense_category_concurrent_change"); const r = await c.query("update expense_entries set deleted_at=now(),updated_at=now(),updated_by_email=$3 where id=$1 and spreadsheet_id=$2 and deleted_at is null", [id, spreadsheetId, actorEmail]); if (r.rowCount !== 1) throw new Error("expense_entry_not_found"); }); }
export async function listExpenseEntries(spreadsheetId: string): Promise<ExpenseEntry[]> { requiredDb(); await ensureExpenseLedgerSchema(); const r = await readExistingSnapshot(() => getDbPool().query("select e.*, c.name as category_name from expense_entries e join expense_categories c on c.id=e.category_id where e.spreadsheet_id=$1 and e.deleted_at is null order by e.period_start,e.created_at", [spreadsheetId])); return r.rows.map((x) => entry(x as Row)); }

export async function createRecurringRule(spreadsheetId: string, actorEmail: string, input: CreateRecurringRuleBody): Promise<RecurringRule> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const cat = await activeCategory(c, spreadsheetId, input.categoryId); const r = await c.query("insert into expense_recurring_rules (id,spreadsheet_id,category_id,category_name_at_rule,item_name,amount_won,anchor_day,starts_on,ends_on,created_by_email,updated_by_email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) returning *, $4 as category_name", [randomUUID(), spreadsheetId, input.categoryId, String(cat.name), input.itemName.trim(), input.amountWon, input.anchorDay, input.startsOn, input.endsOn ?? null, actorEmail]); return rule(r.rows[0] as Row); }); }
export async function listRecurringRules(spreadsheetId: string): Promise<RecurringRule[]> { requiredDb(); await ensureExpenseLedgerSchema(); const r = await readExistingSnapshot(() => getDbPool().query("select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.spreadsheet_id=$1 order by r.starts_on", [spreadsheetId])); return r.rows.map((x) => rule(x as Row)); }

type RecurringRuleAction = "archive" | "pause" | "resume" | "split";

/** archived is terminal. All callers invoke this only after locking the rule row. */
export function recurringRuleStatusAfterAction(
  status: RecurringRule["status"],
  action: RecurringRuleAction,
): RecurringRule["status"] {
  if (status === "archived" && action !== "archive") throw new Error("expense_rule_not_found");
  if (action === "archive") return "archived";
  if (action === "split") return status;
  if (action === "pause") {
    if (status !== "active") throw new Error("expense_rule_not_found");
    return "paused";
  }
  if (status !== "paused") throw new Error("expense_pause_not_found");
  return "active";
}

export function isRecurringRuleMaterializable(status: RecurringRule["status"]): boolean {
  return status === "active";
}

export async function pauseRecurringRule(spreadsheetId: string, actorEmail: string, id: string, pausedOn: string): Promise<RecurringRule> {
  requireLedgerWritable();
  requiredDb();
  await ensureExpenseLedgerSchema();
  return tx(async (c) => {
    const discoveredCategoryId = await lockRuleCategory(c, spreadsheetId, id);
    const locked = await c.query(
      "select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.id=$1 and r.spreadsheet_id=$2 for update of r",
      [id, spreadsheetId],
    );
    if (!locked.rows[0]) throw new Error("expense_rule_not_found");
    await revalidateRuleCategory(c, spreadsheetId, id, discoveredCategoryId);
    const current = rule(locked.rows[0] as Row);
    const nextStatus = recurringRuleStatusAfterAction(current.status, "pause");
    const updated = await c.query(
      "update expense_recurring_rules set status=$3,updated_at=now(),updated_by_email=$4 where id=$1 and spreadsheet_id=$2 and status='active' returning *",
      [id, spreadsheetId, nextStatus, actorEmail],
    );
    if (!updated.rows[0]) throw new Error("expense_rule_not_found");
    await c.query(
      "insert into expense_recurring_pauses (id,rule_id,spreadsheet_id,paused_on,created_by_email) values ($1,$2,$3,$4,$5)",
      [randomUUID(), id, spreadsheetId, pausedOn, actorEmail],
    );
    return rule({ ...(updated.rows[0] as Row), category_name: current.categoryName });
  });
}

export async function resumeRecurringRule(spreadsheetId: string, actorEmail: string, id: string, resumedOn: string): Promise<RecurringRule> {
  requireLedgerWritable();
  requiredDb();
  await ensureExpenseLedgerSchema();
  return tx(async (c) => {
    const discoveredCategoryId = await lockRuleCategory(c, spreadsheetId, id);
    const locked = await c.query(
      "select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.id=$1 and r.spreadsheet_id=$2 for update of r",
      [id, spreadsheetId],
    );
    if (!locked.rows[0]) throw new Error("expense_rule_not_found");
    await revalidateRuleCategory(c, spreadsheetId, id, discoveredCategoryId);
    const current = rule(locked.rows[0] as Row);
    const nextStatus = recurringRuleStatusAfterAction(current.status, "resume");
    const pause = await c.query(
      "select id from expense_recurring_pauses where rule_id=$1 and spreadsheet_id=$2 and resumed_on is null order by paused_on desc limit 1 for update",
      [id, spreadsheetId],
    );
    if (!pause.rows[0]) throw new Error("expense_pause_not_found");
    const closed = await c.query(
      "update expense_recurring_pauses set resumed_on=$3,resumed_by_email=$4,resumed_at=now() where id=$1 and spreadsheet_id=$2 and paused_on <= $3::date",
      [String((pause.rows[0] as Row).id), spreadsheetId, resumedOn, actorEmail],
    );
    if (closed.rowCount !== 1) throw new Error("expense_invalid_resume_date");
    const updated = await c.query(
      "update expense_recurring_rules set status=$3,updated_at=now(),updated_by_email=$4 where id=$1 and spreadsheet_id=$2 and status='paused' returning *",
      [id, spreadsheetId, nextStatus, actorEmail],
    );
    if (!updated.rows[0]) throw new Error("expense_rule_not_found");
    return rule({ ...(updated.rows[0] as Row), category_name: current.categoryName });
  });
}

/** 반복 삭제는 과거·중지 당일 발생을 보존하고, 이후 발생만 무효화하는 soft stop이다. */
export async function archiveRecurringRule(spreadsheetId: string, actorEmail: string, id: string, stoppedOn: string): Promise<void> {
  requireLedgerWritable();
  requiredDb();
  await ensureExpenseLedgerSchema();
  await tx(async (c) => {
    const discoveredCategoryId = await lockRuleCategory(c, spreadsheetId, id);
    const locked = await c.query(
      "select id,status from expense_recurring_rules where id=$1 and spreadsheet_id=$2 for update",
      [id, spreadsheetId],
    );
    if (!locked.rows[0]) throw new Error("expense_rule_not_found");
    await revalidateRuleCategory(c, spreadsheetId, id, discoveredCategoryId);
    recurringRuleStatusAfterAction(String((locked.rows[0] as Row).status) as RecurringRule["status"], "archive");
    if (isPostgresClient(c)) await c.query("select id from expense_recurring_occurrences where rule_id=$1 and spreadsheet_id=$2 order by id for update", [id, spreadsheetId]);
    await c.query(
      `update expense_recurring_rules
       set status='archived',
           ends_on=case
             when starts_on <= $3::date and (ends_on is null or ends_on > $3::date) then $3::date
             else ends_on
           end,
           updated_at=now(),updated_by_email=$4
      where id=$1 and spreadsheet_id=$2`,
      [id, spreadsheetId, stoppedOn, actorEmail],
    );
    await c.query(
      `update expense_recurring_pauses
       set resumed_on=greatest(paused_on,$3::date),resumed_by_email=$4,resumed_at=now()
       where rule_id=$1 and spreadsheet_id=$2 and resumed_on is null`,
      [id, spreadsheetId, stoppedOn, actorEmail],
    );
    await c.query(
      `update expense_recurring_occurrences
       set status='voided',updated_at=now(),updated_by_email=$4
       where rule_id=$1 and spreadsheet_id=$2 and occurrence_date > $3::date and status <> 'voided'`,
      [id, spreadsheetId, stoppedOn, actorEmail],
    );
  });
}

function lastDay(year: number, month: number): number { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
export function occurrenceDateForMonth(month: string, anchorDay: number): string { const [y, m] = month.split("-").map(Number); const day = Math.min(anchorDay, lastDay(y!, m!)); return `${month}-${String(day).padStart(2, "0")}`; }
/** materializer SQL의 pause 구간 판정과 동일한 순수 규칙(테스트/감사용). resumedOn 당일부터 재개한다. */
export function isOccurrencePaused(date: string, intervals: Array<{ pausedOn: string; resumedOn: string | null }>): boolean { return intervals.some((p) => p.pausedOn <= date && (p.resumedOn === null || date < p.resumedOn)); }
/** startsOn/endsOn은 모두 포함 경계다. */
export function isOccurrenceWithinRuleWindow(date: string, startsOn: string, endsOn: string | null): boolean { return date >= startsOn && (!endsOn || date <= endsOn); }
/** stop 당일은 이미 인식된 비용으로 보존하고 다음 날부터 무효화한다. */
export function shouldVoidRecurringOccurrenceOnStop(occurrenceDate: string, stoppedOn: string): boolean { return occurrenceDate > stoppedOn; }
/** split 시 옛 규칙이 닫히는 날 = 새 규칙 발효일의 하루 전. 이 날 **이후** occurrence 는 무효화 대상
 *  (shouldVoidRecurringOccurrenceOnStop 과 같은 경계). 없으면 같은 달 이중 계상 — #625 blocker ③. */
export function closeDateBeforeSplit(effectiveDate: string): string { const d = new Date(`${effectiveDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function monthsBetween(startMonth: string, endMonth: string): string[] { const [sy, sm] = startMonth.split("-").map(Number); const [ey, em] = endMonth.split("-").map(Number); const out: string[] = []; for (let y = sy!, m = sm!; y < ey! || (y === ey! && m <= em!); ) { out.push(`${y}-${String(m).padStart(2, "0")}`); m += 1; if (m === 13) { y += 1; m = 1; } } return out; }
export async function materializeOccurrences(spreadsheetId: string, actorEmail: string, throughMonth: string): Promise<void> { if (migrationFreezeEnabled()) return; requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { let categoryIds: string[] | null = null; if (isPostgresClient(c)) { const discovered = await c.query("select distinct category_id from expense_recurring_rules where spreadsheet_id=$1 and status='active' and starts_on < (($2 || '-01')::date + interval '1 month')", [spreadsheetId, throughMonth]); categoryIds = (discovered.rows as Row[]).map((x) => String(x.category_id)); await lockCategories(c, spreadsheetId, categoryIds, "key share"); } const rules = await c.query("select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.spreadsheet_id=$1 and r.status='active' and r.starts_on < (($2 || '-01')::date + interval '1 month') for update of r", [spreadsheetId, throughMonth]); if (categoryIds && (rules.rows as Row[]).some((x) => !categoryIds.includes(String(x.category_id)))) throw new Error("expense_category_concurrent_change"); for (const raw of rules.rows as Row[]) { const r = rule(raw); if (!isRecurringRuleMaterializable(r.status)) continue; const startMonth = r.startsOn.slice(0, 7); for (const month of monthsBetween(startMonth, throughMonth)) { const date = occurrenceDateForMonth(month, r.anchorDay); if (!isOccurrenceWithinRuleWindow(date, r.startsOn, r.endsOn)) continue; const paused = await c.query("select 1 from expense_recurring_pauses where rule_id=$1 and spreadsheet_id=$2 and paused_on <= $3::date and (resumed_on is null or $3::date < resumed_on) limit 1", [r.id, spreadsheetId, date]); if (paused.rows[0]) continue; const skipped = await c.query("select 1 from expense_recurring_skips where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [r.id, spreadsheetId, month]); if (skipped.rows[0]) continue; await c.query("insert into expense_recurring_occurrences (id,rule_id,spreadsheet_id,occurrence_date,occurrence_month,category_id,category_name_at_occurrence,item_name,amount_won,created_by_email,updated_by_email) values ($1,$2,$3,$4,($5 || '-01')::date,$6,$7,$8,$9,$10,$10) on conflict (rule_id,occurrence_month) do nothing", [randomUUID(), r.id, spreadsheetId, date, month, r.categoryId, r.categoryName, r.itemName, r.amountWon, actorEmail]); } } }); }
export async function skipRecurringOccurrence(spreadsheetId: string, actorEmail: string, ruleId: string, occurrenceMonth: string): Promise<void> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { const discoveredCategoryId = await lockRuleCategory(c, spreadsheetId, ruleId); const own = await c.query("select anchor_day,starts_on,ends_on,status,category_id from expense_recurring_rules where id=$1 and spreadsheet_id=$2 for update", [ruleId, spreadsheetId]); if (!own.rows[0]) throw new Error("expense_rule_not_found"); const row = own.rows[0] as Row; if (discoveredCategoryId && String(row.category_id) !== discoveredCategoryId) throw new Error("expense_category_concurrent_change"); const occurrenceDate = occurrenceDateForMonth(occurrenceMonth, Number(row.anchor_day)); if (String(row.status) === "archived" || !isOccurrenceWithinRuleWindow(occurrenceDate, iso(row.starts_on), row.ends_on ? iso(row.ends_on) : null)) throw new Error("expense_occurrence_not_found"); await c.query("insert into expense_recurring_skips (id,rule_id,spreadsheet_id,occurrence_month,created_by_email) values ($1,$2,$3,($4 || '-01')::date,$5) on conflict (rule_id,occurrence_month) do nothing", [randomUUID(), ruleId, spreadsheetId, occurrenceMonth, actorEmail]); await c.query("update expense_recurring_occurrences set status='skipped',updated_at=now(),updated_by_email=$4 where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [ruleId, spreadsheetId, occurrenceMonth, actorEmail]); }); }

export async function listRecurringOccurrences(spreadsheetId: string): Promise<Array<{ id: string; ruleId: string; categoryId: string; categoryName: string; itemName: string; amountWon: number; occurrenceDate: string; occurrenceMonth: string; status: "active" | "skipped" | "voided"; isOverride: boolean }>> { requiredDb(); await ensureExpenseLedgerSchema(); const r = await readExistingSnapshot(() => getDbPool().query("select o.*,c.name as category_name from expense_recurring_occurrences o join expense_categories c on c.id=o.category_id where o.spreadsheet_id=$1 order by o.occurrence_date", [spreadsheetId])); return (r.rows as Row[]).map((x) => ({ id: String(x.id), ruleId: String(x.rule_id), categoryId: String(x.category_id), categoryName: String(x.category_name), itemName: String(x.item_name), amountWon: Number(x.amount_won), occurrenceDate: iso(x.occurrence_date), occurrenceMonth: iso(x.occurrence_month).slice(0, 7), status: String(x.status) as "active" | "skipped" | "voided", isOverride: x.is_override === true })); }

export async function patchRecurringOccurrence(spreadsheetId: string, actorEmail: string, ruleId: string, occurrenceMonth: string, patch: { categoryId?: string; itemName?: string; amountWon?: number }): Promise<void> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { const discovered = await c.query("select category_id from expense_recurring_occurrences where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [ruleId, spreadsheetId, occurrenceMonth]); if (!discovered.rows[0]) throw new Error("expense_occurrence_not_found"); const previousCategoryId = String((discovered.rows[0] as Row).category_id); const categoryId = patch.categoryId ?? previousCategoryId; const cats = await lockCategories(c, spreadsheetId, [previousCategoryId, categoryId], "key share"); const cat = cats.find((x) => String(x.id) === categoryId); if (!cat || cat.deleted_at || cat.archived_at) throw new Error("expense_category_not_found"); const old = await c.query("select * from expense_recurring_occurrences where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date for update", [ruleId, spreadsheetId, occurrenceMonth]); if (!old.rows[0] || String((old.rows[0] as Row).category_id) !== previousCategoryId) throw new Error("expense_category_concurrent_change"); const before = old.rows[0] as Row; await c.query("update expense_recurring_occurrences set category_id=$4,category_name_at_occurrence=$5,item_name=$6,amount_won=$7,is_override=true,updated_at=now(),updated_by_email=$8 where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [ruleId, spreadsheetId, occurrenceMonth, categoryId, String(cat.name), patch.itemName?.trim() ?? String(before.item_name), patch.amountWon ?? Number(before.amount_won), actorEmail]); }); }

export async function splitRecurringRuleFromMonth(spreadsheetId: string, actorEmail: string, ruleId: string, effectiveMonth: string, patch: Partial<CreateRecurringRuleBody>): Promise<RecurringRule> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const discoveredCategoryId = await lockRuleCategory(c, spreadsheetId, ruleId, patch.categoryId ? [patch.categoryId] : []); const oldR = await c.query("select * from expense_recurring_rules where id=$1 and spreadsheet_id=$2 for update", [ruleId, spreadsheetId]); if (!oldR.rows[0]) throw new Error("expense_rule_not_found"); if (discoveredCategoryId && String((oldR.rows[0] as Row).category_id) !== discoveredCategoryId) throw new Error("expense_category_concurrent_change"); const old = rule({ ...(oldR.rows[0] as Row), category_name: (oldR.rows[0] as Row).category_name_at_rule }); recurringRuleStatusAfterAction(old.status, "split"); const effectiveDate = occurrenceDateForMonth(effectiveMonth, patch.anchorDay ?? old.anchorDay); if (effectiveDate < old.startsOn || (old.endsOn && effectiveDate > old.endsOn)) throw new Error("expense_invalid_effective_month"); const categoryId = patch.categoryId ?? old.categoryId; const cat = await activeCategory(c, spreadsheetId, categoryId); const close = closeDateBeforeSplit(effectiveDate); await c.query("update expense_recurring_rules set ends_on=$3,updated_at=now(),updated_by_email=$4 where id=$1 and spreadsheet_id=$2", [ruleId, spreadsheetId, close, actorEmail]);
    // 옛 규칙이 이미 만들어 둔 effectiveDate 이후 occurrence 를 무효화한다(archive 경로와 동일 패턴).
    // 없으면 새 규칙이 같은 달에 occurrence 를 별도 insert(unique 는 rule_id 기준) → 두 행 모두 active
    // → 그 달 **이중 계상**(총비용 과대·영업이익 과소). #625 blocker ③.
    await c.query(
      `update expense_recurring_occurrences
       set status='voided',updated_at=now(),updated_by_email=$4
       where rule_id=$1 and spreadsheet_id=$2 and occurrence_date > $3::date and status <> 'voided'`,
      [ruleId, spreadsheetId, close, actorEmail],
    );
    const id = randomUUID(); const r = await c.query("insert into expense_recurring_rules (id,spreadsheet_id,category_id,category_name_at_rule,item_name,amount_won,anchor_day,starts_on,ends_on,status,supersedes_rule_id,created_by_email,updated_by_email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$11) returning *, $4 as category_name", [id, spreadsheetId, categoryId, String(cat.name), patch.itemName?.trim() ?? old.itemName, patch.amountWon ?? old.amountWon, patch.anchorDay ?? old.anchorDay, effectiveDate, patch.endsOn ?? old.endsOn, ruleId, actorEmail]); return rule(r.rows[0] as Row); }); }
