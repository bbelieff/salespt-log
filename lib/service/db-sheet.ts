import { z } from "zod";
import { findUserByEmail } from "@/repo/users";
import { dbEnabled } from "@/repo/db/client";
import * as ledger from "@/repo/db/db-sheet";
import { DbSheetLeadInput, DbSheetDate, DbSheetResult, type DbSheetContext, type DbSheetChange } from "@/types/db-sheet";
import { Meeting } from "@/types/meeting";
import { chooseWriteSource, sourceCohort } from "./daily-source";
import { queueSalesRowSync } from "./sales-write";
import { queueDbSheetProductionSync } from "./db-sheet-sync";
import { queueMeetingSheetSync } from "./meetings-write";
import { projectDbSheetWorkStatus, loadDbSheetWorkProjector } from "./db-sheet-status";

const revision = z.number().int().positive();
export const DbSheetCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), lead: DbSheetLeadInput, revision: revision.nullable() }),
  z.object({ action: z.literal("contact"), id: z.string().uuid(), revision, date: DbSheetDate, result: DbSheetResult, note: z.string().max(20000) }),
  z.object({ action: z.literal("meeting"), id: z.string().uuid(), revision }),
  z.object({ action: z.literal("import"), batchId: z.string().uuid(), leads: z.array(DbSheetLeadInput).min(1).max(500) }),
]);
export class DbSheetUnavailable extends Error {}

export async function resolveDbSheetContext(email: string, sheetOverride?: string): Promise<DbSheetContext> {
  const user = await findUserByEmail(email, { fresh: true });
  if (!user?.spreadsheetId || (sheetOverride && sheetOverride !== user.spreadsheetId)) {
    throw new DbSheetUnavailable("개인 DB 연결을 확인할 수 없습니다.");
  }
  const cohort = sourceCohort(user);
  if (chooseWriteSource(cohort, dbEnabled()) !== "db") {
    throw new DbSheetUnavailable("이 계정은 아직 DB관리시트를 지원하지 않습니다.");
  }
  return { spreadsheetId: user.spreadsheetId, cohort, email };
}

export async function loadDbSheet(ctx: DbSheetContext) {
  return projectDbSheetWorkStatus(ctx, await ledger.listDbSheet(ctx));
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
    case "save": changes = [await ledger.saveDbSheetLead(ctx, command.lead, command.revision)]; break;
    case "contact": changes = [await ledger.saveDbSheetContact(ctx, command.id, command, command.revision)]; break;
    case "import": changes = await ledger.importDbSheetLeads(ctx, command.batchId, command.leads); break;
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
  sync(ctx, changes);
  return projectStatus(changes.map(change => change.lead));
}
