import { describe, expect, it } from "vitest";
import { goalHeadline } from "@/components/weekly-goals/goal-headline";
import { EMPTY_GOALS, type GoalActuals, type WeeklyGoalValues } from "@/types/weekly-goals";

// belie 2026-10-12 #8 — 주간 목표 카드 한 줄 문장(진행 중 / 지난 주 두 형태를 모두 단언).
const goals = (o: Partial<WeeklyGoalValues>): WeeklyGoalValues => ({ ...EMPTY_GOALS, ...o });
const actuals = (o: Partial<GoalActuals> = {}): GoalActuals => ({ production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0, ...o });
const SET = goals({ production: 20, inflow: 10, contacts: 5, meetings: 3, contracts: 2 });

describe("goalHeadline", () => {
  it("목표 미기재 — 진행 중 / 지난 주", () => {
    expect(goalHeadline({ goals: EMPTY_GOALS, actuals: actuals(), ended: false })).toEqual({ text: "아직 목표를 정하지 않았어요", tone: "neutral" });
    expect(goalHeadline({ goals: EMPTY_GOALS, actuals: actuals(), ended: true })).toEqual({ text: "이 주는 목표를 정하지 않았어요", tone: "neutral" });
  });

  it("미기재와 0 만 있으면 문장 없음", () => {
    expect(goalHeadline({ goals: goals({ production: 0 }), actuals: actuals({ production: 4 }), ended: false })).toBeNull();
    expect(goalHeadline({ goals: goals({ production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 }), actuals: actuals(), ended: true })).toBeNull();
  });

  it("세운 목표 모두 달성(초과 포함) → 🎉 done, 지난 주도 같음", () => {
    const met = { goals: goals({ production: 20, contracts: 1, meetings: 0 }), actuals: actuals({ production: 25, contracts: 1 }) };
    expect(goalHeadline({ ...met, ended: false })).toEqual({ text: "세운 목표를 모두 달성했어요", emoji: "🎉", tone: "done" });
    expect(goalHeadline({ ...met, ended: true })).toEqual({ text: "세운 목표를 모두 달성했어요", emoji: "🎉", tone: "done" });
  });

  it("계약·미팅 둘 다 미달 → 계약을 먼저 말한다", () => {
    const a = actuals({ production: 12, inflow: 4, contacts: 3, meetings: 1, contracts: 1 });
    expect(goalHeadline({ goals: SET, actuals: a, ended: false })).toEqual({ text: "계약 목표까지 1건 남았어요", emoji: "💪", tone: "neutral" });
  });

  it("지난 주는 과거형·이모지 없음", () => {
    const a = actuals({ production: 12, inflow: 4, contacts: 3, meetings: 1, contracts: 1 });
    expect(goalHeadline({ goals: SET, actuals: a, ended: true })).toEqual({ text: "계약 목표에 1건 못 미쳤어요", tone: "neutral" });
  });

  it("계약을 채웠으면 미팅완료 → 컨택완료 → 유입 → 생산 순서", () => {
    expect(goalHeadline({ goals: SET, actuals: actuals({ contracts: 2, meetings: 1 }), ended: false })?.text).toBe("미팅완료 목표까지 2건 남았어요");
    expect(goalHeadline({ goals: SET, actuals: actuals({ contracts: 3, meetings: 3 }), ended: false })?.text).toBe("컨택완료 목표까지 5건 남았어요");
    expect(goalHeadline({ goals: SET, actuals: actuals({ contracts: 2, meetings: 3, contacts: 5 }), ended: false })?.text).toBe("유입 목표까지 10건 남았어요");
    expect(goalHeadline({ goals: SET, actuals: actuals({ contracts: 2, meetings: 3, contacts: 5, inflow: 10, production: 1 }), ended: false })?.text).toBe("생산 목표까지 19건 남았어요");
  });

  it("metrics 부분 집합만 본다", () => {
    const a = actuals({ contracts: 0, inflow: 4, contacts: 5 });
    expect(goalHeadline({ goals: SET, actuals: a, metrics: ["inflow", "contacts"], ended: false })?.text).toBe("유입 목표까지 6건 남았어요");
    expect(goalHeadline({ goals: SET, actuals: actuals({ inflow: 10, contacts: 5 }), metrics: ["inflow", "contacts"], ended: false })?.text).toBe("세운 목표를 모두 달성했어요");
  });

  it("목표가 null 인 칸은 건너뛴다", () => {
    const g = goals({ contracts: null, meetings: 4 });
    expect(goalHeadline({ goals: g, actuals: actuals({ contracts: 0, meetings: 1 }), ended: false })?.text).toBe("미팅완료 목표까지 3건 남았어요");
  });

  it("큰 수는 콤마 없이(링과 같게)", () => {
    expect(goalHeadline({ goals: goals({ contacts: 1500 }), actuals: actuals({ contacts: 266 }), ended: false })?.text).toBe("컨택완료 목표까지 1234건 남았어요");
  });
});
