import { buildWorkStatusItems, type WorkStatusKey } from "@/lib/analytics/payment-work-status";
import { readContractsFromDb, readTodosFromDb } from "@/repo/db/read-daily";
import { isTerminatedContract, type ContractPayment } from "@/types/contract";
import { DB_SHEET_MEETING_STAGE, type DbSheetContext, type DbSheetFunnelStep, type DbSheetLead } from "@/types/db-sheet";

const labels: Record<WorkStatusKey, string> = {
  waiting: "진행대기", progress: "진행", approved: "승인",
  "collection-waiting": "수납대기", collected: "수납완료",
};

type ContractState = Pick<ContractPayment, "해지일" | "해지숨김">;
/** 해지일도 숨김도 없는 계약 — 현재상태 「계약해지」와 같은 기준. */
const isLiveContract = (cp: ContractState) => !cp.해지숨김 && !isTerminatedContract(cp);
const MEETING_HELD = new Set([DB_SHEET_MEETING_STAGE.예약, DB_SHEET_MEETING_STAGE.변경, DB_SHEET_MEETING_STAGE.완료]);

/**
 * DB 한 건이 닿은 가장 높은 단계(공급처별 성과용, 저장 안 함). 위에서부터 처음 맞는 규칙:
 * 살아 있는 연결 계약 → 계약 · 연결 계약이 모두 해지/숨김 → 미팅 · 미팅 상태 계약 → 계약 ·
 * 미팅 예약/변경/완료 → 미팅 · (취소·삭제된 미팅은 아래 규칙으로) · 실적 대상 상담 이력 → 상담 · 미컨택 아닌 결과 → 연락 · 그 외 유입.
 * stage 는 저장소가 미팅 상태로 붙인 값이어야 한다(작업상태 라벨로 덮기 전).
 */
export function dbSheetFunnelStep(
  lead: Pick<DbSheetLead, "meetingId" | "stage" | "first" | "hasQualifiedContact" | "result">,
  linked: readonly ContractState[] = [],
): DbSheetFunnelStep {
  if (linked.length) return linked.some(isLiveContract) ? "계약" : "미팅";
  if (lead.meetingId && lead.stage === DB_SHEET_MEETING_STAGE.계약) return "계약";
  if (lead.meetingId && MEETING_HELD.has(lead.stage)) return "미팅";
  // 이전 버전의 first는 실적 대상 상담에만 생겼다. 새 기록은 별도 이력을 사용한다.
  if (lead.hasQualifiedContact ?? !!lead.first) return "상담";
  return lead.result !== "미컨택" ? "연락" : "유입";
}

/** Show the actual linked slots, without declaring a partly collected company completed. */
export async function projectDbSheetWorkStatus(ctx: DbSheetContext, leads: DbSheetLead[]) {
  if (!leads.some(lead => lead.meetingId)) return leads.map(lead => ({ ...lead, funnel: dbSheetFunnelStep(lead) }));
  return (await loadDbSheetWorkProjector(ctx))(leads);
}

/** Read before a write: a failed projection read must never turn a committed save into HTTP 503. */
export async function loadDbSheetWorkProjector(ctx: DbSheetContext) {
  const [contracts, todos] = await Promise.all([
    readContractsFromDb(ctx.spreadsheetId), readTodosFromDb(ctx.spreadsheetId),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  return (leads: DbSheetLead[]): DbSheetLead[] => leads.map(lead => {
    const linked = contracts.filter(cp => cp.linkedMeetingId &&
      (cp.linkedMeetingId === lead.meetingId || cp.linkedMeetingId === lead.effectiveMeetingId || lead.meetingLineageIds?.includes(cp.linkedMeetingId)));
    const funnel = dbSheetFunnelStep(lead, linked);
    if (!linked.length) return { ...lead, funnel };
    const active = linked.filter(isLiveContract);
    if (!active.length) return { ...lead, funnel, stage: "계약해지" };
    const statuses = new Set(buildWorkStatusItems(active, todos, today).map(item => item.status));
    return { ...lead, funnel, stage: Object.entries(labels).filter(([key]) => statuses.has(key as WorkStatusKey)).map(([, label]) => label).join(" · ") };
  });
}
