/** Layer: repo — reconcile manual daily counts with locked DB-sheet contributions. */
import type { SalesRowForDb } from "./client";

function contribution(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("[db-sheet-metrics-conflict] invalid contribution");
  return n;
}

/** Baselines are read snapshots, never client authority over the server contribution. */
export function reconcileDbSheetMetrics(row: SalesRowForDb, current: Record<string, unknown>): Omit<SalesRowForDb, "dbSheetInflow" | "dbSheetContacts"> {
  const { dbSheetInflow, dbSheetContacts, ...payload } = row;
  function rebase(total: number, baseline: number | undefined, stored: unknown): number {
    const auto = contribution(stored);
    if ((baseline === undefined && auto > 0) || (baseline !== undefined && (!Number.isSafeInteger(baseline) || baseline < 0 || total < baseline))) {
      throw new Error("[db-sheet-metrics-conflict] reload required");
    }
    return total - (baseline ?? 0) + auto;
  }
  if (payload.inflow !== undefined) {
    payload.inflow = rebase(payload.inflow, dbSheetInflow, current._dbSheetInflow);
    if (payload.channel === "직접생산") payload.production = payload.inflow;
  }
  payload.contactProgress = rebase(payload.contactProgress, dbSheetContacts, current._dbSheetContacts);
  return payload;
}
