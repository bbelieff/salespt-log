/** ADR-0024: converge the direct-production period total after a ledger commit. */
import * as Sentry from "@sentry/nextjs";
import type { DbSheetContext } from "@/types/db-sheet";
import { syncDirectProductionForDate } from "./db";
const tails = new Map<string, Promise<void>>();
export function queueDbSheetProductionSync(ctx: DbSheetContext, date: string): void {
  const key = ctx.spreadsheetId;
  const task = (tails.get(key) ?? Promise.resolve()).then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await syncDirectProductionForDate(key, date, ctx.cohort); return; }
      catch {
        if (attempt === 2) Sentry.captureMessage("DB sheet direct production convergence failed", { level: "error", tags: { where: "db-sheet-production-sync" } });
        else await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  });
  tails.set(key, task);
  void task.finally(() => { if (tails.get(key) === task) tails.delete(key); });
}
