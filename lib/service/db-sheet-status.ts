import { buildWorkStatusItems, type WorkStatusKey } from "@/lib/analytics/payment-work-status";
import { readContractsFromDb, readTodosFromDb } from "@/repo/db/read-daily";
import { isTerminatedContract } from "@/types/contract";
import type { DbSheetContext, DbSheetLead } from "@/types/db-sheet";

const labels: Record<WorkStatusKey, string> = {
  waiting: "진행대기", progress: "진행", approved: "승인",
  "collection-waiting": "수납대기", collected: "수납완료",
};

/** Show the actual linked slots, without declaring a partly collected company completed. */
export async function projectDbSheetWorkStatus(ctx: DbSheetContext, leads: DbSheetLead[]) {
  if (!leads.some(lead => lead.meetingId)) return leads;
  return (await loadDbSheetWorkProjector(ctx))(leads);
}

/** Read before a write: a failed projection read must never turn a committed save into HTTP 503. */
export async function loadDbSheetWorkProjector(ctx: DbSheetContext) {
  const [contracts, todos] = await Promise.all([
    readContractsFromDb(ctx.spreadsheetId), readTodosFromDb(ctx.spreadsheetId),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  return (leads: DbSheetLead[]) => leads.map(lead => {
    const linked = contracts.filter(cp => cp.linkedMeetingId &&
      (cp.linkedMeetingId === lead.meetingId || cp.linkedMeetingId === lead.effectiveMeetingId || lead.meetingLineageIds?.includes(cp.linkedMeetingId)));
    if (!linked.length) return lead;
    const active = linked.filter(cp => !cp.해지숨김 && !isTerminatedContract(cp));
    if (!active.length) return { ...lead, stage: "계약해지" };
    const statuses = new Set(buildWorkStatusItems(active, todos, today).map(item => item.status));
    return { ...lead, stage: Object.entries(labels).filter(([key]) => statuses.has(key as WorkStatusKey)).map(([, label]) => label).join(" · ") };
  });
}
