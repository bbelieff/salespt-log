/** Synthetic isolated PostgreSQL, no production connection or customer data. */
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {DbSheetLeadInput} from '@/types/db-sheet';
const fixture=vi.hoisted(()=>({db:null as PGlite|null}));
async function query(sql:string,params:unknown[]=[]){const r=await fixture.db!.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}
vi.mock('@/repo/db/client',()=>({dbEnabled:()=>true,getDbPool:()=>({query,connect:async()=>({query,release(){}})})}));
import {listDbSheet,saveDbSheetLead,changeDbSheetInflow,changeDbSheetRecording} from '@/repo/db/db-sheet';
const ctx={spreadsheetId:'two-state-synthetic',cohort:'fixture',email:'owner@example.test'},other={...ctx,spreadsheetId:'other-synthetic'};
let n=0;const input=(date:string,enabled=true)=>DbSheetLeadInput.parse({id:randomUUID(),date,channel:'직접생산',company:'합성 이진 '+(++n),recording:{inflow:enabled,activities:true}});
const get=async(id:string)=>(await listDbSheet(ctx)).find(x=>x.id===id)!;
const counts=async(date:string)=>(await query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2",[ctx.spreadsheetId,date+':직접생산'])).rows[0] as {payload:Record<string,number>}|undefined;
const raw=async(id:string)=>JSON.stringify((await query('select data,revision from db_sheet_leads where spreadsheet_id=$1 and id=$2',[ctx.spreadsheetId,id])).rows);
const legacy=async(id:string)=>{await query("update db_sheet_leads set data=data-'_recorded'-'recording' where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,id]);await query('delete from db_sheet_history where spreadsheet_id=$1 and lead_id=$2',[ctx.spreadsheetId,id]);};
beforeAll(async()=>{fixture.db=new PGlite();await fixture.db.exec('create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));');await fixture.db.exec(readFileSync('lib/repo/db/migrations/0008_db_sheet.sql','utf8'));},60000);
afterAll(async()=>{await fixture.db?.close();});
it('projects history-free creation legacy ON without writes, then safely toggles OFF/ON across reload',async()=>{
 let lead=(await saveDbSheetLead(ctx,input('2029-01-01'),null)).lead;await legacy(lead.id);
 const before=await raw(lead.id);lead=await get(lead.id);expect(lead.inflowStatus?.state).toBe('recorded');expect(await raw(lead.id)).toBe(before);
 const preview=await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true);expect(preview.impact?.blockedReason).toBeUndefined();expect(preview.impact?.inflow).toBe(-1);expect(await raw(lead.id)).toBe(before);
 for(const enabled of [false,false,true,true,false,true]){lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,enabled)).lead;expect((await get(lead.id)).inflowStatus?.state).toBe(enabled?'recorded':'excluded');expect((await counts(lead.date))?.payload.inflow).toBe(Number(enabled));}
});
it('uses actual contribution rather than a future OFF policy',async()=>{
 let lead=(await saveDbSheetLead(ctx,input('2029-01-02'),null)).lead;lead=(await changeDbSheetRecording(ctx,lead.id,lead.revision,{inflow:false,activities:true})).lead;
 expect(lead.recording?.inflow).toBe(false);expect((await get(lead.id)).inflowStatus?.state).toBe('recorded');
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,false)).lead;expect((await get(lead.id)).inflowStatus?.state).toBe('excluded');
});
it('preserves proven OFF when only the future-policy object is absent',async()=>{
 let lead=(await saveDbSheetLead(ctx,input('2029-01-04',false),null)).lead;
 await query("update db_sheet_leads set data=data-'recording' where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id]);
 expect((await get(lead.id)).inflowStatus?.state).toBe('excluded');
 lead=(await saveDbSheetLead(ctx,{...lead,supplier:'합성 정책 누락'},lead.revision)).lead;expect(lead.inflowStatus?.state).toBe('excluded');expect((await counts(lead.date))?.payload.inflow??0).toBe(0);
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,true)).lead;expect((await get(lead.id)).inflowStatus?.state).toBe('recorded');
});
it('preserves same-date siblings and manual totals through new OFF/ON, legacy and tenant/revision checks',async()=>{
 const date='2029-01-03';await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,date+':직접생산',JSON.stringify({date,channel:'직접생산',inflow:7,production:7,contactProgress:4,meetingReservation:3})]);
 let a=(await saveDbSheetLead(ctx,input(date),null)).lead,b=(await saveDbSheetLead(ctx,input(date,false),null)).lead;await legacy(a.id);
 expect((await get(b.id)).inflowStatus?.state).toBe('excluded');expect((await counts(date))?.payload.inflow).toBe(8);
 a=(await changeDbSheetInflow(ctx,a.id,a.revision,false)).lead;b=(await changeDbSheetInflow(ctx,b.id,b.revision,true)).lead;
 expect((await counts(date))?.payload).toMatchObject({inflow:8,production:8,_dbSheetInflow:1,contactProgress:4,meetingReservation:3});
 await expect(changeDbSheetInflow(other,b.id,b.revision,false)).rejects.toThrow('CONFLICT');await expect(changeDbSheetInflow(ctx,b.id,1,false)).rejects.toThrow('CONFLICT');
 expect((await get(a.id)).inflowStatus?.state).toBe('excluded');
});
it.each([0,-1,0.5,2])('rejects conflicting tagged totals %s without touching a lead or manual count',async marker=>{
 const date=`2029-02-${String(10+marker*2).padStart(2,'0')}`,lead=(await saveDbSheetLead(ctx,input(date),null)).lead;
 await query("update sheet_rows set payload=payload||jsonb_build_object('inflow',10,'production',10,'_dbSheetInflow',$3::numeric) where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,date+':직접생산',marker]);
 const before=await raw(lead.id),total=JSON.stringify(await counts(date)),preview=await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true);
 expect(preview.impact?.blockedReason).toBeTruthy();await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,false)).rejects.toThrow();expect(await raw(lead.id)).toBe(before);expect(JSON.stringify(await counts(date))).toBe(total);
});
it.each([-1,0.5])('rejects invalid total %s and never manufactures a normal state by saving',async total=>{
 const date=total<0?'2029-02-21':'2029-02-22',lead=(await saveDbSheetLead(ctx,input(date),null)).lead;
 await query("update sheet_rows set payload=payload||jsonb_build_object('inflow',$3::numeric,'production',$3::numeric) where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,date+':직접생산',total]);
 const before=await raw(lead.id),preview=await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true);expect(preview.impact?.blockedReason).toBeTruthy();await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,false)).rejects.toThrow();expect(await raw(lead.id)).toBe(before);
});
it('rejects a contribution/policy contradiction explicitly and preserves its bytes',async()=>{
 const lead=(await saveDbSheetLead(ctx,input('2029-02-23'),null)).lead;
 await query("update db_sheet_leads set data=jsonb_set(data,'{_recorded,inflow}','false') where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id]);
 const before=await raw(lead.id);expect((await get(lead.id)).inflowStatus).toBeUndefined();await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,false)).rejects.toThrow('맞지 않아');expect(await raw(lead.id)).toBe(before);
 await query("update db_sheet_leads set data=jsonb_set(data,'{_recorded,inflow}','true') where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id]);
});
it('blocks unsafe post-increment in preview/apply, preserving lead/history/daily bytes; safe edge still reverses',async()=>{
 const date='2029-02-24';let lead=(await saveDbSheetLead(ctx,input(date,false),null)).lead;
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,date+':직접생산',JSON.stringify({date,channel:'직접생산',inflow:Number.MAX_SAFE_INTEGER,production:Number.MAX_SAFE_INTEGER,_dbSheetInflow:0})]);
 const history=async()=>JSON.stringify((await query('select revision,data from db_sheet_history where spreadsheet_id=$1 and lead_id=$2 order by revision',[ctx.spreadsheetId,lead.id])).rows);
 const before=[await raw(lead.id),await history(),JSON.stringify(await counts(date))];
 expect((await changeDbSheetInflow(ctx,lead.id,lead.revision,true,true)).impact?.blockedReason).toContain('안전한');await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,true)).rejects.toThrow('안전한');
 expect([await raw(lead.id),await history(),JSON.stringify(await counts(date))]).toEqual(before);
 await query("update sheet_rows set payload=payload||$3::jsonb where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,date+':직접생산',JSON.stringify({inflow:Number.MAX_SAFE_INTEGER-1,production:Number.MAX_SAFE_INTEGER-1})]);
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,true)).lead;expect((await counts(date))?.payload.inflow).toBe(Number.MAX_SAFE_INTEGER);
 lead=(await changeDbSheetInflow(ctx,lead.id,lead.revision,false)).lead;expect((await counts(date))?.payload.inflow).toBe(Number.MAX_SAFE_INTEGER-1);
});
it('rejects missing positive production while supporting a truly empty OFF baseline',async()=>{
 const date='2029-02-25',lead=(await saveDbSheetLead(ctx,input(date),null)).lead;
 await query("update sheet_rows set payload=payload-'production' where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,date+':직접생산']);
 const before=[await raw(lead.id),JSON.stringify(await counts(date))];expect((await changeDbSheetInflow(ctx,lead.id,lead.revision,false,true)).impact?.blockedReason).toContain('직접생산');await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,false)).rejects.toThrow('직접생산');expect([await raw(lead.id),JSON.stringify(await counts(date))]).toEqual(before);
 let empty=(await saveDbSheetLead(ctx,input('2029-02-26',false),null)).lead;expect(await counts(empty.date)).toBeUndefined();empty=(await changeDbSheetInflow(ctx,empty.id,empty.revision,true)).lead;expect((await counts(empty.date))?.payload).toMatchObject({inflow:1,production:1,_dbSheetInflow:1});
});
it.each([null,[],{inflow:null,_dbSheetInflow:0,production:0},{inflow:0,_dbSheetInflow:null,production:0}])('rejects an explicitly malformed empty baseline without normalizing it to zero',async payload=>{
 const date=`2029-04-${String(++n).padStart(2,'0')}`,lead=(await saveDbSheetLead(ctx,input(date,false),null)).lead;
 await query("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb)",[ctx.cohort,ctx.email,ctx.spreadsheetId,date+':직접생산',JSON.stringify(payload)]);
 const before=[await raw(lead.id),JSON.stringify(await counts(date))];expect((await changeDbSheetInflow(ctx,lead.id,lead.revision,true,true)).impact?.blockedReason).toBeTruthy();await expect(changeDbSheetInflow(ctx,lead.id,lead.revision,true)).rejects.toThrow();expect([await raw(lead.id),JSON.stringify(await counts(date))]).toEqual(before);
});
it('rejects missing OFF contribution evidence instead of guessing or exposing a third state',async()=>{
 const lead=(await saveDbSheetLead(ctx,input('2029-03-01',false),null)).lead;
 await query("update db_sheet_leads set data=data-'_recorded' where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id]);
 expect((await get(lead.id)).inflowStatus).toBeUndefined();
 // Keep this deliberately corrupt fixture isolated from subsequent reads.
 await query("update db_sheet_leads set data=data||$3::jsonb where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,lead.id,JSON.stringify({_recorded:lead._recorded})]);
});
