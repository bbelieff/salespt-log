/**
 * 배지 판정용 읽기 전용 질의 — 쓰기 없음. 한 사람(시트 id 또는 로그인 이메일) 범위만 읽는다.
 * 날짜는 모두 KST 날짜(YYYY-MM-DD) 문자열로 돌려준다.
 */
import { dbEnabled, getDbPool } from "./client";

function pool() {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  return getDbPool();
}

/** DB관리시트 연락 기록 전부(업체·날짜·결과). */
export async function readDbSheetContactRows(spreadsheetId: string): Promise<Array<{ leadId: string; date: string; result: string }>> {
  const r = await pool().query<{ lead_id: string; date: string; result: string }>(
    "select lead_id, contact_date::text as date, result from db_sheet_contacts where spreadsheet_id=$1", [spreadsheetId]);
  return r.rows.map(x => ({ leadId: x.lead_id, date: x.date, result: x.result ?? "" }));
}

/** DB관리시트 업체 — 유입일과 업체정보 3칸만. */
export async function readDbSheetLeadBasics(spreadsheetId: string): Promise<Array<{ date: string; industry: string; sales: string; address: string }>> {
  const r = await pool().query<{ date: string | null; industry: string | null; sales: string | null; address: string | null }>(
    `select data->>'date' as date, data->>'industry' as industry, data->>'sales' as sales, data->>'address' as address
       from db_sheet_leads where spreadsheet_id=$1`, [spreadsheetId]);
  return r.rows.map(x => ({ date: x.date ?? "", industry: x.industry ?? "", sales: x.sales ?? "", address: x.address ?? "" }));
}

/** 주간목표를 처음 저장한 날(저장된 주 중 가장 이른 저장 시각). */
export async function readFirstWeeklyGoalDate(studentId: string): Promise<string | null> {
  const r = await pool().query<{ d: string | null }>(
    "select (min(updated_at) at time zone 'Asia/Seoul')::date::text as d from weekly_goals where student_id=$1 and revision>0", [studentId]);
  return r.rows[0]?.d ?? null;
}

/** 이 계정에서 알림을 처음 켠 날(나중에 끈 기기 포함 — 한 번 켠 사실은 남는다). */
export async function readFirstPushDate(email: string): Promise<string | null> {
  const r = await pool().query<{ d: string | null }>(
    "select (min(created_at) at time zone 'Asia/Seoul')::date::text as d from public.push_subscriptions where email=$1", [email.trim().toLowerCase()]);
  return r.rows[0]?.d ?? null;
}
