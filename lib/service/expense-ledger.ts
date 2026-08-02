/** Layer: service — 비용 원장 규칙(일할 인식·소유 범위·월 반복 materialization). */
import { createHash } from "node:crypto";
import type { CreateExpenseBody, CreateRecurringRuleBody, ExpenseLedgerView, ExpenseReclassificationRef, PatchRecurringRuleBody, RecognizedExpense, ReclassifyUnclassifiedBody, RecurringRule } from "@/types/expense-ledger";
import { findUserByEmail } from "@/repo/users";
import {
  archiveRecurringRule, createExpenseCategory, createExpenseEntry, createRecurringRule, deleteExpenseCategory, deleteExpenseEntry,
  getExpenseCategoryUsage, reclassifyUnclassified,
  listExpenseCategories, listExpenseEntries, listRecurringOccurrences, listRecurringRules, materializeOccurrences, occurrenceDateForMonth,
  patchExpenseCategory, patchExpenseEntry, patchRecurringOccurrence, pauseRecurringRule, resumeRecurringRule,
  skipRecurringOccurrence, splitRecurringRuleFromMonth,
} from "@/repo/db/expense-ledger";

export interface ExpenseScope { spreadsheetId: string; actorEmail: string; }
type RecurringOccurrence = Awaited<ReturnType<typeof listRecurringOccurrences>>[number];
type OccurrenceState = "active" | "skipped" | "voided" | "pending" | "paused" | "archived" | "not_started" | "ended";

export interface ManagedRecurringRule extends RecurringRule {
  currentOccurrence: { occurrenceDate: string; occurrenceMonth: string; status: OccurrenceState } | null;
  nextOccurrence: { occurrenceDate: string; occurrenceMonth: string; status: "active" | "skipped" | "voided" } | null;
}
export async function resolveExpenseScope(email: string): Promise<ExpenseScope> {
  const user = await findUserByEmail(email);
  if (!user?.spreadsheetId) throw new Error("expense_scope_not_found");
  return { spreadsheetId: user.spreadsheetId, actorEmail: email.toLowerCase() };
}

function parseUtc(iso: string): Date { return new Date(`${iso}T00:00:00Z`); }
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function todaySeoul(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function currentMonth(): string { return todaySeoul().slice(0, 7); }
function nextMonth(month: string): string { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); }
function dayCount(start: string, end: string): number { return Math.floor((parseUtc(end).getTime() - parseUtc(start).getTime()) / 86_400_000) + 1; }

/** Management list state is derived from the caller-owned rule and materialized occurrences only. */
export function manageRecurringRules(rules: RecurringRule[], occurrences: RecurringOccurrence[], asOfDate: string): ManagedRecurringRule[] {
  const month = asOfDate.slice(0, 7);
  const byRule = new Map<string, RecurringOccurrence[]>();
  for (const occurrence of occurrences) {
    const own = byRule.get(occurrence.ruleId) ?? [];
    own.push(occurrence);
    byRule.set(occurrence.ruleId, own);
  }
  return rules.map((recurringRule) => {
    const own = byRule.get(recurringRule.id) ?? [];
    const currentDate = occurrenceDateForMonth(month, recurringRule.anchorDay);
    const current = own.find((occurrence) => occurrence.occurrenceMonth === month);
    const isCurrentScheduled = currentDate >= recurringRule.startsOn && (!recurringRule.endsOn || currentDate <= recurringRule.endsOn);
    const currentStatus: OccurrenceState = recurringRule.status !== "active"
      ? recurringRule.status
      : current?.status
        ?? (!isCurrentScheduled ? (currentDate < recurringRule.startsOn ? "not_started" : "ended") : "pending");
    const next = recurringRule.status === "active"
      ? own.filter((occurrence) => occurrence.occurrenceDate >= asOfDate)
        .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate))[0]
      : undefined;
    return {
      ...recurringRule,
      currentOccurrence: isCurrentScheduled || current
        ? { occurrenceDate: current?.occurrenceDate ?? currentDate, occurrenceMonth: month, status: currentStatus }
        : null,
      nextOccurrence: next
        ? { occurrenceDate: next.occurrenceDate, occurrenceMonth: next.occurrenceMonth, status: next.status }
        : null,
    };
  });
}

/** 양끝 포함, 나머지 원은 앞선 달력일에 배정한다. 순수 함수라 조회 순서에 흔들리지 않는다. */
export function allocateExpenseByDay(amountWon: number, periodStart: string, periodEnd: string): Array<{ date: string; amountWon: number }> {
  const days = dayCount(periodStart, periodEnd);
  // NaN 가드 필수 — 날짜 문자열이 깨지면 days=NaN 이고 NaN 은 두 부등호를 모두 통과해
  // 빈 배열 → 인식금액 0 → 화면에서 조용히 사라진다(2026-07-28 P1 의 전파 경로).
  if (!Number.isFinite(days) || days < 1 || days > 3660) throw new Error("expense_invalid_period");
  const quotient = Math.floor(amountWon / days); const remainder = amountWon % days;
  const out: Array<{ date: string; amountWon: number }> = [];
  const d = parseUtc(periodStart);
  for (let i = 0; i < days; i += 1) { out.push({ date: iso(d), amountWon: quotient + (i < remainder ? 1 : 0) }); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export function recognizedAmountForRange(amountWon: number, start: string, end: string, from: string, through: string): number {
  return allocateExpenseByDay(amountWon, start, end).reduce((sum, d) => sum + (d.date >= from && d.date <= through ? d.amountWon : 0), 0);
}

/** 원장·카테고리·대시보드가 동일한 active occurrence 인식 규칙을 사용한다. */
export function recognizeRecurringOccurrencesForRange(
  occurrences: RecurringOccurrence[],
  from: string,
  through: string,
  categoryId?: string,
): RecognizedExpense[] {
  return occurrences.flatMap((occurrence) => {
    if (occurrence.status !== "active"
      || occurrence.occurrenceDate < from
      || occurrence.occurrenceDate > through
      || (categoryId && occurrence.categoryId !== categoryId)) return [];
    return [{
      source: "recurring" as const,
      id: occurrence.id,
      categoryId: occurrence.categoryId,
      categoryName: occurrence.categoryName,
      itemName: occurrence.itemName,
      amountWon: occurrence.amountWon,
      periodStart: occurrence.occurrenceDate,
      periodEnd: occurrence.occurrenceDate,
      recurringRuleId: occurrence.ruleId,
      isOverride: occurrence.isOverride,
    }];
  });
}
function viewRange(view: "month" | "all" | "category", month: string | undefined): { from: string; through: string; month: string | null } {
  const today = todaySeoul();
  if (view !== "month") return { from: "0001-01-01", through: today, month: null };
  const m = month ?? currentMonth(); const next = new Date(`${m}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0);
  return { from: `${m}-01`, through: iso(next), month: m };
}

export async function getExpenseLedger(email: string, query: { view: "month" | "all" | "category"; month?: string; categoryId?: string }): Promise<ExpenseLedgerView> {
  const scope = await resolveExpenseScope(email); const range = viewRange(query.view, query.month);
  await materializeOccurrences(scope.spreadsheetId, scope.actorEmail, todaySeoul().slice(0, 7));
  const [categories, entries, occurrences] = await Promise.all([listExpenseCategories(scope.spreadsheetId, true), listExpenseEntries(scope.spreadsheetId), listRecurringOccurrences(scope.spreadsheetId)]);
  const recognized: RecognizedExpense[] = [];
  for (const e of entries) {
    if (query.view === "category" && e.categoryId !== query.categoryId) continue;
    const amount = recognizedAmountForRange(e.amountWon, e.periodStart, e.periodEnd, range.from, range.through);
    if (amount > 0) recognized.push({ source: "one_time", id: e.id, categoryId: e.categoryId, categoryName: e.categoryName, itemName: e.itemName, amountWon: amount, periodStart: e.periodStart, periodEnd: e.periodEnd });
  }
  recognized.push(...recognizeRecurringOccurrencesForRange(
    occurrences,
    range.from,
    range.through,
    query.view === "category" ? query.categoryId : undefined,
  ));
  const totals = new Map<string, { categoryId: string; categoryName: string; amountWon: number }>();
  for (const r of recognized) { const old = totals.get(r.categoryId) ?? { categoryId: r.categoryId, categoryName: r.categoryName, amountWon: 0 }; old.amountWon += r.amountWon; totals.set(r.categoryId, old); }
  return { view: query.view, month: range.month, categories, entries: recognized, categoryTotals: [...totals.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName, "ko")), additionalCostTotal: recognized.reduce((s, r) => s + r.amountWon, 0) };
}

export async function getRecurringExpenseRules(email: string): Promise<{ asOfDate: string; rules: ManagedRecurringRule[] }> {
  const scope = await resolveExpenseScope(email);
  const asOfDate = todaySeoul();
  await materializeOccurrences(scope.spreadsheetId, scope.actorEmail, nextMonth(asOfDate.slice(0, 7)));
  const [rules, occurrences] = await Promise.all([
    listRecurringRules(scope.spreadsheetId),
    listRecurringOccurrences(scope.spreadsheetId),
  ]);
  return { asOfDate, rules: manageRecurringRules(rules, occurrences, asOfDate) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYSTEM_CATEGORY_ID = /^system:/;
const REF_RANK: Record<ExpenseReclassificationRef["kind"], number> = { entry: 0, recurringRule: 1, recurringOccurrence: 2 };
export function canonicalizeExpenseReclassification(input: ReclassifyUnclassifiedBody): { operationId: string; targetCategoryId: string; refs: ExpenseReclassificationRef[]; json: string; hash: string } {
  const operationId = input.operationId.toLowerCase();
  const targetCategoryId = input.targetCategoryId.toLowerCase();
  const refs = input.refs.map((ref) => ({ kind: ref.kind, id: ref.id.toLowerCase() }))
    .sort((a, b) => REF_RANK[a.kind] - REF_RANK[b.kind] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seen = new Set<string>();
  for (const ref of refs) { const key = `${ref.kind}:${ref.id}`; if (seen.has(key)) throw new Error("invalid_request"); seen.add(key); }
  const json = JSON.stringify({ v: 1, targetCategoryId, refs });
  return { operationId, targetCategoryId, refs, json, hash: createHash("sha256").update(json, "utf8").digest("hex") };
}

export async function getExpenseCategoryUsageForUser(email: string, id: string) {
  if (SYSTEM_CATEGORY_ID.test(id)) throw new Error("expense_category_system_immutable");
  if (!UUID.test(id)) throw new Error("expense_category_not_found");
  const scope = await resolveExpenseScope(email);
  return getExpenseCategoryUsage(scope.spreadsheetId, id);
}
export async function deleteExpenseCategoryForUser(email: string, id: string) {
  if (SYSTEM_CATEGORY_ID.test(id)) throw new Error("expense_category_system_immutable");
  if (!UUID.test(id)) throw new Error("expense_category_not_found");
  const scope = await resolveExpenseScope(email);
  return deleteExpenseCategory(scope.spreadsheetId, scope.actorEmail, id);
}
export async function reclassifyUnclassifiedForUser(email: string, input: ReclassifyUnclassifiedBody) {
  const normalized = canonicalizeExpenseReclassification(input);
  const scope = await resolveExpenseScope(email);
  return reclassifyUnclassified(scope.spreadsheetId, scope.actorEmail, normalized.operationId, normalized.hash, normalized.targetCategoryId, normalized.refs);
}

export async function addExpenseCategory(email: string, name: string) { const s = await resolveExpenseScope(email); return createExpenseCategory(s.spreadsheetId, s.actorEmail, name); }
export async function editExpenseCategory(email: string, id: string, patch: { name: string }) { const s = await resolveExpenseScope(email); return patchExpenseCategory(s.spreadsheetId, s.actorEmail, id, patch); }
export async function addExpense(email: string, input: CreateExpenseBody) { if (dayCount(input.periodStart, input.periodEnd ?? input.periodStart) > 3660) throw new Error("expense_invalid_period"); const s = await resolveExpenseScope(email); return createExpenseEntry(s.spreadsheetId, s.actorEmail, input); }
export async function editExpense(email: string, id: string, patch: Partial<CreateExpenseBody>) { if (patch.periodStart && patch.periodEnd && dayCount(patch.periodStart, patch.periodEnd) > 3660) throw new Error("expense_invalid_period"); const s = await resolveExpenseScope(email); return patchExpenseEntry(s.spreadsheetId, s.actorEmail, id, patch); }
export async function removeExpense(email: string, id: string) { const s = await resolveExpenseScope(email); return deleteExpenseEntry(s.spreadsheetId, s.actorEmail, id); }
export async function addRecurringExpense(email: string, input: CreateRecurringRuleBody) { const s = await resolveExpenseScope(email); return createRecurringRule(s.spreadsheetId, s.actorEmail, input); }
export async function pauseRecurringExpense(email: string, id: string, pausedOn: string) { const s = await resolveExpenseScope(email); return pauseRecurringRule(s.spreadsheetId, s.actorEmail, id, pausedOn); }
export async function resumeRecurringExpense(email: string, id: string, resumedOn: string) { const s = await resolveExpenseScope(email); return resumeRecurringRule(s.spreadsheetId, s.actorEmail, id, resumedOn); }
export async function skipRecurringExpense(email: string, id: string, occurrenceMonth: string) { const s = await resolveExpenseScope(email); return skipRecurringOccurrence(s.spreadsheetId, s.actorEmail, id, occurrenceMonth); }
export async function editRecurringExpense(email: string, id: string, input: PatchRecurringRuleBody) { const s = await resolveExpenseScope(email); if (input.scope === "occurrence") return patchRecurringOccurrence(s.spreadsheetId, s.actorEmail, id, input.occurrenceMonth, input.patch); return splitRecurringRuleFromMonth(s.spreadsheetId, s.actorEmail, id, input.effectiveMonth, input.patch); }
export async function removeRecurringExpense(email: string, id: string, stoppedOn = todaySeoul()) { const s = await resolveExpenseScope(email); return archiveRecurringRule(s.spreadsheetId, s.actorEmail, id, stoppedOn); }
