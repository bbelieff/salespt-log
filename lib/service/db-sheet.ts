import { z } from "zod";
import { findUserByEmail } from "@/repo/users";

import * as ledger from "@/repo/db/db-sheet";
import { DbSheetLeadInput, DbSheetRecording, DbSheetDate, DbSheetResult, type DbSheetContext, type DbSheetChange, type DbSheetImpact } from "@/types/db-sheet";
import { Meeting } from "@/types/meeting";
import { sourceCohort, usesDbStorage } from "./daily-source";
import { queueSalesRowSync } from "./sales-write";
import { queueDbSheetProductionSync } from "./db-sheet-sync";
import { queueMeetingSheetSync } from "./meetings-write";
import { projectDbSheetWorkStatus, loadDbSheetWorkProjector } from "./db-sheet-status";

const revision = z.number().int().positive();
export const DbSheetCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), lead: DbSheetLeadInput, revision: revision.nullable(), scheduleNext: z.boolean().optional(), allowDuplicate:z.boolean().optional() }),
  z.object({ action: z.literal("contact"), id: z.string().uuid(), revision, date: DbSheetDate, result: DbSheetResult, note: z.string().max(20000) }),
  z.object({ action: z.literal("first-date"), id:z.string().uuid(), revision, first:z.union([DbSheetDate,z.literal("")]) }),
  z.object({action:z.literal("inflow-preview"),id:z.string().uuid(),revision,inflow:z.boolean()}),
  z.object({action:z.literal("inflow"),id:z.string().uuid(),revision,inflow:z.boolean()}),
  z.object({ action: z.literal("schedule"), id: z.string().uuid(), revision, next: z.union([DbSheetDate, z.literal("")]) }),
  z.object({ action: z.literal("meeting"), id: z.string().uuid(), revision }),
  z.object({ action: z.literal("import"), batchId: z.string().uuid(), leads: z.array(DbSheetLeadInput).min(1).max(500),allowDuplicateIds:z.array(z.string().uuid()).max(500).optional() }),
  z.object({action:z.literal("recording-preview"),id:z.string().uuid(),revision,recording:DbSheetRecording}),
  z.object({action:z.literal("recording"),id:z.string().uuid(),revision,recording:DbSheetRecording}),
  z.object({action:z.literal("delete-preview"),id:z.string().uuid(),revision}),
  z.object({action:z.literal("delete"),id:z.string().uuid(),revision,confirmed:z.literal(true)}),
]);
export class DbSheetUnavailable extends Error {}

export async function resolveDbSheetContext(email: string, sheetOverride?: string): Promise<DbSheetContext> {
  const user = await findUserByEmail(email, { fresh: true });
  if (!user?.spreadsheetId || (sheetOverride && sheetOverride !== user.spreadsheetId)) {
    throw new DbSheetUnavailable("개인 DB 연결을 확인할 수 없습니다.");
  }
  const cohort = sourceCohort(user);
  if (!usesDbStorage(cohort)) {
    throw new DbSheetUnavailable("이 계정은 아직 DB관리시트를 지원하지 않습니다.");
  }
  return { spreadsheetId: user.spreadsheetId, cohort, email };
}

export const loadDbSheetSuppliers=ledger.listDbSheetSuppliers;
export async function loadDbSheet(ctx: DbSheetContext) {
  return projectDbSheetWorkStatus(ctx, (await ledger.listDbSheet(ctx)).map(row=>{const {_recorded,...lead}=row;void _recorded;return lead;}));
}

function sync(ctx: DbSheetContext, changes: DbSheetChange[]) {
  const refs = new Set<string>();
  for (const change of changes) {
    for (const row of change.changedSales) {
      const key = `${row.date}:${row.channel}`;
      if (!refs.has(key)) { refs.add(key); queueSalesRowSync(ctx, row.date, row.channel); if(row.channel === "직접생산")queueDbSheetProductionSync(ctx,row.date); }
    }
    if (change.meetingId) queueMeetingSheetSync(ctx, change.meetingId);
  }
}

export async function executeDbSheet(ctx: DbSheetContext, command: z.infer<typeof DbSheetCommand>) {
  const projectStatus = await loadDbSheetWorkProjector(ctx);
  let changes: DbSheetChange[];
  switch (command.action) {
    case "save": changes=[command.allowDuplicate!==undefined
      ?await ledger.saveDbSheetLead(ctx,command.lead,command.revision,!!command.scheduleNext,command.allowDuplicate)
      :command.scheduleNext?await ledger.saveDbSheetLead(ctx,command.lead,command.revision,true):await ledger.saveDbSheetLead(ctx,command.lead,command.revision)];break;
    case "recording-preview": case "recording": changes=[await ledger.changeDbSheetRecording(ctx,command.id,command.revision,command.recording,command.action==='recording-preview')];break;
    case "delete-preview": case "delete": changes=[await ledger.deleteDbSheetLead(ctx,command.id,command.revision,command.action==='delete-preview')];break;
    case "contact": changes = [await ledger.saveDbSheetContact(ctx, command.id, command, command.revision)]; break;
    case "first-date": changes = [await ledger.setDbSheetFirstDate(ctx, command.id, command.first, command.revision)]; break;
    case "inflow-preview": case "inflow": changes=[await ledger.changeDbSheetInflow(ctx,command.id,command.revision,command.inflow,command.action==="inflow-preview")];break;
    case "schedule": changes = [await ledger.scheduleDbSheetContact(ctx, command.id, command.next, command.revision)]; break;
    case "import": changes = command.allowDuplicateIds?await ledger.importDbSheetLeads(ctx,command.batchId,command.leads,command.allowDuplicateIds):await ledger.importDbSheetLeads(ctx, command.batchId, command.leads); break;
    case "meeting": {
      const lead = (await ledger.listDbSheet(ctx)).find(row => row.id === command.id);
      if (!lead || lead.revision !== command.revision) throw new ledger.DbSheetConflict();
      const draft = lead.contact;
      const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      const meeting = Meeting.parse({
        id: command.id, 예약일: draft.date, 예약시각: time,
        미팅날짜: draft.meetingDate, 미팅시간: draft.time, channel: lead.channel,
        업체명: draft.companyName.trim() || lead.company,
        장소: draft.ci.소재지?.trim() || "", 예약비고: draft.reservationNote,
        업체정보: draft.ci,
      });
      changes = [await ledger.registerDbSheetMeeting(ctx, command.id, meeting, command.revision)];
      break;
    }
  }
  if(!command.action.endsWith('-preview'))sync(ctx, changes);
  const impact:DbSheetImpact={inflow:0,contacts:0,meetings:0,rows:[]};
  for(const change of changes){if(!change.impact)continue;for(const row of change.impact.rows){const target=impact.rows.find(x=>x.date===row.date&&x.channel===row.channel);if(target){target.inflow+=row.inflow;target.contacts+=row.contacts;target.meetings+=row.meetings;}else impact.rows.push({...row});}impact.inflow+=change.impact.inflow;impact.contacts+=change.impact.contacts;impact.meetings+=change.impact.meetings;if(change.impact.blockedReason)impact.blockedReason=change.impact.blockedReason;}
  return {leads:command.action==='delete'?[]:projectStatus(changes.map(change => {const {_recorded,...lead}=change.lead;void _recorded;return lead;})),impact,...(command.action==='delete'?{deletedId:command.id}:{})};
}
