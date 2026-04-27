/**
 * Layer: service — 게이미피케이션 규칙. Repo 위에 앉는다.
 * UI/Runtime 은 이 모듈의 결과만 본다.
 *
 * MVP 산식 (docs/decisions/0002-xp-weights.md 에서 튜닝):
 *   - 4지표(생산/유입/컨택진행/컨택성공) → XP 가산
 *   - 미팅 진행(완료/계약) → XP 가산
 *   - 계약 → 큰 XP + 수임비 가산
 *
 * PR 1 시점: 시그니처만 새 모델로 정렬, 구현 디테일은 PR 2/3에서 채운다.
 */
import type {
  ChannelDailyRow,
  Meeting,
  MetricKey,
} from "@/types";

// XP 가중치 — 4지표 기반. 미팅 단계는 별도 배수.
export const XP_WEIGHT: Record<MetricKey, number> = {
  production: 1,
  inflow: 2,
  contactProgress: 3,
  contactSuccess: 10,
};

// 미팅 상태별 추가 XP (4지표와 별개)
export const MEETING_XP: Record<"완료" | "계약", number> = {
  완료: 15,
  계약: 100,
};

export interface Stats {
  totals: Record<MetricKey, number>;
  meetingsByState: {
    예약: number;
    완료: number;
    계약: number;
    변경: number;
    취소: number;
  };
  feeTotal: number; // 수임비 합 (만원)
  xp: number;
  level: number;
  streakDays: number;
  bestStreak: number;
  lastDate: string | null;
}

function levelOf(xp: number): number {
  // 제곱근 커브: L1=0, L2=100, L3=400, L4=900, ...
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

function computeStreak(dates: string[]): { current: number; best: number } {
  if (dates.length === 0) return { current: 0, best: 0 };
  const sorted = [...new Set(dates)].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!).getTime();
    const now = new Date(sorted[i]!).getTime();
    const gapDays = Math.round((now - prev) / 86_400_000);
    if (gapDays === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else if (gapDays > 1) {
      cur = 1;
    }
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastStr = sorted[sorted.length - 1]!;
  const gapFromToday = Math.round(
    (new Date(todayStr).getTime() - new Date(lastStr).getTime()) / 86_400_000,
  );
  const current = gapFromToday <= 1 ? cur : 0;
  return { current, best };
}

/**
 * 영업관리 행(날짜×채널, 4지표 카운트) + 업체관리 미팅을 받아 통계로 합산.
 * @param rows 영업관리 탭의 1행 = (날짜, 채널) + 4지표 카운트
 * @param meetings 업체관리 탭의 미팅 레코드들
 */
export function summarize(
  rows: ChannelDailyRow[],
  meetings: Meeting[],
): Stats {
  const totals: Record<MetricKey, number> = {
    production: 0,
    inflow: 0,
    contactProgress: 0,
    contactSuccess: 0,
  };
  let xp = 0;
  for (const r of rows) {
    totals.production += r.production;
    totals.inflow += r.inflow;
    totals.contactProgress += r.contactProgress;
    totals.contactSuccess += r.contactSuccess;
    xp +=
      r.production * XP_WEIGHT.production +
      r.inflow * XP_WEIGHT.inflow +
      r.contactProgress * XP_WEIGHT.contactProgress +
      r.contactSuccess * XP_WEIGHT.contactSuccess;
  }

  const meetingsByState = { 예약: 0, 완료: 0, 계약: 0, 변경: 0, 취소: 0 };
  let feeTotal = 0;
  for (const m of meetings) {
    meetingsByState[m.state] += 1;
    if (m.state === "완료") xp += MEETING_XP.완료;
    if (m.state === "계약") {
      xp += MEETING_XP.계약;
      feeTotal += m.fee;
    }
  }

  const dateSet = new Set<string>();
  for (const r of rows) dateSet.add(r.date);
  for (const m of meetings) dateSet.add(m.meetingDate);
  const dates = [...dateSet].sort();
  const { current, best } = computeStreak(dates);

  return {
    totals,
    meetingsByState,
    feeTotal,
    xp,
    level: levelOf(xp),
    streakDays: current,
    bestStreak: best,
    lastDate: dates.length > 0 ? dates[dates.length - 1]! : null,
  };
}
