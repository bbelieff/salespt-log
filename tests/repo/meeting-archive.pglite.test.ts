/** Actual PostgreSQL transactions, synthetic records only. */
import {PGlite} from "@electric-sql/pglite";
import {beforeAll,afterAll,beforeEach,it,expect,vi} from "vitest";
import {Meeting} from "@/types";
const fixture=vi.hoisted(()=>({db:null as PGlite|null,failCounts:false}));
async function query(sql:string,params:unknown[]=[]){if(fixture.failCounts&&sql.startsWith("select row_key,payload"))throw new Error("synthetic-count-failure");const r=await fixture.db!.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}
vi.mock("@/repo/db/client",()=>({dbEnabled:()=>true,ensureSchema:async()=>{},getDbPool:()=>({query,connect:async()=>({query,release(){}})})}));
import {listArchivedMeetings,setSimpleMeetingArchived} from "@/repo/db/meeting-archive";
const ctx={spreadsheetId:"fixture-a",cohort:"12",email:"owner@example.test"};
const m=(id="simple",extra={})=>Meeting.parse({id,예약일:"2026-10-10",예약시각:"09:00",미팅날짜:"2026-10-20",미팅시간:"14:00",channel:"매입DB",업체명:"합성 업체",장소:"합성 상담실",...extra});
async function put(tab:string,id:string,payload:unknown,tenant=ctx.spreadsheetId){await query("insert into sheet_rows(spreadsheet_id,tab,row_key,payload) values($1,$2,$3,$4::jsonb)",[tenant,tab,id,JSON.stringify(payload)]);}
async function payload(tab:string,id:string){const r=await query("select payload from sheet_rows where spreadsheet_id=$1 and tab=$2 and row_key=$3",[ctx.spreadsheetId,tab,id]);return (r.rows[0] as {payload:Record<string,unknown>}|undefined)?.payload as Record<string,unknown>;}
beforeAll(async()=>{fixture.db=new PGlite();await fixture.db.exec("create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));create table db_sheet_leads(spreadsheet_id text,meeting_id text,data jsonb,id text,revision integer default 1,updated_at timestamptz default now());create table db_sheet_history(spreadsheet_id text,lead_id text,revision integer,data jsonb);");},60000);
afterAll(async()=>{await fixture.db?.close();});
beforeEach(async()=>{fixture.failCounts=false;await fixture.db!.exec("truncate sheet_rows,db_sheet_leads,db_sheet_history");});
it("archive and restore same ID twice converge count and preserve inflow/contact metadata",async()=>{
 await put('meetings','simple',{...m(),privateMarker:'preserve'});await put('sales','2026-10-10:매입DB',{inflow:3,contactProgress:2,_dbSheetInflow:1,_dbSheetContacts:1,meetingReservation:1});
 await setSimpleMeetingArchived(ctx,'simple',true);expect((await payload('sales','2026-10-10:매입DB')).meetingReservation).toBe(0);
 expect((await listArchivedMeetings(ctx))[0]?.restorable).toBe(true);
 await setSimpleMeetingArchived(ctx,'simple',false);await setSimpleMeetingArchived(ctx,'simple',false);
 expect(await payload('meetings','simple')).toMatchObject({_cleared:false,privateMarker:'preserve',id:'simple'});
 expect(await payload('sales','2026-10-10:매입DB')).toMatchObject({inflow:3,contactProgress:2,_dbSheetInflow:1,_dbSheetContacts:1,meetingReservation:1});
 expect(await listArchivedMeetings(ctx)).toHaveLength(0);
});
it("restoring excluded meeting remains excluded from STEP2 reservation count",async()=>{
 await put('meetings','simple',{...m(),_cleared:true});await query("insert into db_sheet_leads(spreadsheet_id,meeting_id,data) values($1,'simple',$2::jsonb)",[ctx.spreadsheetId,JSON.stringify({_recorded:{meeting:false}})]);
 await setSimpleMeetingArchived(ctx,'simple',false);expect((await payload('sales','2026-10-10:매입DB')).meetingReservation).toBe(0);
});
it("tenant isolation and absent source never resurrect a different user's record",async()=>{
 await put('meetings','simple',{...m(),_cleared:true},'fixture-other');expect(await listArchivedMeetings(ctx)).toEqual([]);
 await expect(setSimpleMeetingArchived(ctx,'simple',false)).rejects.toThrow('MEETING_ARCHIVE_NOT_FOUND');expect(await setSimpleMeetingArchived(ctx,'simple',true)).toBeNull();
});
it("rejects even deleted descendants, parent and canonical legacy contract linkage without partial writes",async()=>{
 await put('meetings','simple',{...m(),_cleared:true});await put('meetings','child',{...m('child',{previousMeetingId:'simple'}),_cleared:true});
 await expect(setSimpleMeetingArchived(ctx,'simple',false)).rejects.toThrow('MEETING_ARCHIVE_COMPLEX');await expect(setSimpleMeetingArchived(ctx,'child',false)).rejects.toThrow('MEETING_ARCHIVE_COMPLEX');
 await query("delete from sheet_rows where row_key='child'");await put('contracts','r4',{C:'2026-10-20',D:'합성 업체',E:100,AK:'simple',_cleared:true});
 await expect(setSimpleMeetingArchived(ctx,'simple',false)).rejects.toThrow('MEETING_ARCHIVE_COMPLEX');expect((await payload('meetings','simple'))._cleared).toBe(true);
});
it("count failure rolls restoration back, then retry succeeds",async()=>{
 await put('meetings','simple',{...m(),_cleared:true});fixture.failCounts=true;
 await expect(setSimpleMeetingArchived(ctx,'simple',false)).rejects.toThrow('synthetic-count-failure');expect((await payload('meetings','simple'))._cleared).toBe(true);
 fixture.failCounts=false;await setSimpleMeetingArchived(ctx,'simple',false);expect((await payload('meetings','simple'))._cleared).toBe(false);
});

it("restore after enabling activity recording settles evidence and counts exactly once",async()=>{
 await put('meetings','simple',{...m(),_cleared:true});
 await query("insert into db_sheet_leads(spreadsheet_id,meeting_id,id,revision,data) values($1,'simple','lead',3,$2::jsonb)",[ctx.spreadsheetId,JSON.stringify({id:'lead',revision:3,recording:{inflow:false,activities:true},_recorded:{inflow:false,contacts:['2026-10-10'],meeting:false}})]);
 await setSimpleMeetingArchived(ctx,'simple',false);await setSimpleMeetingArchived(ctx,'simple',false);
 expect((await payload('sales','2026-10-10:매입DB')).meetingReservation).toBe(1);
 const ledger=await query("select data,revision from db_sheet_leads where id='lead'");expect(ledger.rows[0]).toMatchObject({revision:4,data:{revision:4,_recorded:{meeting:true,meetingIds:['simple'],inflow:false,contacts:['2026-10-10']}}});
 const history=await query("select revision from db_sheet_history where lead_id='lead'");expect(history.rows).toEqual([{revision:4}]);
});

it("permanently deleted lead tombstone stays hidden and cannot restore",async()=>{
 await put('meetings','simple',{...m(),_cleared:true,_dbSheetLeadDeleted:true});
 expect(await listArchivedMeetings(ctx)).toEqual([]);
 await expect(setSimpleMeetingArchived(ctx,'simple',false)).rejects.toThrow('MEETING_ARCHIVE_PURGED');
 expect((await payload('meetings','simple'))._cleared).toBe(true);
});

it("activity selected before deletion remains counted after OFF and restore",async()=>{
 await put('meetings','simple',m());
 await query("insert into db_sheet_leads(spreadsheet_id,meeting_id,id,revision,data) values($1,'simple','lead',1,$2::jsonb)",[ctx.spreadsheetId,JSON.stringify({id:'lead',revision:1,recording:{inflow:false,activities:true},_recorded:{inflow:false,contacts:[],meeting:false,meetingIds:[]}})]);
 await setSimpleMeetingArchived(ctx,'simple',true);
 await query("update db_sheet_leads set data=jsonb_set(data,'{recording,activities}','false'::jsonb) where id='lead'");
 await setSimpleMeetingArchived(ctx,'simple',false);
 expect((await payload('sales','2026-10-10:매입DB')).meetingReservation).toBe(1);
});
