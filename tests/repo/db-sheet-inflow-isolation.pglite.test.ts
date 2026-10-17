/** Synthetic isolated DB only. Query instrumentation distinguishes fixture setup from product writes. */
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,it,expect,vi} from 'vitest';
import {DbSheetLeadInput} from '@/types/db-sheet';
const fixture=vi.hoisted(()=>({db:null as PGlite|null,statements:[] as string[],failSql:''}));
async function query(sql:string,params:unknown[]=[]){fixture.statements.push(sql);if(fixture.failSql&&sql.includes(fixture.failSql))throw new Error('synthetic query denied');const r=await fixture.db!.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}
vi.mock('@/repo/db/client',()=>({dbEnabled:()=>true,getDbPool:()=>({query,connect:async()=>({query,release(){}})})}));
import {listDbSheet,saveDbSheetLead,saveDbSheetContact,setDbSheetFirstDate,scheduleDbSheetContact,registerDbSheetMeeting,changeDbSheetRecording,changeDbSheetInflow,deleteDbSheetLead,importDbSheetLeads,DbSheetOperationBlocked} from '@/repo/db/db-sheet';
import {hydrateRecording} from '@/repo/db/db-sheet-recording';
const ctx={spreadsheetId:'isolation-synthetic',cohort:'fixture',email:'owner@example.test'};
let n=0;
const input=(date:string)=>DbSheetLeadInput.parse({id:randomUUID(),date,channel:'직접생산',company:'합성 격리 '+(++n)});
const writes=()=>fixture.statements.filter(s=>/^\s*(insert|update|delete|alter|create|drop)\b/i.test(s));
const snapshot=async()=>JSON.stringify(await Promise.all(['db_sheet_leads','db_sheet_history','db_sheet_contacts','db_sheet_imports','sheet_rows'].map(t=>fixture.db!.query(`select to_jsonb(t) as row from ${t} t order by to_jsonb(t)::text`))));
beforeAll(async()=>{fixture.db=new PGlite();await fixture.db.exec('create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));');await fixture.db.exec(readFileSync('lib/repo/db/migrations/0008_db_sheet.sql','utf8'));},60000);
afterAll(async()=>{await fixture.db?.close();});
it('isolates one corrupt row, removes stale raw status and keeps another row usable without read writes',async()=>{
 const bad=(await saveDbSheetLead(ctx,input('2030-01-01'),null)).lead;
 let good=(await saveDbSheetLead(ctx,input('2030-01-02'),null)).lead;
 await query("update db_sheet_leads set data=jsonb_set(data,'{_recorded,inflow}','false')||$3::jsonb where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,bad.id,JSON.stringify({inflowStatus:{state:'recorded',count:1}})]);
 const before=await snapshot();fixture.statements=[];
 const rows=await listDbSheet(ctx),isolated=rows.find(r=>r.id===bad.id)!;
 expect(rows).toHaveLength(2);expect(Object.hasOwn(isolated,'inflowStatus')).toBe(false);expect(isolated._recorded?.inflow).toBe(false);expect(isolated.recording?.inflow).toBe(true);
 expect(rows.find(r=>r.id===good.id)?.inflowStatus).toMatchObject({state:'recorded',count:1});expect(writes()).toEqual([]);expect(await snapshot()).toBe(before);
 fixture.statements=[];await hydrateRecording({query} as Parameters<typeof hydrateRecording>[0],ctx,good);expect(writes()).toEqual([]);
 good=(await saveDbSheetLead(ctx,{...good,supplier:'합성 정상 변경'},good.revision)).lead;
 good=(await changeDbSheetInflow(ctx,good.id,good.revision,false)).lead;expect(good.inflowStatus).toMatchObject({state:'excluded',count:0});
 expect((await listDbSheet(ctx)).find(r=>r.id===good.id)?.supplier).toBe('합성 정상 변경');
});
it('keeps every mutation strict for the corrupt row and persists nothing, including previews/import',async()=>{
 const bad=(await listDbSheet(ctx)).find(r=>r.date==='2030-01-01')!;
 const attempts=[
  ()=>saveDbSheetLead(ctx,{...bad,supplier:'합성 차단'},bad.revision),
  ()=>saveDbSheetContact(ctx,bad.id,{date:bad.date,result:'컨택진행',note:''},bad.revision),
  ()=>setDbSheetFirstDate(ctx,bad.id,bad.date,bad.revision),
  ()=>scheduleDbSheetContact(ctx,bad.id,bad.date,bad.revision),
  ()=>registerDbSheetMeeting(ctx,bad.id,{} as Parameters<typeof registerDbSheetMeeting>[2],bad.revision),
  ...[true,false].flatMap(preview=>[
   ()=>changeDbSheetRecording(ctx,bad.id,bad.revision,{inflow:false,activities:false},preview),
   ()=>changeDbSheetInflow(ctx,bad.id,bad.revision,false,preview),
   ()=>deleteDbSheetLead(ctx,bad.id,bad.revision,preview),
  ]),
  ()=>importDbSheetLeads(ctx,randomUUID(),[bad]),
 ];
 const before=await snapshot();
 for(const attempt of attempts){fixture.statements=[];await expect(attempt()).rejects.toBeInstanceOf(DbSheetOperationBlocked);expect(writes()).toEqual([]);expect(fixture.statements).toContain('rollback');expect(await snapshot()).toBe(before);}
});
it('does not treat an invalid peer on the same ledger as zero or release its manual contribution',async()=>{
 const bad=(await listDbSheet(ctx)).find(r=>r.date==='2030-01-01')!;
 const good=(await saveDbSheetLead(ctx,input(bad.date),null)).lead;
 const before=await snapshot();fixture.statements=[];
 const preview=await changeDbSheetInflow(ctx,good.id,good.revision,false,true);expect(preview.impact?.blockedReason).toContain('같은 날짜');
 await expect(changeDbSheetInflow(ctx,good.id,good.revision,false)).rejects.toBeInstanceOf(DbSheetOperationBlocked);expect(writes()).toEqual([]);expect(await snapshot()).toBe(before);
});
it.each(['select data from db_sheet_leads','select row_key,payload','select lead_id,max','select lead_id from db_sheet_history'])('propagates global database failure at %s instead of returning an empty/normal list',async sql=>{
 fixture.failSql=sql;fixture.statements=[];
 try{await expect(listDbSheet(ctx)).rejects.toThrow('synthetic query denied');expect(writes()).toEqual([]);}finally{fixture.failSql='';}
});
