/** Synthetic PostgreSQL coverage for explicitly editable display/AS/inflow data. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll,afterAll,it,expect,vi } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";
import { Meeting } from "@/types/meeting";
const fixture=vi.hoisted(()=>({db:null as PGlite|null}));
vi.mock("@/repo/db/client",()=>({dbEnabled:()=>true,getDbPool:()=>({query,connect:async()=>({query,release(){}})})}));
async function query(sql:string,params:unknown[]=[]){const r=await fixture.db!.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}
import {listDbSheet,saveDbSheetLead,saveDbSheetContact,setDbSheetFirstDate,registerDbSheetMeeting,changeDbSheetInflow,changeDbSheetRecording} from "@/repo/db/db-sheet";
const ctx={spreadsheetId:"adaptive-synthetic",cohort:"fixture",email:"adaptive@example.test"};
const other={...ctx,spreadsheetId:"other-synthetic"};
let serial=0;
const input=()=>DbSheetLeadInput.parse({id:randomUUID(),date:"2027-03-01",channel:"직접생산",company:"합성 확인 "+(++serial),phone:"010-0000-"+String(serial).padStart(4,"0")});
const get=async(id:string)=>(await listDbSheet(ctx)).find(x=>x.id===id)!;
const sales=async()=>JSON.stringify((await query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='sales' order by row_key",[ctx.spreadsheetId])).rows);
beforeAll(async()=>{
 fixture.db=new PGlite();await fixture.db.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
 await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql","utf8"));
 const {lockedMeetingCounts}=await import("@/repo/db/sales-meeting-counts");await lockedMeetingCounts({query} as never,ctx.spreadsheetId);
},60000);
afterAll(async()=>{await fixture.db?.close();});
it("AS data survives reload and omitted old-client fields; AS itself adds no consultation",async()=>{
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 const before=await sales();
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2027-03-02",result:"AS예정",note:"교환 요청"},lead.revision)).lead;
 expect(lead.first).toBe("");expect(lead.hasQualifiedContact).toBe(false);expect(await sales()).toBe(before);
 lead=(await saveDbSheetLead(ctx,{...lead,asReceived:true,asNote:"새 DB 전달받음"},lead.revision)).lead;
 expect(await get(lead.id)).toMatchObject({result:"AS예정",asReceived:true,asNote:"새 DB 전달받음"});
 const {asReceived,asNote,...oldClient}=lead;void asReceived;void asNote;
 lead=(await saveDbSheetLead(ctx,{...oldClient,supplier:"합성 공급"},lead.revision)).lead;
 expect(lead).toMatchObject({asReceived:true,asNote:"새 DB 전달받음"});
 lead=(await saveDbSheetLead(ctx,{...lead,asReceived:false,asNote:""},lead.revision)).lead;
 expect(await get(lead.id)).toMatchObject({asReceived:false,asNote:""});
 await expect(saveDbSheetLead(other,lead,lead.revision)).rejects.toThrow("CONFLICT");
 await expect(saveDbSheetLead(ctx,lead,1)).rejects.toThrow("CONFLICT");
});
it("AS after qualified consultation preserves historical daily contributions",async()=>{
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2027-03-03",result:"컨택진행",note:"상담"},lead.revision)).lead;
 const before=await sales();
 for(const date of ["2027-03-03","2027-03-04"]){lead=(await saveDbSheetContact(ctx,lead.id,{date,result:"AS예정",note:"교환"},lead.revision)).lead;expect(await sales()).toBe(before);}
 expect(lead.hasQualifiedContact).toBe(true);expect(lead.first).toBe("2027-03-03");
});
it("first date can be edited/cleared without shifting totals; manual clear survives save/contact/meeting",async()=>{
 let lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2027-03-05",result:"단순거절",note:""},lead.revision)).lead;
 const before=await sales();
 lead=(await setDbSheetFirstDate(ctx,lead.id,"2027-02-28",lead.revision)).lead;
 expect(await sales()).toBe(before);expect(lead).toMatchObject({first:"2027-02-28",firstManual:true,hasQualifiedContact:false});
 await expect(setDbSheetFirstDate(other,lead.id,"",lead.revision)).rejects.toThrow("CONFLICT");
 await expect(setDbSheetFirstDate(ctx,lead.id,"2027-02-30",lead.revision)).rejects.toThrow();
 await expect(setDbSheetFirstDate(ctx,lead.id,"",1)).rejects.toThrow("CONFLICT");
 lead=(await setDbSheetFirstDate(ctx,lead.id,"",lead.revision)).lead;
 lead=(await saveDbSheetLead(ctx,{...lead,first:"2099-01-01",firstManual:false,supplier:"합성"},lead.revision)).lead;
 expect(lead.first).toBe("");expect(lead.firstManual).toBe(true);expect(await sales()).toBe(before);
 lead=(await saveDbSheetContact(ctx,lead.id,{date:"2027-03-06",result:"컨택진행",note:"상담"},lead.revision)).lead;
 expect(lead.first).toBe("");expect(lead.hasQualifiedContact).toBe(true);
 const meeting=Meeting.parse({id:"ignored",예약일:"2027-03-06",예약시각:"09:00",미팅날짜:"2027-03-08",미팅시간:"14:00",channel:lead.channel,업체명:"합성 예약",장소:"합성 장소"});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 expect(await get(lead.id)).toMatchObject({first:"",firstManual:true,hasQualifiedContact:true});
 const booked=lead.meetingId;lead=(await setDbSheetFirstDate(ctx,lead.id,"2027-03-01",lead.revision)).lead;
 expect(lead.meetingId).toBe(booked);expect(lead.stage).toBe("미팅예약");
});
it("reconciles only own inflow once, preserving manual counts and activity history",async()=>{
 const raw={...input(),date:"2027-04-01"};
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,raw.date+":직접생산",JSON.stringify({date:raw.date,channel:"직접생산",inflow:9,contactProgress:4,meetingReservation:3})]);
 let lead=(await saveDbSheetLead(ctx,raw,null)).lead;
 lead=(await saveDbSheetContact(ctx,lead.id,{date:raw.date,result:"컨택진행",note:""},lead.revision)).lead;
 const before=await sales();const preview=await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true);
 expect(preview.impact).toMatchObject({inflow:-1,contacts:0,meetings:0});expect(await sales()).toBe(before);expect((await get(lead.id)).revision).toBe(lead.revision);
 const oldRevision=lead.revision;lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,false)).lead;
 expect(lead.inflowStatus).toMatchObject({state:"excluded",count:0});expect(lead.recording).toEqual({inflow:false,activities:true});
 const counts=async()=>(await query("select payload from sheet_rows where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,raw.date+":직접생산"])).rows[0] as {payload:Record<string,number>};
 expect((await counts()).payload).toMatchObject({inflow:9,production:9,contactProgress:5,meetingReservation:3});
 await expect(changeDbSheetInflow(ctx,lead.id,oldRevision,false)).rejects.toThrow("CONFLICT");
 await expect(changeDbSheetInflow(other,lead.id,lead.revision,false)).rejects.toThrow("CONFLICT");
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,false)).lead;expect((await counts()).payload.inflow).toBe(9);
 lead=(await saveDbSheetLead(ctx,{...lead,supplier:"후속 저장"},lead.revision)).lead;expect((await counts()).payload.inflow).toBe(9);
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,true)).lead;expect((await counts()).payload.inflow).toBe(10);
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,true)).lead;expect((await counts()).payload.inflow).toBe(10);
 // Existing policy OFF means future activity off, not retroactive contact deletion.
 lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:false})).lead;
 expect((await counts()).payload).toMatchObject({inflow:10,contactProgress:5,meetingReservation:3});
});
it("history absence alone does not block a consistent legacy contribution",async()=>{
 const lead=(await saveDbSheetLead(ctx,input(),null)).lead;
 await query("update db_sheet_leads set data=data #- '{_recorded}' where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id]);
 await query("delete from db_sheet_history where spreadsheet_id=$1 and lead_id=$2",[ctx.spreadsheetId,lead.id]);
 const before=await sales();const preview=await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true);
 expect(preview.impact?.blockedReason).toBeUndefined();expect(preview.impact?.inflow).toBe(-1);expect(await sales()).toBe(before);
 const changed=await changeDbSheetInflow(ctx,lead.id,lead.revision,false);expect(changed.lead.inflowStatus?.state).toBe('excluded');expect((await get(lead.id)).inflowStatus?.state).toBe('excluded');
});

it("refuses subtraction when the daily inflow total no longer contains the proven contribution",async()=>{
 const raw={...input(),date:"2027-05-01"};const lead=(await saveDbSheetLead(ctx,raw,null)).lead;
 await query("update sheet_rows set payload=payload||'{\"inflow\":0}'::jsonb where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,raw.date+":직접생산"]);
 const preview=await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true);expect(preview.impact?.blockedReason).toContain("맞지 않아");
 await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,false)).rejects.toThrow("맞지 않아");
 expect((await get(lead.id)).inflowStatus?.state).toBe("recorded");
});

it("inflow reconciliation keeps booked meeting and contact contributions unchanged",async()=>{
 const raw={...input(),date:"2027-06-01"};let lead=(await saveDbSheetLead(ctx,raw,null)).lead;
 const meeting=Meeting.parse({id:"ignored",예약일:raw.date,예약시각:"09:00",미팅날짜:"2027-06-03",미팅시간:"14:00",channel:lead.channel,업체명:"합성 업체",장소:"합성 장소"});
 lead=(await registerDbSheetMeeting(ctx,lead.id,meeting,lead.revision)).lead;
 const originalId=lead.meetingId;
 const counts=async()=>(await query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2",[ctx.spreadsheetId,raw.date+":직접생산"])).rows[0] as {payload:Record<string,number>};
 expect((await counts()).payload).toMatchObject({inflow:1,contactProgress:1,meetingReservation:1});
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,false)).lead;
 expect((await counts()).payload).toMatchObject({inflow:0,contactProgress:1,meetingReservation:1});
 expect((await get(lead.id)).meetingId).toBe(originalId);
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,true)).lead;
 expect((await counts()).payload).toMatchObject({inflow:1,contactProgress:1,meetingReservation:1});
 expect(lead._recorded?.meetingIds).toEqual([originalId]);
});
