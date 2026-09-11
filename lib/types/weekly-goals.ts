import { z } from "zod";

export const GOAL_KEYS = ["production", "inflow", "contacts", "meetings", "contracts"] as const;
export type GoalKey = typeof GOAL_KEYS[number];
export const GOAL_LABELS: Record<GoalKey, string> = {
  production: "생산", inflow: "유입", contacts: "컨택완료", meetings: "미팅완료", contracts: "계약",
};
const count = z.number().int().min(0).max(2147483647).nullable();
export const WeeklyGoalValues = z.object({
  production: count, inflow: count, contacts: count, meetings: count, contracts: count,
}).strict();
export type WeeklyGoalValues = z.infer<typeof WeeklyGoalValues>;
export const EMPTY_GOALS: WeeklyGoalValues = {
  production: null, inflow: null, contacts: null, meetings: null, contracts: null,
};
export const WeeklyGoalInput = z.object({
  goals: WeeklyGoalValues,
  task: z.string().max(10000),
  revision: z.number().int().nonnegative().max(2147483647),
}).strict();
export type WeeklyGoalInput = z.infer<typeof WeeklyGoalInput>;
export const WeeklyGoalPrivateInput = z.object({
  specialNotes: z.string().max(10000),
  priorOutcome: z.string().max(10000),
  revision: z.number().int().nonnegative().max(2147483647),
}).strict();
export type WeeklyGoalPrivateInput = z.infer<typeof WeeklyGoalPrivateInput>;
export type GoalActuals = Record<GoalKey, number>;
export interface WeeklyGoalKey {
  email: string;
  cohort: string;
  courseStart: string;
  weekStart: string;
}
export interface WeeklyGoalRecord extends WeeklyGoalInput {
  updatedAt: string | null;
}
export interface WeeklyGoalPrivateRecord extends WeeklyGoalPrivateInput {
  updatedAt: string | null;
}
export interface GoalWeek {
  week: number;
  start: string;
  end: string;
  record: WeeklyGoalRecord;
  actuals: GoalActuals;
}
export interface WeeklyGoalView {
  student: { email: string; name: string; cohort: string; courseStart: string; region: string; trainers: string[] };
  current: GoalWeek;
  previous: GoalWeek | null;
  canReadInternal: boolean;
}
export interface GoalStudent {
  email: string;
  name: string;
  cohort: string;
}
export interface GoalOverviewRow extends GoalStudent {
  week: number | null;
  record: WeeklyGoalRecord | null;
  error: string | null;
}
