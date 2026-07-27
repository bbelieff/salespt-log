/**
 * Layer: repo/db — 비용 원장 전용 관계형 저장소.
 * 기존 03 DB관리/시트 미러와 완전히 분리한다. 모든 SQL은 spreadsheet_id를 함께 조건으로 둔다.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { dbEnabled, ensureSchema, getDbPool } from "./client";
import type { CreateExpenseBody, CreateRecurringRuleBody, ExpenseCategory, ExpenseEntry, RecurringRule } from "@/types/expense-ledger";

type Row = Record<string, unknown>;
let ledgerSchemaReady: Promise<void> | null = null;
const MIGRATION_FREEZE_ENV = "EXPENSE_CATEGORY_MIGRATION_FREEZE_R6";

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

/** 비용 원장 DDL은 기존 DB 파일럿 테이블에 가산만 한다. */
export function ensureExpenseLedgerSchema(): Promise<void> {
  if (migrationFreezeEnabled()) return Promise.resolve();
  if (!ledgerSchemaReady) {
    ledgerSchemaReady = (async () => {
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
function category(row: Row): ExpenseCategory { return { id: String(row.id), name: String(row.name), archivedAt: row.archived_at ? timestamp(row.archived_at) : null, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }; }
function entry(row: Row): ExpenseEntry { return { id: String(row.id), categoryId: String(row.category_id), categoryName: String(row.category_name), itemName: String(row.item_name), amountWon: Number(row.amount_won), periodStart: iso(row.period_start), periodEnd: iso(row.period_end), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }; }
function rule(row: Row): RecurringRule { return { id: String(row.id), categoryId: String(row.category_id), categoryName: String(row.category_name), itemName: String(row.item_name), amountWon: Number(row.amount_won), anchorDay: Number(row.anchor_day), startsOn: iso(row.starts_on), endsOn: row.ends_on ? iso(row.ends_on) : null, status: String(row.status) as RecurringRule["status"], supersedesRuleId: row.supersedes_rule_id ? String(row.supersedes_rule_id) : null, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at) }; }
async function tx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { const c = await getDbPool().connect(); try { await c.query("begin"); const out = await work(c); await c.query("commit"); return out; } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); } }
async function activeCategory(client: PoolClient, spreadsheetId: string, categoryId: string): Promise<Row> { const r = await client.query("select * from expense_categories where id=$1 and spreadsheet_id=$2 and archived_at is null", [categoryId, spreadsheetId]); if (!r.rows[0]) throw new Error("expense_category_not_found"); return r.rows[0] as Row; }

export async function listExpenseCategories(spreadsheetId: string, includeArchived = false): Promise<ExpenseCategory[]> { requiredDb(); await ensureExpenseLedgerSchema(); const r = await readExistingSnapshot(() => getDbPool().query(`select * from expense_categories where spreadsheet_id=$1 ${includeArchived ? "" : "and archived_at is null"} order by archived_at nulls first, name_normalized`, [spreadsheetId])); return r.rows.map((x) => category(x as Row)); }
export async function createExpenseCategory(spreadsheetId: string, actorEmail: string, name: string): Promise<ExpenseCategory> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const id = randomUUID(); const normalized = normalizeCategoryName(name); try { const r = await c.query("insert into expense_categories (id,spreadsheet_id,name,name_normalized,created_by_email,updated_by_email) values ($1,$2,$3,$4,$5,$5) returning *", [id, spreadsheetId, name.trim(), normalized, actorEmail]); await c.query("insert into expense_category_audits (id,category_id,spreadsheet_id,action,next_name,actor_email) values ($1,$2,$3,'created',$4,$5)", [randomUUID(), id, spreadsheetId, name.trim(), actorEmail]); return category(r.rows[0] as Row); } catch (e: unknown) { if ((e as { code?: string }).code === "23505") throw new Error("expense_category_duplicate"); throw e; } }); }
export async function patchExpenseCategory(spreadsheetId: string, actorEmail: string, id: string, patch: { name?: string; archived?: boolean }): Promise<ExpenseCategory> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const old = await c.query("select * from expense_categories where id=$1 and spreadsheet_id=$2 for update", [id, spreadsheetId]); if (!old.rows[0]) throw new Error("expense_category_not_found"); const previous = old.rows[0] as Row; let action: "renamed" | "archived" | "restored" | null = null; let nextName = String(previous.name); if (patch.name !== undefined && patch.name.trim() !== nextName) { nextName = patch.name.trim(); action = "renamed"; }
      const archivedAt = patch.archived === undefined ? previous.archived_at : (patch.archived ? new Date() : null); if (patch.archived === true) action = "archived"; if (patch.archived === false) action = "restored";
      try { const r = await c.query("update expense_categories set name=$3,name_normalized=$4,archived_at=$5,updated_at=now(),updated_by_email=$6 where id=$1 and spreadsheet_id=$2 returning *", [id, spreadsheetId, nextName, normalizeCategoryName(nextName), archivedAt, actorEmail]); if (action) await c.query("insert into expense_category_audits (id,category_id,spreadsheet_id,action,previous_name,next_name,actor_email) values ($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), id, spreadsheetId, action, String(previous.name), nextName, actorEmail]); return category(r.rows[0] as Row); } catch (e: unknown) { if ((e as { code?: string }).code === "23505") throw new Error("expense_category_duplicate"); throw e; }
    }); }

export async function createExpenseEntry(spreadsheetId: string, actorEmail: string, input: CreateExpenseBody): Promise<ExpenseEntry> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const cat = await activeCategory(c, spreadsheetId, input.categoryId); const end = input.periodEnd ?? input.periodStart; const r = await c.query("insert into expense_entries (id,spreadsheet_id,category_id,category_name_at_entry,item_name,amount_won,period_start,period_end,created_by_email,updated_by_email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) returning *, $4 as category_name", [randomUUID(), spreadsheetId, input.categoryId, String(cat.name), input.itemName.trim(), input.amountWon, input.periodStart, end, actorEmail]); return entry(r.rows[0] as Row); }); }
export async function patchExpenseEntry(spreadsheetId: string, actorEmail: string, id: string, patch: Partial<CreateExpenseBody>): Promise<ExpenseEntry> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const existing = await c.query("select * from expense_entries where id=$1 and spreadsheet_id=$2 and deleted_at is null for update", [id, spreadsheetId]); if (!existing.rows[0]) throw new Error("expense_entry_not_found"); const before = existing.rows[0] as Row; const categoryId = patch.categoryId ?? String(before.category_id); const cat = await activeCategory(c, spreadsheetId, categoryId); const start = patch.periodStart ?? iso(before.period_start); const end = patch.periodEnd ?? (patch.periodStart ? patch.periodStart : iso(before.period_end)); if (end < start) throw new Error("expense_invalid_period"); const r = await c.query("update expense_entries set category_id=$3,category_name_at_entry=$4,item_name=$5,amount_won=$6,period_start=$7,period_end=$8,updated_at=now(),updated_by_email=$9 where id=$1 and spreadsheet_id=$2 returning *, $4 as category_name", [id, spreadsheetId, categoryId, String(cat.name), patch.itemName?.trim() ?? String(before.item_name), patch.amountWon ?? Number(before.amount_won), start, end, actorEmail]); return entry(r.rows[0] as Row); }); }
export async function deleteExpenseEntry(spreadsheetId: string, actorEmail: string, id: string): Promise<void> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); const r = await getDbPool().query("update expense_entries set deleted_at=now(),updated_at=now(),updated_by_email=$3 where id=$1 and spreadsheet_id=$2 and deleted_at is null", [id, spreadsheetId, actorEmail]); if (r.rowCount !== 1) throw new Error("expense_entry_not_found"); }
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
    const locked = await c.query(
      "select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.id=$1 and r.spreadsheet_id=$2 for update of r",
      [id, spreadsheetId],
    );
    if (!locked.rows[0]) throw new Error("expense_rule_not_found");
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
    const locked = await c.query(
      "select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.id=$1 and r.spreadsheet_id=$2 for update of r",
      [id, spreadsheetId],
    );
    if (!locked.rows[0]) throw new Error("expense_rule_not_found");
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
    const locked = await c.query(
      "select id,status from expense_recurring_rules where id=$1 and spreadsheet_id=$2 for update",
      [id, spreadsheetId],
    );
    if (!locked.rows[0]) throw new Error("expense_rule_not_found");
    recurringRuleStatusAfterAction(String((locked.rows[0] as Row).status) as RecurringRule["status"], "archive");
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
export async function materializeOccurrences(spreadsheetId: string, actorEmail: string, throughMonth: string): Promise<void> { if (migrationFreezeEnabled()) return; requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { const rules = await c.query("select r.*,c.name as category_name from expense_recurring_rules r join expense_categories c on c.id=r.category_id where r.spreadsheet_id=$1 and r.status='active' and r.starts_on < (($2 || '-01')::date + interval '1 month') for update of r", [spreadsheetId, throughMonth]); for (const raw of rules.rows as Row[]) { const r = rule(raw); if (!isRecurringRuleMaterializable(r.status)) continue; const startMonth = r.startsOn.slice(0, 7); for (const month of monthsBetween(startMonth, throughMonth)) { const date = occurrenceDateForMonth(month, r.anchorDay); if (!isOccurrenceWithinRuleWindow(date, r.startsOn, r.endsOn)) continue; const paused = await c.query("select 1 from expense_recurring_pauses where rule_id=$1 and spreadsheet_id=$2 and paused_on <= $3::date and (resumed_on is null or $3::date < resumed_on) limit 1", [r.id, spreadsheetId, date]); if (paused.rows[0]) continue; const skipped = await c.query("select 1 from expense_recurring_skips where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [r.id, spreadsheetId, month]); if (skipped.rows[0]) continue; await c.query("insert into expense_recurring_occurrences (id,rule_id,spreadsheet_id,occurrence_date,occurrence_month,category_id,category_name_at_occurrence,item_name,amount_won,created_by_email,updated_by_email) values ($1,$2,$3,$4,($5 || '-01')::date,$6,$7,$8,$9,$10,$10) on conflict (rule_id,occurrence_month) do nothing", [randomUUID(), r.id, spreadsheetId, date, month, r.categoryId, r.categoryName, r.itemName, r.amountWon, actorEmail]); } } }); }
export async function skipRecurringOccurrence(spreadsheetId: string, actorEmail: string, ruleId: string, occurrenceMonth: string): Promise<void> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { const own = await c.query("select anchor_day,starts_on,ends_on,status from expense_recurring_rules where id=$1 and spreadsheet_id=$2 for update", [ruleId, spreadsheetId]); if (!own.rows[0]) throw new Error("expense_rule_not_found"); const row = own.rows[0] as Row; const occurrenceDate = occurrenceDateForMonth(occurrenceMonth, Number(row.anchor_day)); if (String(row.status) === "archived" || !isOccurrenceWithinRuleWindow(occurrenceDate, iso(row.starts_on), row.ends_on ? iso(row.ends_on) : null)) throw new Error("expense_occurrence_not_found"); await c.query("insert into expense_recurring_skips (id,rule_id,spreadsheet_id,occurrence_month,created_by_email) values ($1,$2,$3,($4 || '-01')::date,$5) on conflict (rule_id,occurrence_month) do nothing", [randomUUID(), ruleId, spreadsheetId, occurrenceMonth, actorEmail]); await c.query("update expense_recurring_occurrences set status='skipped',updated_at=now(),updated_by_email=$4 where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [ruleId, spreadsheetId, occurrenceMonth, actorEmail]); }); }

export async function listRecurringOccurrences(spreadsheetId: string): Promise<Array<{ id: string; ruleId: string; categoryId: string; categoryName: string; itemName: string; amountWon: number; occurrenceDate: string; occurrenceMonth: string; status: "active" | "skipped" | "voided" }>> { requiredDb(); await ensureExpenseLedgerSchema(); const r = await readExistingSnapshot(() => getDbPool().query("select o.*,c.name as category_name from expense_recurring_occurrences o join expense_categories c on c.id=o.category_id where o.spreadsheet_id=$1 order by o.occurrence_date", [spreadsheetId])); return (r.rows as Row[]).map((x) => ({ id: String(x.id), ruleId: String(x.rule_id), categoryId: String(x.category_id), categoryName: String(x.category_name), itemName: String(x.item_name), amountWon: Number(x.amount_won), occurrenceDate: iso(x.occurrence_date), occurrenceMonth: iso(x.occurrence_month).slice(0, 7), status: String(x.status) as "active" | "skipped" | "voided" })); }

export async function patchRecurringOccurrence(spreadsheetId: string, actorEmail: string, ruleId: string, occurrenceMonth: string, patch: { categoryId?: string; itemName?: string; amountWon?: number }): Promise<void> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); await tx(async (c) => { const old = await c.query("select * from expense_recurring_occurrences where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date for update", [ruleId, spreadsheetId, occurrenceMonth]); if (!old.rows[0]) throw new Error("expense_occurrence_not_found"); const before = old.rows[0] as Row; const categoryId = patch.categoryId ?? String(before.category_id); const cat = await activeCategory(c, spreadsheetId, categoryId); await c.query("update expense_recurring_occurrences set category_id=$4,category_name_at_occurrence=$5,item_name=$6,amount_won=$7,is_override=true,updated_at=now(),updated_by_email=$8 where rule_id=$1 and spreadsheet_id=$2 and occurrence_month=($3 || '-01')::date", [ruleId, spreadsheetId, occurrenceMonth, categoryId, String(cat.name), patch.itemName?.trim() ?? String(before.item_name), patch.amountWon ?? Number(before.amount_won), actorEmail]); }); }

export async function splitRecurringRuleFromMonth(spreadsheetId: string, actorEmail: string, ruleId: string, effectiveMonth: string, patch: Partial<CreateRecurringRuleBody>): Promise<RecurringRule> { requireLedgerWritable(); requiredDb(); await ensureExpenseLedgerSchema(); return tx(async (c) => { const oldR = await c.query("select * from expense_recurring_rules where id=$1 and spreadsheet_id=$2 for update", [ruleId, spreadsheetId]); if (!oldR.rows[0]) throw new Error("expense_rule_not_found"); const old = rule({ ...(oldR.rows[0] as Row), category_name: (oldR.rows[0] as Row).category_name_at_rule }); recurringRuleStatusAfterAction(old.status, "split"); const effectiveDate = occurrenceDateForMonth(effectiveMonth, patch.anchorDay ?? old.anchorDay); if (effectiveDate < old.startsOn || (old.endsOn && effectiveDate > old.endsOn)) throw new Error("expense_invalid_effective_month"); const categoryId = patch.categoryId ?? old.categoryId; const cat = await activeCategory(c, spreadsheetId, categoryId); const close = closeDateBeforeSplit(effectiveDate); await c.query("update expense_recurring_rules set ends_on=$3,updated_at=now(),updated_by_email=$4 where id=$1 and spreadsheet_id=$2", [ruleId, spreadsheetId, close, actorEmail]);
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
