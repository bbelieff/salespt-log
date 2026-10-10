/** Layer: repo — atomic daily metric moves, serialized with DB-sheet writes. */
import type { Channel } from "@/types";
import { dbEnabled, ensureSchema, getDbPool } from "./client";
import { salesDbPayload } from "./sales-payload";
import { lockedMeetingCounts } from "./sales-meeting-counts";

type Metrics = { production:number; inflow:number; contactProgress:number; meetingReservation:number };
type Place = {date:string;channel:Channel;metrics?:Metrics};
export async function moveDailyRowsInDb(ctx:{spreadsheetId:string;cohort:string;email:string}, input:{from:Place;to:Place;deltas:{inflow?:number;contactProgress?:number}}) {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정");
  await ensureSchema();
  const c=await getDbPool().connect();
  try {
    await c.query("begin");
    await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`db-sheet:${ctx.spreadsheetId}`]);
    const values:Metrics[]=[];
    for (const place of [input.from,input.to]) {
      const result=await c.query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2 for update",[ctx.spreadsheetId,`${place.date}:${place.channel}`]);
      const p=result.rows[0]?.payload ?? {};
      if (Number(p._dbSheetInflow ?? 0)>0 || Number(p._dbSheetContacts ?? 0)>0) throw new Error("[db-sheet-metrics-conflict] DB관리시트에서 변경해 주세요");
      values.push(place.metrics ?? {production:Number(p.production??0),inflow:Number(p.inflow??0),contactProgress:Number(p.contactProgress??0),meetingReservation:Number(p.meetingReservation??0)});
    }
    const from:Metrics={...values[0]!};
    const to:Metrics={...values[1]!};
    const applied:{inflow?:number;contactProgress?:number}={};
    for (const key of ["inflow","contactProgress"] as const) {
      const amount=Math.min(Math.max(0,Math.trunc(input.deltas[key]??0)),from[key]);
      if (!amount) continue;
      applied[key]=amount; from[key]-=amount; to[key]+=amount;
    }
    const counts=await lockedMeetingCounts(c,ctx.spreadsheetId);
    for (const [i,place] of [input.from,input.to].entries()) {
      const metric=i===0?from:to;
      if (place.channel === "직접생산") metric.production = metric.inflow;
      metric.meetingReservation=counts.get(`${place.date}:${place.channel}`)??0;
      const payload=salesDbPayload({...metric,date:place.date,channel:place.channel});
      await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'sales',$4,$5::jsonb,true)
        on conflict(spreadsheet_id,tab,row_key) do update set payload=sheet_rows.payload || excluded.payload, mirror_pending=true,updated_at=now()`,[ctx.cohort,ctx.email,ctx.spreadsheetId,`${place.date}:${place.channel}`,JSON.stringify(payload)]);
    }
    await c.query("commit");
    return {from,to,applied};
  } catch(e) {await c.query("rollback").catch(()=>{});throw e;} finally {c.release();}
}
