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
import {listDbSheet,saveDbSheetLead,saveDbSheetContact,registerDbSheetMeeting,importDbSheetLeads,changeDbSheetRecording,deleteDbSheetLead,listDbSheetSuppliers,DbSheetDuplicate} from "@/repo/db/db-sheet";
const ctx={spreadsheetId:"synthetic-sheet-a",cohort:"fixture",email:"owner@example.test"};
const other={...ctx,spreadsheetId:"synthetic-sheet-b"};
let serial=0;
const input=()=>DbSheetLeadInput.parse({id:randomUUID(),date:"2026-10-08",channel:"직접생산",company:"합성 원본업체 "+(++serial),phone:"0101234"+String(serial).padStart(4,"0"),memo:"원본 응답"});
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
 const raw=input();const created=await saveDbSheetLead(ctx,raw,null);expect(created.lead.phone).toBe("010-1234-"+String(serial).padStart(4,"0"));
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
 expect(projected.stage).toBe("계약");expect(projected.contact.companyName).toBe("변경확인업체");expect(projected.contact.meetingDate).toBe("2026-10-16");expect(projected.contact.ci.대표자이름).toBe("변경대표");expect(projected.company).toBe(lead.company);
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
 expect(result.lead.result).toBe("컨택진행");expect(result.lead.first).toBe(prior);expect((await sales("2026-11-01"))!.contactProgress).toBe(before+1);
 await registerDbSheetMeeting(ctx,lead.id,meeting,result.lead.revision);expect((await sales("2026-11-01"))!.contactProgress).toBe(before+1);
 const again=await saveDbSheetContact(ctx,lead.id,{date:"2026-11-01",result:"컨택진행",note:"다시"},result.lead.revision);expect((await sales("2026-11-01"))!.contactProgress).toBe(before+1);expect(again.lead.first).toBe(prior);
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
 await expect(saveDbSheetLead(ctx,{...projected,contact:{...projected.contact,companyName:"불가"}},projected.revision)).rejects.toThrow("STEP 3");
 await expect(saveDbSheetLead(ctx,{...projected,contact:{...projected.contact,ci:{...projected.contact.ci,대표자이름:"불가"}}},projected.revision)).rejects.toThrow("STEP 3");
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
it("save() response keeps the rescheduled lineage; stored rows never hold projection-only keys",async()=>{
 const raw=input();const [imported]=await importDbSheetLeads(ctx,randomUUID(),[raw]);
 const contacted=(await saveDbSheetContact(ctx,raw.id,{date:"2026-12-10",result:"부재",note:"투영 확인"},imported!.lead.revision)).lead;
 const meeting=Meeting.parse({id:"ignored",예약일:"2026-12-10",예약시각:"09:00",미팅날짜:"2026-12-12",미팅시간:"10:00",channel:"직접생산",업체명:"투영 합성",장소:"합성"});
 const booked=await registerDbSheetMeeting(ctx,raw.id,meeting,contacted.revision);
 const child={...meeting,id:randomUUID(),previousMeetingId:booked.meetingId,상태:"계약"};
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,child.id,JSON.stringify(child)]);
 const projected=(await listDbSheet(ctx)).find(x=>x.id===raw.id)!;
 const saved=await saveDbSheetLead(ctx,{...projected,phone:"01000009999",funnel:"계약"},projected.revision);
 expect(saved.lead.stage).toBe("계약");expect(saved.lead.effectiveMeetingId).toBe(child.id);expect(saved.lead.meetingLineageIds).toEqual([booked.meetingId,child.id]);
 const projectionOnly=["effectiveMeetingId","meetingLineageIds","funnel"];
 const stored=await query("select data from db_sheet_leads where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,raw.id]);
 const history=await query("select data from db_sheet_history where spreadsheet_id=$1 and lead_id=$2",[ctx.spreadsheetId,raw.id]);
 expect(history.rows.length).toBeGreaterThanOrEqual(4);
 for(const row of [...stored.rows,...history.rows] as {data:Record<string,unknown>}[])for(const key of projectionOnly)expect(row.data).not.toHaveProperty(key);
});
it("migration enables RLS and leaves browser/public roles without privileges",async()=>{
 const r=await query("select relrowsecurity from pg_class where relname like 'db_sheet_%' and relkind='r'");expect(r.rows).toHaveLength(4);expect(r.rows.every(x=>(x as {relrowsecurity:boolean}).relrowsecurity)).toBe(true);
 await fixture.db!.exec("create role db_sheet_browser; grant usage on schema public to db_sheet_browser; set role db_sheet_browser;");
 await expect(query("select * from db_sheet_leads")).rejects.toThrow();await fixture.db!.exec("reset role");
});

it("supports four source types and moves only this lead's inflow/contact contributions",async()=>{
 const channels=["매입DB","직접생산","현수막","콜·지·기·소"] as const;
 const date="2027-01-01",contactDate="2027-01-02",meetingDate="2027-01-05";
 for(const channel of channels){
  let lead=(await saveDbSheetLead(ctx,{...input(),date,channel,supplier:"합성 출처"},null)).lead;
  lead=(await saveDbSheetContact(ctx,lead.id,{date:contactDate,result:"컨택진행",note:"합성 상담"},lead.revision)).lead;
  const meeting=Meeting.parse({id:"ignored",예약일:contactDate,예약시각:"09:00",미팅날짜:meetingDate,미팅시간:"14:00",channel,업체명:"합성 업체",장소:"합성 소재지"});
  const booked=await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision);
  const rows=await query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key in ($2,$3)",[ctx.spreadsheetId,date+":"+channel,contactDate+":"+channel]);
  expect(rows.rows).toEqual(expect.arrayContaining([expect.objectContaining({row_key:date+":"+channel,payload:expect.objectContaining({inflow:1})}),expect.objectContaining({row_key:contactDate+":"+channel,payload:expect.objectContaining({contactProgress:1,meetingReservation:1})})]));
  expect(booked.lead.channel).toBe(channel);
  await expect(saveDbSheetLead(ctx,{...booked.lead,channel:channels[(channels.indexOf(channel)+1)%4]},booked.lead.revision)).rejects.toThrow("Linked meeting channel");
 }
 let moving=(await saveDbSheetLead(ctx,{...input(),date,channel:"매입DB"},null)).lead;
 moving=(await saveDbSheetContact(ctx,moving.id,{date:contactDate,result:"컨택진행",note:"채널 이동"},moving.revision)).lead;
 for(const channel of ["직접생산","현수막","콜·지·기·소"] as const){moving=(await saveDbSheetLead(ctx,{...moving,channel,supplier:"수정 출처"},moving.revision)).lead;}
 const totals=await query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and (row_key like $2 or row_key like $3)",[ctx.spreadsheetId,date+":%",contactDate+":%"]);
 for(const channel of channels){
  const expected=channel==="콜·지·기·소"?2:1;
  const data=totals.rows as {row_key:string;payload:Record<string,number>}[];
  expect(data.find(r=>r.row_key===date+":"+channel)?.payload.inflow).toBe(expected);
  expect(data.find(r=>r.row_key===contactDate+":"+channel)?.payload.contactProgress).toBe(expected);
 }
 expect((await listDbSheet(ctx)).find(l=>l.id===moving.id)).toMatchObject({channel:"콜·지·기·소",supplier:"수정 출처"});
});
it("follow-up generation survives drafts/reload, completes only an explicit contact, and reopens same-day scheduling",async()=>{
 const {scheduleDbSheetContact}=await import("@/repo/db/db-sheet");
 let lead=(await saveDbSheetLead(ctx,{...input(),next:"2026-10-12"},null)).lead;
 const generation=lead.followUp!.generation;
 lead=(await saveDbSheetLead(ctx,{...lead,contact:{...lead.contact,date:"2026-10-12"},followUp:{generation:99,completedGeneration:99,lastContactDate:"2099-01-01"}},lead.revision)).lead;
 expect(lead.followUp).toEqual({generation,completedGeneration:null,lastContactDate:""});
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2026-10-12",result:"부재",note:"합성"},lead.revision)).lead;
 expect(lead.next).toBe("");expect(lead.followUp!.completedGeneration).toBe(generation);
 lead=(await scheduleDbSheetContact(ctx,lead.id,"2026-10-12",lead.revision)).lead;
 expect(lead.followUp!.generation).toBe(generation+1);expect(lead.followUp!.completedGeneration).toBe(generation);
 const reloaded=(await listDbSheet(ctx)).find(r=>r.id===lead.id)!;
 expect(reloaded.followUp).toEqual(lead.followUp);expect(reloaded.next).toBe("2026-10-12");
 await expect(scheduleDbSheetContact(ctx,lead.id,"2026-10-13",lead.revision-1)).rejects.toThrow("CONFLICT");
 await expect(scheduleDbSheetContact(other,lead.id,"2026-10-13",lead.revision)).rejects.toThrow("CONFLICT");
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2026-10-11",result:"부재",note:"이전 연락"},lead.revision)).lead;
 expect(lead.next).toBe("2026-10-12");expect(lead.followUp!.completedGeneration).toBe(generation);
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2026-10-12",result:"단순거절",note:"완료"},lead.revision)).lead;
 expect(lead.next).toBe("");expect(lead.followUp!.completedGeneration).toBe(generation+1);
});
it("legacy real contact dates are read from the ledger, never from draft dates, and scheduling preserves them",async()=>{
 const {scheduleDbSheetContact}=await import("@/repo/db/db-sheet");
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2026-10-09",result:"부재",note:""},lead.revision)).lead;
 await query("update db_sheet_leads set data=data-'followUp' where id=$1",[lead.id]);
 const reloaded=(await listDbSheet(ctx)).find(r=>r.id===lead.id)!;
 expect(reloaded.followUp?.lastContactDate).toBe("2026-10-09");
 lead=(await scheduleDbSheetContact(ctx,lead.id,"2026-10-15",lead.revision)).lead;
 expect(lead.followUp?.lastContactDate).toBe("2026-10-09");
});
it("draft autosave after a completed contact cannot restore the consumed next date",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),next:"2026-10-12"},null)).lead;
 const staleDraft={...lead,company:"새 합성 이름"};
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2026-10-12",result:"부재",note:""},lead.revision)).lead;
 lead=(await saveDbSheetLead(ctx,staleDraft,lead.revision)).lead;
 expect(lead.next).toBe("");expect(lead.followUp!.completedGeneration).toBe(lead.followUp!.generation);
 lead=(await saveDbSheetLead(ctx,{...lead,next:"2026-10-12"},lead.revision,true)).lead;
 expect(lead.next).toBe("2026-10-12");expect(lead.followUp!.completedGeneration).not.toBe(lead.followUp!.generation);
});


it("import records only selected inflows and preserves explicit activity selection across retry",async()=>{
 const day="2028-01-01",batch=randomUUID();const rows=[{...input(),date:day,recording:{inflow:true,activities:true}},{...input(),date:day,recording:{inflow:false,activities:false}}];
 const added=await importDbSheetLeads(ctx,batch,rows);expect((await sales(day))?.inflow).toBe(1);
 expect(added.map(x=>x.lead.inflowStatus?.state)).toEqual(['recorded','excluded']);expect(added.map(x=>x.impact?.inflow)).toEqual([1,0]);
 const retry=await importDbSheetLeads(ctx,batch,rows);expect(retry.every(x=>!x.impact?.inflow)).toBe(true);expect((await sales(day))?.inflow).toBe(1);
 await expect(importDbSheetLeads(ctx,batch,[{...rows[0],recording:{inflow:false,activities:true}},rows[1]])).rejects.toThrow('CONFLICT');
});
it("retroactive activities are real events, selected once, and disabling never subtracts",async()=>{
 const day="2028-02-01";let lead=(await saveDbSheetLead(ctx,{...input(),date:day,recording:{inflow:false,activities:false}},null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:day,result:'부재',note:''},lead.revision)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:'2028-02-02',result:'컨택진행',note:''},lead.revision)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:'2028-02-03',result:'상담 후 거절',note:''},lead.revision)).lead;
 const meeting=Meeting.parse({id:'ignored',예약일:'2028-02-02',예약시각:'09:00',미팅날짜:'2028-02-05',미팅시간:'14:00',channel:'직접생산',업체명:'합성 선택 예약',장소:'합성'});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 expect((await sales('2028-02-02'))?.meetingReservation).toBe(0);expect((await sales('2028-02-02'))?.contactProgress??0).toBe(0);
 const preview=await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:true},true);expect(preview.impact).toMatchObject({inflow:0,contacts:2,meetings:1});expect((await sales('2028-02-02'))?.meetingReservation).toBe(0);
 let changed=await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:true});lead=changed.lead;expect(changed.impact).toMatchObject({inflow:0,contacts:2,meetings:1});expect((await sales('2028-02-02'))?.meetingReservation).toBe(1);
 changed=await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:true});lead=changed.lead;expect(changed.impact).toMatchObject({inflow:0,contacts:0,meetings:0});
 changed=await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:true,activities:true});lead=changed.lead;expect(changed.impact).toMatchObject({inflow:1,contacts:0,meetings:0});
 lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:false})).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:'2028-02-04',result:'컨택진행',note:''},lead.revision)).lead;
 expect((await sales(day))?.inflow).toBe(1);expect((await sales('2028-02-04'))?.contactProgress??0).toBe(0);expect(lead.inflowStatus?.state).toBe('recorded');
 await expect(changeDbSheetRecording(ctx,lead.id,lead.revision-1,{inflow:true,activities:true})).rejects.toThrow('CONFLICT');
 await expect(changeDbSheetRecording(other,lead.id,lead.revision,{inflow:true,activities:true})).rejects.toThrow('CONFLICT');
});
it("move and permanent delete remove only own evidence, never manual inflow/contact totals",async()=>{
 const day='2028-03-01';await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,day+':직접생산',JSON.stringify({date:day,channel:'직접생산',inflow:10,contactProgress:8})]);
 let lead=(await saveDbSheetLead(ctx,{...input(),date:day},null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:day,result:'컨택진행',note:''},lead.revision)).lead;
 lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:false})).lead;
 lead=(await saveDbSheetLead(ctx,{...lead,date:'2028-03-02',_recorded:{inflow:false,contacts:[],meeting:true}},lead.revision)).lead;
 expect((await sales(day))?.inflow).toBe(10);expect((await sales(day))?.contactProgress).toBe(9);
 const preview=await deleteDbSheetLead(ctx,lead.id,lead.revision,true);expect(preview.impact).toMatchObject({inflow:-1,contacts:-1});
 await deleteDbSheetLead(ctx,lead.id,lead.revision);expect((await sales(day))?.contactProgress).toBe(8);expect((await sales('2028-03-02'))?.inflow).toBe(0);
 await expect(deleteDbSheetLead(ctx,lead.id,lead.revision)).rejects.toThrow('CONFLICT');
});
it("normalized duplicates need explicit override and duplicate batch is atomic",async()=>{
 const original={...input(),company:'합성 중복 회사',phone:'010-9000-1234'};const first=await saveDbSheetLead(ctx,original,null);
 const duplicate={...input(),company:'다른 합성 이름',phone:'+821090001234'};
 await expect(saveDbSheetLead(ctx,duplicate,null)).rejects.toBeInstanceOf(DbSheetDuplicate);
 await expect(saveDbSheetLead(ctx,{...duplicate,phone:'',company:'합성중복회사'},null)).rejects.toBeInstanceOf(DbSheetDuplicate);
 await expect(saveDbSheetLead(other,duplicate,null)).resolves.toBeDefined();
 const allowed=await saveDbSheetLead(ctx,duplicate,null,false,true);expect(allowed.lead.id).not.toBe(first.lead.id);
 const one=input(),two={...one,id:randomUUID()};await expect(importDbSheetLeads(ctx,randomUUID(),[one,two])).rejects.toBeInstanceOf(DbSheetDuplicate);expect((await listDbSheet(ctx)).some(x=>x.id===one.id)).toBe(false);
 await expect(importDbSheetLeads(ctx,randomUUID(),[one,two],[two.id])).resolves.toHaveLength(2);
});
it("deleted reservations do not resurrect on settings activation; linked active/descendant rows block lead deletion",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),date:'2028-04-01',recording:{inflow:false,activities:false}},null)).lead;
 const meeting=Meeting.parse({id:'ignored',예약일:'2028-04-01',예약시각:'09:00',미팅날짜:'2028-04-05',미팅시간:'14:00',channel:'직접생산',업체명:'합성 삭제 예약',장소:'합성'});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 expect((await deleteDbSheetLead(ctx,lead.id,lead.revision,true)).impact.blockedReason).toBeTruthy();
 await expect(deleteDbSheetLead(ctx,lead.id,lead.revision)).rejects.toThrow();
 await query("update sheet_rows set payload=payload||'{\"_cleared\":true}'::jsonb where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,lead.meetingId]);
 const enabled=await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:true,activities:true});lead=enabled.lead;expect(enabled.impact.meetings).toBe(0);expect(lead._recorded?.meeting).toBe(false);
 const child={...meeting,id:randomUUID(),previousMeetingId:lead.meetingId,_cleared:true};await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,child.id,JSON.stringify(child)]);
 expect((await deleteDbSheetLead(ctx,lead.id,lead.revision,true)).impact.blockedReason).toContain('연결');
});
it("legacy evidence is projected without backfill and supplier history is tenant scoped",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),supplier:'합성 이전 공급처',date:'2028-05-01'},null)).lead;
 lead=(await saveDbSheetLead(ctx,{...lead,supplier:'합성 새 공급처'},lead.revision)).lead;
 await query("update db_sheet_leads set data=data-'_recorded'-'recording' where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id]);
 expect((await listDbSheet(ctx)).find(x=>x.id===lead.id)?.inflowStatus?.state).toBe('recorded');
 expect(await listDbSheetSuppliers(ctx)).toEqual(expect.arrayContaining(['합성 이전 공급처','합성 새 공급처']));expect(await listDbSheetSuppliers(other)).not.toContain('합성 이전 공급처');
 await query('delete from db_sheet_history where spreadsheet_id=$1 and lead_id=$2',[ctx.spreadsheetId,lead.id]);
 expect((await listDbSheet(ctx)).find(x=>x.id===lead.id)?.inflowStatus?.state).toBe('unknown');expect((await sales('2028-05-01'))?.inflow).toBe(1);
 expect((await deleteDbSheetLead(ctx,lead.id,lead.revision,true)).impact.blockedReason).toBeTruthy();await expect(deleteDbSheetLead(ctx,lead.id,lead.revision)).rejects.toThrow('확인');
 expect((await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:true,activities:true},true)).impact.inflow).toBe(0);
});
it("general meeting recomputation respects excluded rescheduled lineage and unrelated tenants",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),date:'2028-06-01',recording:{inflow:false,activities:false}},null)).lead;
 const meeting=Meeting.parse({id:'ignored',예약일:'2028-06-01',예약시각:'09:00',미팅날짜:'2028-06-05',미팅시간:'14:00',channel:'직접생산',업체명:'합성 연속 예약',장소:'합성'});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 const child={...meeting,id:randomUUID(),previousMeetingId:lead.meetingId};await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,child.id,JSON.stringify(child)]);
 const {lockedMeetingCounts}=await import('@/repo/db/sales-meeting-counts');expect((await lockedMeetingCounts({query} as never,ctx.spreadsheetId)).get('2028-06-01:직접생산')??0).toBe(0);
 const {persistSelectedMeetingCount}=await import('@/repo/db/selected-meeting-counts');await persistSelectedMeetingCount(ctx,'2028-06-01','직접생산');expect((await sales('2028-06-01'))?.meetingReservation).toBe(0);
 lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:true})).lead;expect((await sales('2028-06-01'))?.meetingReservation).toBe(2);
});

it("OFF snapshots prior reservation IDs, excludes later descendants, and ON adds only missing active meetings",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),date:'2029-01-01'},null)).lead;
 const meeting=Meeting.parse({id:'ignored',예약일:'2029-01-01',예약시각:'09:00',미팅날짜:'2029-01-05',미팅시간:'14:00',channel:'직접생산',업체명:'합성 후속 일정',장소:'합성'});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 const child={...meeting,id:randomUUID(),previousMeetingId:lead.meetingId};
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,child.id,JSON.stringify(child)]);
 const {lockedMeetingCounts}=await import('@/repo/db/sales-meeting-counts');
 expect((await lockedMeetingCounts({query} as never,ctx.spreadsheetId,true)).get('2029-01-01:직접생산')).toBe(2);
 await expect(changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:false})).rejects.toThrow('CONFLICT');
 lead=(await listDbSheet(ctx)).find(x=>x.id===lead.id)!;
 await query("update sheet_rows set payload=payload||'{\"_cleared\":true}'::jsonb where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,child.id]);
 lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:false})).lead;expect(lead._recorded?.meetingIds).toContain(child.id);
 const later={...child,id:randomUUID()};await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'meetings',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,later.id,JSON.stringify(later)]);
 expect((await lockedMeetingCounts({query} as never,ctx.spreadsheetId)).get('2029-01-01:직접생산')).toBe(1);
 await query("update sheet_rows set payload=payload||'{\"_cleared\":false}'::jsonb where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,child.id]);
 expect((await lockedMeetingCounts({query} as never,ctx.spreadsheetId)).get('2029-01-01:직접생산')).toBe(2);
 const preview=await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:true,activities:true},true);expect(preview.impact.meetings).toBe(1);
 lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:true,activities:true})).lead;expect((await sales('2029-01-01'))?.meetingReservation).toBe(3);
 expect((await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:true,activities:true},true)).impact.meetings).toBe(0);
});
it("permanent lead deletion retains a non-restorable tombstone for pending mirror convergence",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),date:'2029-02-01'},null)).lead;
 const meeting=Meeting.parse({id:'ignored',예약일:'2029-02-01',예약시각:'09:00',미팅날짜:'2029-02-05',미팅시간:'14:00',channel:'직접생산',업체명:'합성 영구삭제',장소:'합성'});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 await query("update sheet_rows set payload=payload||'{\"_cleared\":true}'::jsonb where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,lead.meetingId]);
 await deleteDbSheetLead(ctx,lead.id,lead.revision);
 const tombstone=await query("select payload,mirror_pending from sheet_rows where spreadsheet_id=$1 and tab='meetings' and row_key=$2",[ctx.spreadsheetId,lead.meetingId]);
 expect(tombstone.rows).toHaveLength(1);expect(tombstone.rows[0]).toMatchObject({payload:{_cleared:true,_dbSheetLeadDeleted:true},mirror_pending:true});
 expect((await listDbSheet(ctx)).some(x=>x.id===lead.id)).toBe(false);
});

// Display dates are deliberately broader than STEP 2 qualified consultation counts.
it.each([
 ["미컨택", false, false], ["부재", false, false],
 ["단순거절", true, false], ["재통화", true, false],
 ["컨택진행", true, true], ["상담 후 거절", true, true],
] as const)("first contact date for %s survives save/reload without changing qualification", async (result, recordsFirst, qualified) => {
 const date="2027-01-11", before=(await sales(date))?.contactProgress??0;
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date,result,note:"합성 날짜 검증"},lead.revision)).lead;
 expect(lead.first).toBe(recordsFirst?date:"");expect(lead.hasQualifiedContact).toBe(qualified);
 expect(lead.stage).toBe(qualified?"상담 중":"미컨택");
 expect((await sales(date))?.contactProgress??0).toBe(before+Number(qualified));
 lead=(await saveDbSheetLead(ctx,{...lead,supplier:"합성 공급처",hasQualifiedContact:!qualified,first:"2099-01-01"},lead.revision)).lead;
 const reloaded=(await listDbSheet(ctx)).find(row=>row.id===lead.id)!;
 expect(reloaded).toMatchObject({first:recordsFirst?date:"",hasQualifiedContact:qualified});
});
it("keeps the first entered date through later/backdated contacts, nonqualified results and booking",async()=>{
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 for(const [date,result] of [["2027-02-10","단순거절"],["2027-02-11","재통화"],["2027-02-12","컨택진행"],["2027-02-09","상담 후 거절"],["2027-02-12","부재"],["2027-02-13","미컨택"]]){
  lead=(await saveDbSheetContact(ctx,lead.id,{date:date!,result:result!,note:"합성"},lead.revision)).lead;
  expect(lead.first).toBe("2027-02-10");
 }
 expect(lead.hasQualifiedContact).toBe(true);expect(lead.stage).toBe("상담 중");
 const meeting=Meeting.parse({id:"ignored",예약일:"2027-02-14",예약시각:"09:00",미팅날짜:"2027-02-15",미팅시간:"10:00",channel:"직접생산",업체명:"합성 예약",장소:"합성"});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 expect(lead.first).toBe("2027-02-10");expect(lead.hasQualifiedContact).toBe(true);
 expect((await listDbSheet(ctx)).find(row=>row.id===lead.id)!.first).toBe("2027-02-10");
});
it("activity recording OFF still keeps display date and qualified history for the funnel",async()=>{
 let lead=(await saveDbSheetLead(ctx,{...input(),recording:{inflow:false,activities:false}},null)).lead;
 const date="2027-03-10",before=(await sales(date))?.contactProgress??0;
 lead=(await saveDbSheetContact(ctx,lead.id,{date,result:"재통화",note:"합성"},lead.revision)).lead;
 expect(lead).toMatchObject({first:date,hasQualifiedContact:false});
 lead=(await saveDbSheetContact(ctx,lead.id,{date,result:"컨택진행",note:"합성"},lead.revision)).lead;
 expect(lead).toMatchObject({first:date,hasQualifiedContact:true});expect(lead._recorded?.contacts).toEqual([]);
 expect((await sales(date))?.contactProgress??0).toBe(before);
 expect((await listDbSheet(ctx)).find(row=>row.id===lead.id)!.hasQualifiedContact).toBe(true);
});
