/** Layer: repo — canonical selected meeting counts inside a caller-owned sales transaction. */
import type { PoolClient } from "pg";
import type { DbSheetLead } from "@/types/db-sheet";
type StoredMeeting={row_key:string;payload:Record<string,unknown>};
export async function lockedMeetingCounts(client: Pick<PoolClient, "query">, spreadsheetId: string,recordEvidence=false): Promise<Map<string, number>> {
  const { meetingFromDbPayload } = await import("./read-daily");
  const rows = await client.query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='meetings'", [spreadsheetId]);
  const exists=await client.query("select to_regclass('public.db_sheet_leads') as ledger");
  const leads=exists.rows[0]?.ledger?await client.query("select id,meeting_id,data from db_sheet_leads where spreadsheet_id=$1 and meeting_id is not null",[spreadsheetId]):{rows:[]};
  const byId=new Map<string,Record<string,unknown>>(rows.rows.map((r:StoredMeeting)=>[r.row_key??r.payload.id,r.payload]));
  const owners=new Map<string,{id:string;data:DbSheetLead;ids:Set<string>;changed:boolean}>();
  for(const r of leads.rows){const data=r.data as DbSheetLead;owners.set(r.meeting_id,{id:r.id,data,ids:new Set(data._recorded?.meetingIds??[]),changed:false});}
  const ownerFor=(id:string)=>{const seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);const owner=owners.get(id);if(owner)return owner;id=String(byId.get(id)?.previousMeetingId??'');}return undefined;};
  // Compatibility for old boolean evidence: every existing descendant had been counted.
  for(const r of rows.rows as StoredMeeting[]){const owner=ownerFor(r.row_key);if(owner?.data._recorded?.meeting&&owner.data._recorded.meetingIds===undefined){owner.ids.add(r.row_key);owner.changed=true;}}
  const counts = new Map<string, number>();
  for (const row of rows.rows as StoredMeeting[]) {
    if(row.payload._cleared)continue;
    const meeting = meetingFromDbPayload(row.payload);if (!meeting) continue;
    const owner=ownerFor(row.row_key);
    if(owner){const policy=owner.data.recording?.activities??(owner.data._recorded?.meeting??true);
      if(!policy&&!owner.ids.has(row.row_key))continue;
      if(owner.data._recorded&&!owner.ids.has(row.row_key)){owner.ids.add(row.row_key);owner.changed=true;}
    }
    const key = `${meeting.예약일}:${meeting.channel}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Only write callers request evidence persistence. Read requests never mutate records.
  if(recordEvidence)for(const owner of owners.values())if(owner.changed&&owner.data._recorded){
    const changed=await client.query("update db_sheet_leads set revision=revision+1,data=jsonb_set(data,'{_recorded}',$3::jsonb)||jsonb_build_object('revision',revision+1),updated_at=now() where spreadsheet_id=$1 and id=$2 returning id,revision,data",[spreadsheetId,owner.id,JSON.stringify({...owner.data._recorded,meeting:owner.ids.size>0,meetingIds:[...owner.ids].sort()})]);
    for(const row of changed.rows)await client.query('insert into db_sheet_history(spreadsheet_id,lead_id,revision,data) values($1,$2,$3,$4::jsonb)',[spreadsheetId,row.id,row.revision,JSON.stringify(row.data)]);
  }
  return counts;
}
