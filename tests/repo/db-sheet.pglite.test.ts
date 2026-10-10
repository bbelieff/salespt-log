/** Isolated actual PostgreSQL SQL; no network or production credentials. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll,afterAll,it,expect,vi } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";
import { Meeting } from "@/types/meeting";
const fixture=vi.hoisted(()=>({db:null as PGlite|null}));
vi.mock("@/repo/db/client",()=>({dbEnabled:()=>true,getDbPool:()=>({query:query,connect:async()=>({query,release(){}})})}));
async function query(sql:string,params:unknown[]=[]){const r=await fixture.db!.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}
import {listDbSheet,saveDbSheetLead,saveDbSheetContact,registerDbSheetMeeting,importDbSheetLeads} from "@/repo/db/db-sheet";
const ctx={spreadsheetId:"synthetic-sheet-a",cohort:"fixture",email:"owner@example.test"};
const other={...ctx,spreadsheetId:"synthetic-sheet-b"};
const input=()=>DbSheetLeadInput.parse({id:randomUUID(),date:"2026-10-08",channel:"직접생산",company:"합성 원본업체",phone:"01012345678",memo:"원본 응답"});
async function sales(date:string){const r=await query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2",[ctx.spreadsheetId,date+":직접생산"]);return (r.rows[0] as {payload:Record<string,number>}|undefined)?.payload;}
beforeAll(async()=>{
 fixture.db=new PGlite();await fixture.db.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
 await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql","utf8"));
 // Load the shared meeting parser in setup; parallel suite module boot is not a query timeout.
 const {lockedMeetingCounts}=await import("@/repo/db/sales-meeting-counts");
 await lockedMeetingCounts({query} as never,ctx.spreadsheetId);
},60000);
afterAll(async()=>{await fixture.db?.close();});
it("persists original source and verified info separately; tenant/revision guards",async()=>{
 const raw=input();const created=await saveDbSheetLead(ctx,raw,null);expect(created.lead.phone).toBe("010-1234-5678");
 expect((await sales(raw.date))?.inflow).toBe(1);expect((await sales(raw.date))?.production).toBe(1);
 const updated=await saveDbSheetLead(ctx,{...created.lead,contact:{...created.lead.contact,companyName:"확인 업체",ci:{대표자이름:"확인 대표"}},first:"2099-01-01",stage:"완료"},1);
 expect(updated.lead.company).toBe(raw.company);expect(updated.lead.contact.companyName).toBe("확인 업체");expect(updated.lead.first).toBe("");expect(updated.lead.stage).toBe("미컨택");expect(updated.lead.memo).toBe("원본 응답");
 expect(await listDbSheet(other)).toEqual([]);await expect(saveDbSheetLead(ctx,raw,1)).rejects.toThrow("CONFLICT");
 await expect(saveDbSheetContact(other,raw.id,{date:raw.date,result:"컨택진행",note:""},2)).rejects.toThrow("CONFLICT");
 const reload=(await listDbSheet(ctx)).find(x=>x.id===raw.id)!;expect(reload.contact.ci.대표자이름).toBe("확인 대표");
});
it("counts one qualified consultation per lead/date; refusals and repeats preserve history",async()=>{
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 for(const [date,result,expected] of [["2026-10-09","부재",0],["2026-10-09","단순거절",0],["2026-10-09","컨택진행",1],["2026-10-09","컨택진행",1],["2026-10-09","재통화",1],["2026-10-10","상담 후 거절",1]] as const){
 lead=(await saveDbSheetContact(ctx,lead.id,{date,result,note:result+" 메모"},lead.revision)).lead;expect((await sales(date))?.contactProgress??0).toBe(expected);}
 expect(lead.first).toBe("2026-10-09");expect(lead.memo).toBe("원본 응답");
 const r=await query('select count(*)::int n from db_sheet_history where lead_id=$1',[lead.id]);expect((r.rows[0] as {n:number}).n).toBe(7);
 const before=(await sales("2026-10-08"))!.inflow!;lead=(await saveDbSheetLead(ctx,{...lead,date:"2026-10-11"},lead.revision)).lead;
 expect((await sales("2026-10-08"))!.inflow).toBe(before-1);expect((await sales("2026-10-11"))!.inflow).toBe(1);expect((await sales("2026-10-09"))!.contactProgress).toBe(1);
});
it("batch retry is idempotent, payload conflict and partial batch failure roll back",async()=>{
 const batch=randomUUID(),rows=[input(),input()];const a=await importDbSheetLeads(ctx,batch,rows);const b=await importDbSheetLeads(ctx,batch,rows);expect(b.map(x=>x.lead.id)).toEqual(a.map(x=>x.lead.id));
 await expect(importDbSheetLeads(ctx,batch,[input()])).rejects.toThrow("CONFLICT");
 const meeting=Meeting.parse({id:"ignored",예약일:"2026-10-20",예약시각:"09:00",미팅날짜:"2026-10-25",미팅시간:"14:00",channel:"직접생산",업체명:"배치 확인업체",장소:"합성"});
 const booked=await registerDbSheetMeeting(ctx,a[0]!.lead.id,meeting,a[0]!.lead.revision);
 await query("update sheet_rows set payload=payload || $2::jsonb where row_key=$1",[booked.meetingId,JSON.stringify({상태:"계약",업체명:"배치 변경업체"})]);
 const replay=await importDbSheetLeads(ctx,batch,rows);expect(replay[0]!.lead.effectiveMeetingId).toBe(booked.meetingId);expect(replay[0]!.lead.stage).toBe("계약");expect(replay[0]!.lead.contact.companyName).toBe("배치 변경업체");expect(replay[0]!.changedSales).toEqual([]);

 const newRow=input();await expect(importDbSheetLeads(ctx,randomUUID(),[newRow,rows[0]])).rejects.toThrow("CONFLICT");expect((await listDbSheet(ctx)).some(x=>x.id===newRow.id)).toBe(false);
});
it("meeting registration persists real Meeting payload, links once and preserves reservation count",async()=>{
 const lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 const meeting=Meeting.parse({id:"ignored",예약일:"2026-10-12",예약시각:"09:00",미팅날짜:"2026-10-15",미팅시간:"14:00",channel:"직접생산",업체명:"합성 확인업체",장소:"합성 소재지",업체정보:{대표자이름:"합성 대표"}});
 const registered=await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision);const retried=await registerDbSheetMeeting(ctx,lead.id,meeting,registered.lead.revision);
 expect(retried.meetingId).toBe(registered.meetingId);expect((await sales("2026-10-12"))!.meetingReservation).toBe(1);
 const r=await query("select payload from sheet_rows where tab='meetings' and row_key=$1",[registered.meetingId]);expect(r.rows).toHaveLength(1);expect(Meeting.parse((r.rows[0] as {payload:unknown}).payload).업체정보?.대표자이름).toBe("합성 대표");
});
it("projects linked meeting edits only inside the tenant without changing original DB source",async()=>{
 const lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 const meeting=Meeting.parse({id:"ignored",예약일:"2026-10-13",예약시각:"09:00",미팅날짜:"2026-10-15",미팅시간:"14:00",channel:"직접생산",업체명:"확인업체",장소:"확인소재지"});
 const result=await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision);
 await query("update sheet_rows set payload=payload || $2::jsonb where row_key=$1",[result.meetingId,JSON.stringify({상태:"계약",업체명:"변경확인업체",업체정보:{대표자이름:"변경대표"},미팅날짜:"2026-10-16"})]);
 const projected=(await listDbSheet(ctx)).find(x=>x.id===lead.id)!;
 expect(projected.stage).toBe("계약");expect(projected.contact.companyName).toBe("변경확인업체");expect(projected.contact.meetingDate).toBe("2026-10-16");expect(projected.contact.ci.대표자이름).toBe("변경대표");expect(projected.company).toBe("합성 원본업체");
 expect(await listDbSheet(other)).toEqual([]);
 await query("update sheet_rows set payload=payload || '{\"_cleared\":true}'::jsonb where row_key=$1",[result.meetingId]);
 expect((await listDbSheet(ctx)).find(x=>x.id===lead.id)!.stage).toBe("미팅 삭제됨");
});
it("booking qualifies absence and counts same/other consultation days exactly once",async()=>{
 for(const prior of ["2026-11-01","2026-11-02"]){
 let lead=(await saveDbSheetLead(ctx,{...input(),date:"2026-11-01"},null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:prior,result:prior==="2026-11-01"?"부재":"컨택진행",note:"상담 보존"},lead.revision)).lead;
 const before=(await sales("2026-11-01"))?.contactProgress??0;
 const meeting=Meeting.parse({id:"ignored",예약일:"2026-11-01",예약시각:"09:00",미팅날짜:"2026-11-05",미팅시간:"14:00",channel:"직접생산",업체명:"예약 합성",장소:"합성 소재지"});
 const result=await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision);
 expect(result.lead.result).toBe("컨택진행");expect(result.lead.first).toBe("2026-11-01");expect((await sales("2026-11-01"))!.contactProgress).toBe(before+1);
 await registerDbSheetMeeting(ctx,lead.id,meeting,result.lead.revision);expect((await sales("2026-11-01"))!.contactProgress).toBe(before+1);
 const again=await saveDbSheetContact(ctx,lead.id,{date:"2026-11-01",result:"컨택진행",note:"다시"},result.lead.revision);expect((await sales("2026-11-01"))!.contactProgress).toBe(before+1);expect(again.lead.first).toBe("2026-11-01");
 }
});
it("meeting descendant projection and readonly guard preserve editable raw fields",async()=>{
 const lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 const meeting=Meeting.parse({id:"ignored",예약일:"2026-12-01",예약시각:"09:00",미팅날짜:"2026-12-05",미팅시간:"14:00",channel:"직접생산",업체명:"예약합성",장소:"합성"});
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,"2026-12-01:직접생산",JSON.stringify({date:"2026-12-01",channel:"직접생산",meetingReservation:99})]);
 const r=await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision);expect((await sales("2026-12-01"))!.meetingReservation).toBe(1);
 const child={...meeting,id:randomUUID(),previousMeetingId:r.meetingId,상태:"계약",업체명:"변경 업체",업체정보:{대표자이름:"변경대표"}};
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,child.id,JSON.stringify(child)]);
 const projected=(await listDbSheet(ctx)).find(x=>x.id===lead.id)!;expect(projected.stage).toBe("계약");expect(projected.contact.companyName).toBe("변경 업체");expect(projected.meetingId).toBe(r.meetingId);expect(projected.effectiveMeetingId).toBe(child.id);expect(projected.meetingLineageIds).toEqual([r.meetingId,child.id]);
 await expect(saveDbSheetLead(ctx,{...projected,contact:{...projected.contact,companyName:"불가"}},projected.revision)).rejects.toThrow("컨택관리");
 await expect(saveDbSheetLead(ctx,{...projected,contact:{...projected.contact,ci:{...projected.contact.ci,대표자이름:"불가"}}},projected.revision)).rejects.toThrow("컨택관리");
 const saved=await saveDbSheetLead(ctx,{...projected,company:"원본수정",contact:{...projected.contact,note:"추가상담"}},projected.revision);expect(saved.lead.company).toBe("원본수정");expect(saved.lead.contact.note).toBe("추가상담");expect(saved.lead.contact.companyName).toBe("변경 업체");
 const grandchild={...child,id:randomUUID(),previousMeetingId:child.id,상태:"변경"};
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,grandchild.id,JSON.stringify(grandchild)]);
 const advanced=(await listDbSheet(ctx)).find(x=>x.id===lead.id)!;expect(advanced.meetingLineageIds).toEqual([r.meetingId,child.id,grandchild.id]);expect(advanced.effectiveMeetingId).toBe(grandchild.id);
 await query("update sheet_rows set payload=payload || $2::jsonb where row_key=$1",[grandchild.id,JSON.stringify({_cleared:true})]);
 await query("update sheet_rows set payload=payload || $2::jsonb where row_key=$1",[child.id,JSON.stringify({_cleared:true})]);
 const restored=(await listDbSheet(ctx)).find(x=>x.id===lead.id)!;expect(restored.stage).toBe("미팅예약");expect(restored.effectiveMeetingId).toBe(r.meetingId);expect(restored.meetingLineageIds).toEqual([r.meetingId]);expect(restored.contact.companyName).toBe("예약합성");
 await query("update sheet_rows set payload=payload || $2::jsonb where row_key=$1",[r.meetingId,JSON.stringify({_cleared:true})]);
 expect((await listDbSheet(ctx)).find(x=>x.id===lead.id)!.stage).toBe("미팅 삭제됨");
});
it("migration enables RLS and leaves browser/public roles without privileges",async()=>{
 const r=await query("select relrowsecurity from pg_class where relname like 'db_sheet_%' and relkind='r'");expect(r.rows).toHaveLength(4);expect(r.rows.every(x=>(x as {relrowsecurity:boolean}).relrowsecurity)).toBe(true);
 await fixture.db!.exec("create role db_sheet_browser; grant usage on schema public to db_sheet_browser; set role db_sheet_browser;");
 await expect(query("select * from db_sheet_leads")).rejects.toThrow();await fixture.db!.exec("reset role");
});
