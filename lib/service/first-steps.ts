/** Layer: service — 첫걸음 계정별 기억. 저장값이 이상하면 빈 기억으로 읽는다. */
import { listFirstStepsDone, readFirstSteps, writeFirstSteps } from "@/repo/db/first-steps";
import { FIRST_STEP_KEYS, FirstStepsMemorySchema, type FirstStepsProgressMap, type FirstStepsState } from "@/types";

type StepKey = (typeof FIRST_STEP_KEYS)[number];
const isStepKey = (k: string): k is StepKey => (FIRST_STEP_KEYS as readonly string[]).includes(k);
const EMPTY_MEMORY: FirstStepsState["memory"] = { hidden: false, never: [], finished: [], reviewSeen: false, started: false };

/** null = 아직 저장한 적 없음(화면이 브라우저 기억을 올려도 된다). */
export async function getFirstSteps(email: string): Promise<FirstStepsState | null> {
  const row = await readFirstSteps(email);
  if (!row) return null;
  const memory = FirstStepsMemorySchema.safeParse(row.memory);
  return { memory: memory.success ? memory.data : EMPTY_MEMORY, done: (row.done ?? []).filter(isStepKey) };
}

export async function saveFirstSteps(email: string, value: FirstStepsState): Promise<FirstStepsState> {
  await writeFirstSteps(email, value);
  return value;
}

export async function listFirstStepsProgress(): Promise<FirstStepsProgressMap> {
  const rows = await listFirstStepsDone();
  return {
    byEmail: Object.fromEntries(rows.map((r) => [r.email, new Set((r.done ?? []).filter(isStepKey)).size])),
    total: FIRST_STEP_KEYS.length,
  };
}
