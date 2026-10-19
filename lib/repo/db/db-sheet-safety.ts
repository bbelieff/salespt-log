/** Tenant-scoped duplicate checks and conservative permanent deletion guards. */
import type { PoolClient } from "pg";
import type { DbSheetContext,DbSheetLead,DbSheetLeadInput } from "@/types/db-sheet";
import { isSameLead } from "@/util/db-sheet-identity";
export class DbSheetDuplicate extends Error {
 constructor(public duplicates:Pick<DbSheetLead,'id'|'company'|'phone'>[],public duplicateLeadId?:string){super("같은 업체가 이미 있어요. 기존 업체를 수정하거나 별도로 등록해 주세요.");}
}
export async function assertNotDuplicate(c:Pick<PoolClient,'query'>,ctx:DbSheetContext,input:DbSheetLeadInput){
 const rows=await c.query('select data from db_sheet_leads where spreadsheet_id=$1 and id<>$2',[ctx.spreadsheetId,input.id]);
 const duplicates=rows.rows.map((r:{data:DbSheetLead})=>r.data).filter((l:DbSheetLead)=>isSameLead(input,l));
 if(duplicates.length)throw new DbSheetDuplicate(duplicates.map(({id,company,phone}:DbSheetLead)=>({id,company,phone})),input.id);
}
export async function deleteBlockReason(c:Pick<PoolClient,'query'>,ctx:DbSheetContext,lead:DbSheetLead):Promise<string|undefined>{
 if(lead._recorded?.legacyUnknown)return '유입 연결 기록을 먼저 확인해 주세요.';
 if(!lead.meetingId)return;
 const rows=await c.query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab in ('meetings','contracts')",[ctx.spreadsheetId]);
 const root=rows.rows.find((r:{row_key:string})=>r.row_key===lead.meetingId);
 if(root&&!root.payload._cleared)return '미팅이 남아 있어요. STEP 3에서 먼저 확인해 주세요.';
 if(root?.payload.previousMeetingId||rows.rows.some((r:{payload:Record<string,unknown>})=>r.payload.previousMeetingId===lead.meetingId||r.payload.linkedMeetingId===lead.meetingId||r.payload.meetingId===lead.meetingId))return '연결된 일정·계약이 있어 영구삭제할 수 없어요.';
 if(root&&(root.payload.상태==='계약'||root.payload.계약여부===true||root.payload.계약여부==='Y'))return '계약된 업체는 영구삭제할 수 없어요.';
}
