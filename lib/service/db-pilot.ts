/**
 * Layer: service — DB 파일럿 진단 유스케이스 (db-migration-pilot §3).
 * admin 랜딩이 호출: 연결 상태(SELECT 1) + sheet_rows 행수 — 운영자가 화면에서
 * "DB 연결 OK" 를 확인하는 용도. DATABASE_URL 미설정이면 enabled:false.
 */
import { checkDbConnection, countSheetRows } from "@/repo/db/client";

export interface DbPilotStatus {
  enabled: boolean;
  ok: boolean;
  latencyMs: number | null;
  rows: number | null;
  error: string | null;
}

export async function getDbPilotStatus(): Promise<DbPilotStatus> {
  const conn = await checkDbConnection();
  if (!conn.enabled || !conn.ok) {
    return { ...conn, rows: null };
  }
  const rows = await countSheetRows().catch(() => null);
  return { ...conn, rows };
}
