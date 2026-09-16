import { CHANNEL_ORDER, type Meeting, type ContractPayment } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import type { GoalActuals } from "@/types/weekly-goals";
import { CARRYOVER, DONE, weeklyContractsFromDb } from "./dashboard-aggregates";
import { terminatedByWeek } from "./termination-count";
import { isValidISODate, parseISO } from "@/util/week";

/** Same raw records and existing metric definitions, scoped to the selected UI Friday–Thursday.
 * Existing historic dashboard aggregates remain unchanged. No goal-derived actuals.
 */
export function weeklyGoalActuals(sales: DbSalesRow[], meetings: Meeting[], payments: ContractPayment[], start: string, end: string): GoalActuals {
  const inRange = (d: string) => isValidISODate(d) && d >= start && d <= end;
  const actual: GoalActuals = { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 };
  for (const r of sales) {
    if (!inRange(r.date) || !(CHANNEL_ORDER as readonly string[]).includes(r.channel)) continue;
    actual.production += r.production;
    actual.inflow += r.inflow;
    actual.contacts += r.contactProgress;
  }
  const selected = meetings.filter(m => inRange(m.미팅날짜));
  actual.meetings = selected.filter(m => !CARRYOVER(m) && DONE(m.상태)).length;
  const contracts = weeklyContractsFromDb(selected, parseISO(start))[0] ?? 0;
  const terminated = terminatedByWeek(payments.filter(p => inRange(p.계약일 ?? "")), parseISO(start))[0] ?? 0;
  actual.contracts = Math.max(0, contracts - terminated);
  return actual;
}
