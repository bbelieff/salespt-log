/**
 * 「오늘의 씨앗」 (belie 2026-10-24): when the morning has nothing to follow up, offer one thing
 * worth restarting instead of staying silent. Pure — the dispatcher passes the same sources the
 * dashboard reads. Order: ① no new DB in the last 7 days ② quiet 진행건. Wording asks, never scolds.
 * The proposed "부재·재통화 DB quiet 30+ days" seed is left out on purpose: every such active DB is
 * already a 「다시 연락할 DB」 follow-up, so a morning with one is never a zero morning (2026-10-25).
 */
import type { ContractPayment, Todo } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";
import { activeWorkContracts, isSlotClosed, slotHasData } from "@/lib/analytics/payment-work-status";
import { isLongTermContract } from "@/lib/analytics/long-term";
import { slotsOf } from "@/lib/analytics/contract-slots";
import { contractRef, sameContractRef } from "@/util/contract-ref";
import type { PushMessage } from "./push-messages";
import { addDaysISO } from "./push-schedule";

export const SEED_INFLOW_DAYS = 7;
export const SEED_WORK_QUIET_DAYS = 14;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const latest = (dates: Array<string | undefined | null>) => dates.filter((d): d is string => !!d && ISO.test(d)).sort().at(-1) ?? null;
const clip = (s: string, n = 20) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const LEAD = "오늘 챙길 일은 없어요.";

export interface SeedSources { leads?: DbSheetLead[]; contracts?: ContractPayment[]; todos?: Todo[] }

/** ① 최근 7일(오늘 포함) 동안 새로 들어온 DB가 없음. DB 기록 자체가 없는 사람에겐 보내지 않는다. */
export function noRecentInflow(leads: DbSheetLead[], today: string): boolean {
  if (!leads.length) return false;
  const from = addDaysISO(today, -(SEED_INFLOW_DAYS - 1));
  return !leads.some(l => ISO.test(l.date) && l.date >= from && l.date <= today);
}

/** ② 14일 넘게 기록이 없고 다음 할 일도 없는 진행 중 계약(장기관리·끝난 진행건 제외, 오래된 순). */
export function quietContracts(contracts: ContractPayment[], todos: Todo[], today: string): ContractPayment[] {
  const cutoff = addDaysISO(today, -SEED_WORK_QUIET_DAYS);
  return activeWorkContracts(contracts)
    .filter(cp => !isLongTermContract(cp))
    .filter(cp => slotsOf(cp).some(([, s]) => slotHasData(s) && !isSlotClosed(s, today)))
    .map(cp => {
      const mine = todos.filter(t => t.type !== "일반" && sameContractRef(t.contractRef, contractRef(cp.계약일, cp.업체명)));
      const open = mine.some(t => (t.기록종류 ?? "todo") === "todo" && !t.완료여부);
      const last = latest([...mine.filter(t => t.기록종류 === "history" || t.완료여부).map(t => t.예정일자).filter(d => d <= today), cp.계약일]);
      return { cp, open, last };
    })
    .filter(x => !x.open && x.last !== null && x.last <= cutoff)
    .sort((a, b) => a.last!.localeCompare(b.last!))
    .map(x => x.cp);
}

/**
 * Null = no seed; the dispatcher then sends nothing. A seed sent in either of the last two
 * messages rests, so the same nudge comes at most every third morning.
 */
export function buildSeedMessage(src: SeedSources, showNames: boolean, today: string, recent: readonly string[] = []): PushMessage | null {
  const options: PushMessage[] = [];
  if (src.leads) {
    if (noRecentInflow(src.leads, today)) {
      options.push({ messageId: "morning.seed.inflow.v1", itemCount: 0, url: "/db-sheet", body: `${LEAD} 최근 일주일 새 DB가 없어요. 오늘 채워 볼까요?` });
    }
  }
  if (src.contracts && src.todos) {
    const quiet = quietContracts(src.contracts, src.todos, today);
    if (quiet.length) {
      const n = quiet.length, first = quiet[0]!;
      options.push({ messageId: "morning.seed.work.v1", itemCount: n, url: showNames && first.row != null ? `/payment?row=${first.row}` : "/payment",
        body: showNames
          ? `${LEAD} ${clip(first.업체명)} 진행건이 2주째 조용해요${n > 1 ? `(외 ${n - 1}건)` : ""}. 근황을 물어볼까요?`
          : `${LEAD} 2주째 조용한 진행건이 ${n}건 있어요. 근황을 물어볼까요?` });
    }
  }
  const rested = new Set(recent.slice(0, 2));
  return options.find(o => !rested.has(o.messageId)) ?? null;
}
