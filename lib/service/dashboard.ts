/**
 * Layer: service — 대시보드 유스케이스.
 *
 * SSOT: docs/domains/sheet-structure.md §1, docs/plans/active/12-dashboard.md
 *
 * 책임:
 *   1. email → spreadsheetId resolve
 *   2. 대시보드 grid 1회 read
 *   3. cell 좌표 → DashboardView 객체 매핑
 *
 * 셀 좌표는 prototype 확정 시점에 본 파일에서만 변경. UI는 DashboardView 만 본다.
 *
 * Q4 확정 좌표 (2026-05-07):
 *   영업이익 = D21 - E21
 *   총매출 = D21
 *   총비용 = E21
 * 그 외 (영업이익률·누적수임비·채널 4지표·주차별 추이·비용 구성) =
 *   prototype HTML 도착 후 좌표 확정. 현재는 안전한 0/[] 기본값으로 채운다.
 */
import { findUserByEmail } from "@/repo/users";
import { readDashboard, type DashboardGrid } from "@/repo/dashboard";
import {
  CHANNEL_ORDER,
  type Channel,
  type DashboardView,
  type DashboardKPI,
  type DashboardChannelMatrix,
  type DashboardWeeklyPoint,
  type DashboardCostBreakdown,
} from "@/types";

/** A1 좌표 → grid index. summary range 가 A1 부터 시작한다고 가정 (config 의 A1:Z40). */
function cell(grid: DashboardGrid, a1: string): unknown {
  // 컬럼 letters + row digits (예: "D21", "AA10")
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!m || !m[1] || !m[2]) return undefined;
  const colLetters = m[1];
  const row = Number(m[2]) - 1; // 0-based
  let col = 0;
  for (const ch of colLetters) col = col * 26 + (ch.charCodeAt(0) - 64);
  col -= 1;
  const r = grid[row];
  return r ? r[col] : undefined;
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapKPI(grid: DashboardGrid): DashboardKPI {
  const 총매출 = num(cell(grid, "D21"));
  const 총비용 = num(cell(grid, "E21"));
  const 영업이익 = 총매출 - 총비용;
  const 영업이익률 = 총매출 > 0 ? (영업이익 / 총매출) * 100 : 0;
  return {
    영업이익,
    영업이익률,
    총매출,
    총비용,
    누적수임비: 0, // TODO(prototype): 셀 좌표 확정 후 cell(grid, "?") 로 교체
  };
}

function mapChannelMatrix(_grid: DashboardGrid): DashboardChannelMatrix[] {
  // TODO(prototype): 채널 4지표 셀 좌표 확정 후 매핑.
  // 현재는 4채널 0-fill 로 길이 보존 (UI 가 안전하게 빈 차트 렌더).
  return CHANNEL_ORDER.map(
    (ch: Channel): DashboardChannelMatrix => ({
      채널: ch,
      생산: 0,
      유입: 0,
      컨택진행: 0,
      컨택성공: 0,
    }),
  );
}

function mapWeeklyTrend(_grid: DashboardGrid): DashboardWeeklyPoint[] {
  // TODO(prototype): 주차별 추이 셀 좌표 확정 후 매핑.
  return Array.from({ length: 8 }, (_, i) => ({
    주차: i + 1,
    영업이익: 0,
    활동량: 0,
  }));
}

function mapCostBreakdown(_grid: DashboardGrid): DashboardCostBreakdown[] {
  // TODO(prototype): 비용 구성 (매입DB/직접생산/현수막) 좌표 확정 후 매핑.
  return [
    { 채널: "매입DB", 비용: 0 },
    { 채널: "직접생산", 비용: 0 },
    { 채널: "현수막", 비용: 0 },
  ];
}

/**
 * 대시보드 1회 read 후 DashboardView 반환.
 * UI/Recharts 가 그대로 매핑할 수 있는 형태.
 */
export async function loadDashboard(email: string): Promise<DashboardView> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(
      `[dashboard] 마스터 레지스트리에 ${email} 사용자가 없습니다.`,
    );
  }
  const grid = await readDashboard(user.spreadsheetId);
  return {
    kpi: mapKPI(grid),
    channelMatrix: mapChannelMatrix(grid),
    weeklyTrend: mapWeeklyTrend(grid),
    costBreakdown: mapCostBreakdown(grid),
  };
}
