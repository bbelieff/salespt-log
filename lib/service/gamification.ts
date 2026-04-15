/**
 * Layer: service — 게이미피케이션 규칙. Repo 위에 앉는다.
 * UI/Runtime 은 이 모듈의 결과만 본다.
 */
import type { DailyEntry, MetricKey } from "@/types";

// XP 가중치 — MVP 초기값. docs/decisions/0002-* 에서 튜닝 근거 관리.
export const XP_WEIGHT: Record<MetricKey, number> = {
  production: 1,
  contact: 3,
  meeting: 15,
  contract: 100,
};

export interface Stats {
  totals: Record<MetricKey, number>;
  xp: number;
  level: number;
  streakDays: number;      // 연속 기록일수
  bestStreak: number;
  lastDate: string | null;
}

function xpOf(entry: DailyEntry): number {
  return (
    entry.production * XP_WEIGHT.production! +
    entry.contact * XP_WEIGHT.contact! +
    entry.meeting * XP_WEIGHT.meeting! +
    entry.contract * XP_WEIGHT.contract!
  );
}

function levelOf(xp: number): number {
  // 간단한 제곱근 커브: L1=0, L2=100, L3=400, L4=900, ...
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
  // 오늘까지 이어지는지 확인
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastStr = sorted[sorted.length - 1]!;
  const gapFromToday = Math.round(
    (new Date(todayStr).getTime() - new Date(lastStr).getTime()) / 86_400_000,
  );
  const current = gapFromToday <= 1 ? cur : 0;
  return { current, best };
}

export function summarize(entries: DailyEntry[]): Stats {
  const totals: Record<MetricKey, number> = {
    production: 0,
    contact: 0,
    meeting: 0,
    contract: 0,
  };
  let xp = 0;
  for (const e of entries) {
    totals.production += e.production;
    totals.contact += e.contact;
    totals.meeting += e.meeting;
    totals.contract += e.contract;
    xp += xpOf(e);
  }
  const { current, best } = computeStreak(entries.map((e) => e.date));
  return {
    totals,
    xp,
    level: levelOf(xp),
    streakDays: current,
    bestStreak: best,
    lastDate: entries.length > 0 ? entries[entries.length - 1]!.date : null,
  };
}
