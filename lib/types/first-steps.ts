/** 첫걸음(새 수강생 온보딩) 계정별 기억 — DB first_steps 한 줄(2026-11-11). 규칙·판정은 lib/util/first-steps.ts. */
import { z } from "zod";

export const FIRST_STEP_KEYS = ["purchase", "lead", "contact", "meeting", "result", "payment", "review"] as const;
export const FIRST_STEP_TOUR_KEYS = ["purchase", "db-add", "contact", "meeting", "result", "payment"] as const;

export const FirstStepsMemorySchema = z.object({
  hidden: z.boolean().default(false),
  never: z.array(z.enum(FIRST_STEP_TOUR_KEYS)).max(FIRST_STEP_TOUR_KEYS.length).default([]),
  finished: z.array(z.enum(FIRST_STEP_TOUR_KEYS)).max(FIRST_STEP_TOUR_KEYS.length).default([]),
  reviewSeen: z.boolean().default(false),
});

/** PUT 본문·GET 응답 — memory + 끝낸 단계(done). */
export const FirstStepsState = z.object({
  memory: FirstStepsMemorySchema,
  done: z.array(z.enum(FIRST_STEP_KEYS)).max(FIRST_STEP_KEYS.length).default([]),
});
export type FirstStepsState = z.infer<typeof FirstStepsState>;

/** 관리자 화면 — 이메일(소문자) → 끝낸 단계 수. 줄이 없는 수강생은 빠진다. */
export interface FirstStepsProgressMap {
  byEmail: Record<string, number>;
  total: number;
}
