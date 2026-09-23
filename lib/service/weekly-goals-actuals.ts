import { CHANNEL_ORDER, type ContractPayment, type Meeting } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import type { GoalActuals } from "@/types/weekly-goals";
import { CARRYOVER } from "./dashboard-aggregates";
import { isValidISODate } from "@/util/week";

/** Same raw records and existing metric definitions, scoped to the selected UI Friday–Thursday.
 * Existing historic dashboard aggregates remain unchanged. No goal-derived actuals.
 */
export function weeklyGoalActuals(sales: DbSalesRow[], meetings: Meeting[], _payments: ContractPayment[], start: string, end: string): GoalActuals {
  const inRange = (d: string) => isValidISODate(d) && d >= start && d <= end;
  const actual: GoalActuals = { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 };
  for (const r of sales) {
    if (!inRange(r.date) || !(CHANNEL_ORDER as readonly string[]).includes(r.channel)) continue;
    actual.production += r.production;
    actual.inflow += r.inflow;
    actual.contacts += r.contactProgress;
  }
  const selected = meetings.filter(m => inRange(m.미팅날짜) && !CARRYOVER(m));
  actual.meetings = selected.filter(m => m.상태 === "완료" || m.상태 === "계약").length;
  actual.contracts = selected.filter(m => m.상태 === "계약").length;
  return actual;
}
