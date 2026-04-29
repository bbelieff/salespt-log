/**
 * Layer: service — 수납 탭 유스케이스 (PR 09).
 *
 * 일별 실적(승인/수납/금액/비고) 조회·저장.
 * 시트 매핑: 영업관리!Q~T (매입DB 행에만).
 */
import { findUserByEmail } from "@/repo/users";
import { readDailyRevenue, writeDailyRevenue } from "@/repo/sales";
import { DailyRevenue } from "@/types";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[payment] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

/** 한 날짜의 일별 실적 조회 (없으면 0/0/0/""). */
export async function loadDailyRevenue(
  email: string,
  date: string,
): Promise<DailyRevenue> {
  const spreadsheetId = await resolveSheet(email);
  return readDailyRevenue(spreadsheetId, date);
}

/**
 * 일별 실적 저장.
 * 검증: paymentCount ≤ approvalCount (위반 시 자동 보정).
 *       paymentCount=0이면 paymentAmount도 0 강제.
 */
export async function saveDailyRevenue(
  email: string,
  revenue: DailyRevenue,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  const approval = Math.max(0, revenue.approvalCount);
  const payment = Math.max(0, Math.min(revenue.paymentCount, approval));
  const amount = payment > 0 ? Math.max(0, revenue.paymentAmount) : 0;
  const fixed = DailyRevenue.parse({
    date: revenue.date,
    approvalCount: approval,
    paymentCount: payment,
    paymentAmount: amount,
    agencyNote: revenue.agencyNote ?? "",
  });
  await writeDailyRevenue(spreadsheetId, fixed);
}
