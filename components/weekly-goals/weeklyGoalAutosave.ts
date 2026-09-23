/**
 * Weekly-goals autosave domain — payload builders + frozen identity + bound URLs.
 *
 * Lives under components/weekly-goals (NOT lib/util): the builders validate
 * through Zod schemas, and lib/util is a zero-dependency purity layer
 * (tests/structural/period-hardcode.test.ts enforces no imports there).
 *
 * Autosave sends ONLY validated payloads; each record keeps its own CAS
 * revision (public goal record vs internal trainer record are never mixed —
 * master #1010). Callers pass the SAVED revision, never a draft revision.
 */
import type { AutosaveTarget } from "@/util/autosave-queue";
import {
  WeeklyGoalInput,
  WeeklyGoalPrivateInput,
  type WeeklyGoalValues,
  type WeeklyGoalView,
} from "@/types/weekly-goals";

export interface PublicGoalPayload {
  goals: WeeklyGoalValues;
  task: string;
  revision: number;
}

export interface InternalGoalPayload {
  specialNotes: string;
  priorOutcome: string;
  revision: number;
}

export type PayloadResult<T> =
  | { ok: true; payload: T }
  | { ok: false; error: string };

const TASK_LIMIT = 10000;

/** Public goal + PT-task payload. Invalid input is rejected — never sent. */
export function buildPublicPayload(
  goals: WeeklyGoalValues,
  task: string,
  savedRevision: number,
): PayloadResult<PublicGoalPayload> {
  if (task.length > TASK_LIMIT) {
    return { ok: false, error: "PT과제가 너무 길어요. 10,000자 아래로 줄여 주세요." };
  }
  const parsed = WeeklyGoalInput.safeParse({ goals, task, revision: savedRevision });
  if (!parsed.success) {
    return { ok: false, error: "목표는 0 이상의 정수 또는 빈칸으로 입력해 주세요." };
  }
  return { ok: true, payload: parsed.data };
}

/** Internal trainer record payload (separate CAS revision — never the public one). */
export function buildInternalPayload(
  specialNotes: string,
  priorOutcome: string,
  savedRevision: number,
): PayloadResult<InternalGoalPayload> {
  if (specialNotes.length > TASK_LIMIT || priorOutcome.length > TASK_LIMIT) {
    return { ok: false, error: "기록이 너무 길어요. 10,000자 아래로 줄여 주세요." };
  }
  const parsed = WeeklyGoalPrivateInput.safeParse({
    specialNotes,
    priorOutcome,
    revision: savedRevision,
  });
  if (!parsed.success) {
    return { ok: false, error: "입력을 확인해 주세요." };
  }
  return { ok: true, payload: parsed.data };
}

/** Frozen queue identity — student/enrollment/week fixed at schedule time. */
export function goalTargetOf(view: WeeklyGoalView, section: "public" | "internal"): AutosaveTarget {
  return {
    kind: `weekly-goal-${section}`,
    student: view.student.email,
    cohort: view.student.cohort,
    courseStart: view.student.courseStart,
    week: view.current.week,
    weekStart: view.current.start,
  };
}

/**
 * Bound request params from the CAPTURED queue target — never the live view.
 * Field-for-field identical to goalParams(view) in ./client: a debounced save
 * scheduled on week N must still PUT week N after the user switches weeks
 * (the page remounts per week, but an in-flight save closure would otherwise
 * read the new view). No stale-week writes.
 */
export function goalParamsFromTarget(target: AutosaveTarget): URLSearchParams {
  return new URLSearchParams({
    student: String(target.student ?? ""),
    week: String(target.week ?? ""),
    enrollment: JSON.stringify([target.cohort ?? null, target.courseStart ?? null]),
  });
}

/**
 * Leave-without-save discard — final F-core exposes discard() only.
 *
 * Call sites: DirtyGuard onCancel callbacks ONLY (drop scheduled work, show
 * the saved baseline again). Refetch/move adoptions that intentionally move
 * the baseline to a fresh server snapshot keep using syncServer and are
 * marked at each site — those are NOT discards. Never use dirty syncServer
 * as a discard or as an acknowledgement.
 */
export function discardUnsaved(auto: { discard: () => void }): void {
  auto.discard();
}
