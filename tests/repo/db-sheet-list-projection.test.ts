import {it,expect,vi} from 'vitest';
import type {DbSheetLead} from '@/types/db-sheet';
const fixture=vi.hoisted(()=>({rows:[] as {data:DbSheetLead}[]}));
vi.mock('@/repo/db/client',()=>({dbEnabled:()=>true,getDbPool:()=>({query:async(sql:string)=>({rows:sql.startsWith('select data from db_sheet_leads')?fixture.rows:[]})})}));
import {listDbSheet} from '@/repo/db/db-sheet';
it('propagates a non-validation exception from pure per-row projection',async()=>{
 const error=new TypeError('synthetic projection defect');
 const raw={id:'synthetic',get recording(){throw error;}} as unknown as DbSheetLead;fixture.rows=[{data:raw}];
 await expect(listDbSheet({spreadsheetId:'synthetic',cohort:'fixture',email:'owner@example.test'})).rejects.toBe(error);
});
