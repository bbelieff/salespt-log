import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { reconcileDbSheetMetrics } from "@/repo/db/sales-db-sheet-baseline";
import { salesDbPayload } from "@/repo/db/sales-payload";
import { ChannelDailyRow } from "@/types";
import { dayChannelsFromRows } from "@/service/daily-source";

const bridge = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock("pg", () => ({ Pool: class { query = bridge.query; connect = bridge.connect; } }));
const row = {date:"2026-10-11", channel:"직접생산", production:5, inflow:5, contactProgress:3, meetingReservation:1};

describe("daily counts preserve DB-sheet contributions", () => {
  it("rebases a stale daily snapshot without replacing newer automatic counts", () => {
    expect(reconcileDbSheetMetrics({...row,dbSheetInflow:2,dbSheetContacts:1}, {_dbSheetInflow:4,_dbSheetContacts:2})).toEqual({...row,production:7,inflow:7,contactProgress:4});
  });
  it("removes a moved automatic contribution while preserving manual work", () => {
    expect(reconcileDbSheetMetrics({...row,dbSheetInflow:2,dbSheetContacts:1}, {_dbSheetInflow:0,_dbSheetContacts:0})).toMatchObject({inflow:3,production:3,contactProgress:2});
  });
  it("rejects clients that cannot distinguish manual and auto totals", () => {
    expect(() => reconcileDbSheetMetrics(row,{_dbSheetInflow:2})).toThrow("reload required");
    expect(() => reconcileDbSheetMetrics({...row,dbSheetContacts:4},{})).toThrow("reload required");
    expect(reconcileDbSheetMetrics(row,{})).toEqual(row);
  });
  it("keeps baselines through schema, channel mapping and daily read aggregation", () => {
    const parsed=ChannelDailyRow.parse({...row,dbSheetInflow:2,dbSheetContacts:1});
    expect(salesDbPayload(parsed)).toMatchObject({dbSheetInflow:2,dbSheetContacts:1});
    expect(dayChannelsFromRows([parsed],row.date).직접생산).toMatchObject({dbSheetInflow:2,dbSheetContacts:1});
  });
});

describe("daily PostgreSQL payload round trip", () => {
  let db:PGlite;
  beforeAll(async () => {
    db=new PGlite();
    await db.waitReady;
    vi.stubEnv("DATABASE_URL","synthetic-test-only");
    bridge.query.mockImplementation((sql:string,args?:unknown[])=>db.query(sql,args));
    bridge.connect.mockResolvedValue({query:bridge.query,release:()=>{}});
    await import("@/repo/db/client");
    await import("@/repo/db/read-daily");
    await import("@/repo/db/sales-move");
  }, 60000);
  afterAll(async()=>{await db.close();vi.unstubAllEnvs();});
  it("locks, merges current contributions, reloads metadata and rolls back a legacy overwrite",async()=>{
    const {writeSalesRowsToDb,readSalesRowsFromDb,upsertSheetRow}=await import("@/repo/db/client");
    await upsertSheetRow({cohort:"연습",email:"synthetic@example.invalid",spreadsheetId:"synthetic-bridge",tab:"sales",rowKey:`${row.date}:${row.channel}`,payload:{...row,_dbSheetInflow:4,_dbSheetContacts:2}});
    await writeSalesRowsToDb({cohort:"연습",email:"synthetic@example.invalid",spreadsheetId:"synthetic-bridge",rows:[{...row,dbSheetInflow:2,dbSheetContacts:1}]});
    expect(await readSalesRowsFromDb("synthetic-bridge")).toEqual([{...row,production:7,inflow:7,contactProgress:4,meetingReservation:0,dbSheetInflow:4,dbSheetContacts:2}]);
    await expect(writeSalesRowsToDb({cohort:"연습",email:"synthetic@example.invalid",spreadsheetId:"synthetic-bridge",rows:[row]})).rejects.toThrow("reload required");
    const result=await db.query<{payload:Record<string,unknown>}>("select payload from sheet_rows");
    expect(result.rows[0]!.payload).toMatchObject({inflow:7,contactProgress:4,_dbSheetInflow:4});
    expect(result.rows[0]!.payload).not.toHaveProperty("dbSheetInflow");
    expect(bridge.query).toHaveBeenCalledWith("select pg_advisory_xact_lock(hashtextextended($1,0))",["db-sheet:synthetic-bridge"]);
  });
  it("moves both dates atomically, rejecting a DB-sheet source before touching its target", async()=>{
    const {moveDailyRowsInDb}=await import("@/repo/db/sales-move");
    const ctx={cohort:"연습",email:"synthetic@example.invalid",spreadsheetId:"synthetic-move"};
    const {upsertSheetRow}=await import("@/repo/db/client");
    await upsertSheetRow({...ctx,tab:"sales",rowKey:"2026-10-11:직접생산",payload:{...row,_dbSheetInflow:1}});
    const input={from:{date:"2026-10-11",channel:"직접생산" as const,metrics:row},to:{date:"2026-10-12",channel:"직접생산" as const},deltas:{inflow:1}};
    await expect(moveDailyRowsInDb(ctx,input)).rejects.toThrow("DB관리시트에서 변경");
    expect((await db.query("select payload from sheet_rows where spreadsheet_id=$1 and row_key=$2",[ctx.spreadsheetId,"2026-10-12:직접생산"])).rows).toHaveLength(0);
    await upsertSheetRow({...ctx,tab:"sales",rowKey:"2026-10-11:직접생산",payload:{_dbSheetInflow:0}});
    bridge.query.mockImplementation(async (sql:string,args?:unknown[])=>{
      if (sql.includes("insert into sheet_rows") && args?.[3] === "2026-10-12:직접생산") throw new Error("synthetic target failure");
      return db.query(sql,args);
    });
    await expect(moveDailyRowsInDb(ctx,input)).rejects.toThrow("synthetic target failure");
    bridge.query.mockImplementation((sql:string,args?:unknown[])=>db.query(sql,args));
    const unchanged=await db.query<{payload:Record<string,unknown>}>("select payload from sheet_rows where spreadsheet_id=$1",[ctx.spreadsheetId]);
    expect(unchanged.rows).toHaveLength(1);
    expect(unchanged.rows[0]!.payload.inflow).toBe(5);
    const moved=await moveDailyRowsInDb(ctx,input);
    expect(moved.from.inflow).toBe(4);expect(moved.to.inflow).toBe(1);
    const rows=await db.query<{payload:Record<string,unknown>}>("select payload from sheet_rows where spreadsheet_id=$1 order by row_key",[ctx.spreadsheetId]);
    expect(rows.rows.map(r=>r.payload.production)).toEqual([4,1]);
  });

});
