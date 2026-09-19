import { CHANNEL_ORDER, type Meeting, type ContractPayment } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import type { GoalActuals } from "@/types/weekly-goals";
import { CARRYOVER, DONE, weeklyContractsFromDb } from "./dashboard-aggregates";
import { terminatedByWeek } from "./termination-count";
import { isValidISODate, parseISO } from "@/util/week";

/** start~end 가 걸쳐 있는 주 수. 주차별 배열의 길이를 범위에 맞추기 위한 것 —
 *  한 주짜리 창이면 1, 누적이면 그 주 수. 기본 span(STATS_WEEKS=8)에 잘리지 않게 한다. */
function weekSpan(start: string, end: string): number {
  const ms = parseISO(end).getTime() - parseISO(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 1;
  return Math.max(1, Math.floor(ms / 604800000) + 1); // 604800000 = 7일
}

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
  // 두 함수는 **주차별 배열**을 돌려준다. 예전엔 `[0]`(= 범위의 첫 주)만 꺼냈는데,
  // 한 주짜리 창에선 맞지만 **누적(1주차~지난주)** 에선 첫 주 것만 세게 된다.
  // 실제 사고: 첫 계약이 3주차인 수강생의 누적계약이 0 으로 나와 역산제안이 전부
  // 「계산 불가」가 됐다(생산·유입·컨택·미팅은 구간 합이라 정상이었고 계약만 0).
  // span 도 범위에 맞춘다 — 기본값 STATS_WEEKS(8)면 12주 과정(ADR-0032)의 9주차 이후가 잘린다.
  const span = weekSpan(start, end);
  const sum = (weeks: number[]) => weeks.reduce((a, b) => a + b, 0);
  const contracts = sum(weeklyContractsFromDb(selected, parseISO(start), span));
  const terminated = sum(
    terminatedByWeek(payments.filter(p => inRange(p.계약일 ?? "")), parseISO(start), span),
  );
  actual.contracts = Math.max(0, contracts - terminated);
  return actual;
}
