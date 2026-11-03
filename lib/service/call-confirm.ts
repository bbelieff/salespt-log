/**
 * Layer: service — 「통화 정리 확인」 [확정하고 저장] (plan call-summary PR-4b).
 * 화면에서 고친 값을 DB관리시트의 기존 명령 그대로 저장한다 — 사람이 직접 누르는 것과 같은 경로라 시트 동기화·실적 집계가 똑같다.
 *   ① save: 업체정보(ci)·사용자 추가 칸·미팅 초안, DB 원본 업체명·대표자명은 비어 있을 때만
 *   ② contact: 컨택 날짜·결과·상담메모
 *   ③ meeting(미팅 초안이 있을 때만): 미팅카드 등록 — 자동 등록 없음, 이 확정에서만
 * 두 번 눌러도 한 번: 시작할 때 통화를 confirmed 로 잠그고, 중간에 실패하면 review 로 되돌린다.
 */
import { z } from "zod";
import { isCallSummaryUser } from "@/config";
import { CallCompanyInfo, CallMeetingDraft } from "@/types/call";
import { CompanyInfo } from "@/types/meeting";
import { DbSheetDate, DbSheetLeadInput, DbSheetResult, type DbSheetContext } from "@/types/db-sheet";
import { DbSheetConflict } from "@/repo/db/db-sheet";
import * as calls from "@/repo/db/call-records";
import { executeDbSheet, loadDbSheet } from "./db-sheet";
import { CallLeadMissing, CallSummaryError } from "./call-summary";

/** API 가 repo 를 직접 부르지 않도록 DB관리시트 저장 오류를 여기서 내보낸다. */
export { DbSheetConflict, DbSheetDuplicate, DbSheetLinkedMeetingReadOnly, DbSheetOperationBlocked } from "@/repo/db/db-sheet";

export const CallConfirm = z.object({
  /** 확인 화면을 열 때 읽은 DB 한 건의 revision — 그사이 다른 화면에서 바뀌었으면 409. */
  revision: z.number().int().nonnegative(),
  date: DbSheetDate,
  result: DbSheetResult,
  note: z.string().max(20000),
  company: CallCompanyInfo.default({}),
  custom: z.record(z.string().max(40), z.string().max(500)).default({}),
  lead: z.object({ company: z.string().max(200), owner: z.string().max(100) }).partial().default({}),
  meeting: CallMeetingDraft.nullable().default(null),
});
export type CallConfirm = z.infer<typeof CallConfirm>;

export async function confirmCall(ctx: DbSheetContext, id: string, raw: unknown) {
  if (!isCallSummaryUser(ctx.email)) throw new CallSummaryError("없는 기능이에요", 404);
  const body = CallConfirm.parse(raw);
  const m = body.meeting;
  if (m && (!m.meetingDate || !m.time)) throw new CallSummaryError("미팅 날짜와 시간을 정해 주세요", 400);
  if (m && body.result !== "컨택진행") throw new CallSummaryError("미팅을 등록하면 컨택결과는 미팅예약이에요", 400);

  const call = await calls.getCall(ctx.email, id);
  if (!call) throw new CallSummaryError("없는 통화예요", 404);
  if (call.status === "confirmed") return { already: true };
  if (!(await calls.lockConfirmCall(ctx.email, id))) {
    if ((await calls.getCall(ctx.email, id))?.status === "confirmed") return { already: true };
    throw new CallSummaryError("확인할 수 있는 상태가 아니에요", 409);
  }
  try {
    const lead = (await loadDbSheet(ctx)).find(row => row.id === call.leadId);
    if (!lead) throw new CallLeadMissing();
    if (lead.revision !== body.revision) throw new DbSheetConflict();
    const ci = lead.contact.ci;
    const custom = Object.keys(body.custom).length
      ? { ...ci.커스텀, 업체: { ...ci.커스텀?.업체, ...body.custom } }
      : ci.커스텀;
    const input = DbSheetLeadInput.parse({
      ...lead,
      company: lead.company || body.lead.company || "",
      owner: lead.owner || body.lead.owner || "",
      contact: {
        ...lead.contact,
        ci: CompanyInfo.parse({ ...ci, ...body.company, 커스텀: custom }),
        ...(m ? { meetingDate: m.meetingDate, time: m.time, place: m.place, reservationNote: m.reservationNote } : {}),
      },
    });
    let out = await executeDbSheet(ctx, { action: "save", lead: input, revision: lead.revision });
    out = await executeDbSheet(ctx, { action: "contact", id: lead.id, revision: out.leads[0]!.revision, date: body.date, result: body.result, note: body.note });
    if (m) out = await executeDbSheet(ctx, { action: "meeting", id: lead.id, revision: out.leads[0]!.revision, place: m.place });
    return { lead: out.leads[0] };
  } catch (e) {
    await calls.unlockConfirmCall(id);
    throw e;
  }
}
