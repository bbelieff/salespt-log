/**
 * 대시보드 주간 목표 카드의 한 줄 문장(belie 2026-10-12 #8) — 순수 함수, 새 조회 없음.
 *
 * 링이 이미 받는 목표·실적만 쓴다. 목표 판정은 GoalRings 와 같다: null = 미기재,
 * 0 = 목표 0(문장 대상 아님), 실적 ≥ 목표면 달성(초과 포함). 남은 목표는 결과 지표부터
 * (계약 → 미팅완료 → 컨택완료 → 유입 → 생산) 첫 번째 하나만 말한다. 링 아래 칸별
 * 「N 남음/초과」 줄은 계속 숨긴다(2026-09-14 정리) — 문장은 카드당 1개.
 * 숫자는 링과 같이 콤마 없이, 단위는 「건」. SSOT: docs/design/components.md §9 「대시보드 한 줄 문장」.
 */
import { GOAL_KEYS, GOAL_LABELS, type GoalActuals, type GoalKey, type WeeklyGoalValues } from "@/types/weekly-goals";
import type { Headline } from "@/components/ui/CardHeadline";

/** 남은 목표를 고르는 순서 — 결과 지표 먼저. */
export const GOAL_HEADLINE_PRIORITY: readonly GoalKey[] = ["contracts", "meetings", "contacts", "inflow", "production"];

export interface GoalHeadlineInput {
  goals: WeeklyGoalValues;
  actuals: GoalActuals;
  /** 카드가 보여 주는 지표(기본 5개 전부). */
  metrics?: readonly GoalKey[];
  /** 그 주가 이미 끝났는지(주 끝 < 오늘 KST) — 끝났으면 과거형. */
  ended: boolean;
}

export function goalHeadline({ goals, actuals, metrics = GOAL_KEYS, ended }: GoalHeadlineInput): Headline | null {
  const goalOf = (k: GoalKey) => goals[k] ?? 0;
  const set = metrics.filter((k) => goalOf(k) > 0);
  if (set.length === 0) {
    // 목표 0 을 일부러 적은 주는 「안 정했다」가 아니다 — 문장 없음.
    if (metrics.some((k) => goals[k] === 0)) return null;
    return { text: ended ? "이 주는 목표를 정하지 않았어요" : "아직 목표를 정하지 않았어요", tone: "neutral" };
  }
  const open = GOAL_HEADLINE_PRIORITY.find((k) => set.includes(k) && (actuals[k] ?? 0) < goalOf(k));
  if (!open) return { text: "세운 목표를 모두 달성했어요", emoji: "🎉", tone: "done" };
  const left = goalOf(open) - (actuals[open] ?? 0);
  return ended
    ? { text: `${GOAL_LABELS[open]} 목표에 ${left}건 못 미쳤어요`, tone: "neutral" }
    : { text: `${GOAL_LABELS[open]} 목표까지 ${left}건 남았어요`, emoji: "💪", tone: "neutral" };
}
