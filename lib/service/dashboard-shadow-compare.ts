/**
 * Layer: service — 서빙=DB 후 시트 대시보드 값을 async 대조하는 역방향 그림자 감시.
 * dashboard.ts 에서 분리(500줄 캡, BBE-83).
 *
 * ⚠️ **기본 off (2026-08, 성능)**. 원 주석대로 "R3 전까지" 한시 안전밸브였고 R3 는 완료
 * 판정됐다. 그런데 이 잡은 **대시보드 GET 마다 시트 대시보드 탭을 통째로 다시 읽어**,
 * 응답을 DB 로 빠르게 준 뒤에도 Sheets 쿼터·커넥션을 계속 소모한다. 게다가 응답 이후
 * 실행이라 api_timing(sheets_ms)에도 안 잡혀 "원인 모를 느림"으로 나타난다.
 *
 * 전수 대조가 필요하면 **배치**로 한다(실시간일 이유가 없다):
 *   node scripts/ops/dashboard-parity.mjs --cohort "8,9,연습,A1-0,…"   (읽기 전용)
 * 다시 켜려면 VPS 환경변수 `DASHBOARD_SHADOW_COMPARE=1` — 코드 수정 없이 복구된다.
 */
import * as Sentry from "@sentry/nextjs";
import type { DashboardChannelMatrix, DashboardView } from "@/types";
import { readDashboard } from "@/repo/dashboard";
import { dbEnabled } from "@/repo/db/client";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { diffDashboardAggregates } from "./dashboard-aggregates";

export const CHANNELS: DashboardChannelMatrix["채널"][] = [
  "매입DB",
  "직접생산",
  "현수막",
  "콜·지·기·소",
];

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export function reverseShadowCompare(sheetId: string, served: DashboardView): void {
  if (process.env.DASHBOARD_SHADOW_COMPARE !== "1") return;
  if (!dbEnabled()) return;
  void (async () => {
    const data = await readDashboard(sheetId);
    const stk = data.channelStacking;
    const sheetMatrix: DashboardChannelMatrix[] = CHANNELS.map((cName, ci) => ({
      채널: cName,
      생산: num(stk[0]?.[ci]), 유입: num(stk[1]?.[ci]), 컨택진행: num(stk[2]?.[ci]),
      미팅예약: num(stk[3]?.[ci]), 미팅완료: num(stk[4]?.[ci]), 계약: num(stk[5]?.[ci]),
    }));
    const diffs = diffDashboardAggregates(
      { channelMatrix: sheetMatrix, weeklyContracts: data.weeklyContracts, weeklyActivity: data.weeklyActivity, 누적수임비: num(data.finance[0]) },
      { channelMatrix: served.channelMatrix, weeklyContracts: served.weeklyTrend.map((w) => w.계약수), weeklyActivity: served.weeklyTrend.map((w) => w.활동량), 누적수임비: served.kpi.누적수임비 },
    );
    captureServerEvent("dashboard_parity_rev", { diffCount: diffs.length });
    if (diffs.length > 0) {
      // 서빙=DB 가 시트와 어긋남 — 규명 필요(사후 경보). 사용자별 강등 판단 입력.
      Sentry.captureMessage(`[dashboard-parity-rev] diff ${diffs.length}: ${diffs.slice(0, 5).map((d) => d.field).join(",")}`, "warning");
    }
  })().catch(() => { /* 감시 실패 무해 */ });
}
