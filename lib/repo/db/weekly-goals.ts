import { dbEnabled, getDbPool } from "./client";
import {
  EMPTY_GOALS, WeeklyGoalInput, WeeklyGoalPrivateInput,
  type WeeklyGoalKey, type WeeklyGoalRecord, type WeeklyGoalPrivateRecord,
} from "@/types/weekly-goals";

function pool() {
  if (!dbEnabled()) throw new Error("weekly_goals_unavailable");
  return getDbPool();
}
const keyArgs = (k: WeeklyGoalKey) => [k.studentId, k.cohort, k.courseStart, k.weekStart];
const where = "student_id=$1 and cohort=$2 and course_start=$3::date and week_start=$4::date";
export async function readWeeklyGoal(k: WeeklyGoalKey): Promise<WeeklyGoalRecord> {
  const result = await pool().query(
    `select production,inflow,contacts,meetings,contracts,task,revision,updated_at from weekly_goals where ${where}`, keyArgs(k),
  );
  const r = result.rows[0];
  if (!r) return { goals: { ...EMPTY_GOALS }, task: "", revision: 0, updatedAt: null };
  return {
    ...WeeklyGoalInput.parse({ goals: { production: r.production, inflow: r.inflow, contacts: r.contacts, meetings: r.meetings, contracts: r.contracts }, task: r.task, revision: r.revision }),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}
export async function readWeeklyGoalPrivate(k: WeeklyGoalKey): Promise<WeeklyGoalPrivateRecord> {
  const result = await pool().query(
    `select special_notes,prior_outcome,revision,updated_at from weekly_goal_private where ${where}`, keyArgs(k),
  );
  const r = result.rows[0];
  if (!r) return { specialNotes: "", priorOutcome: "", revision: 0, updatedAt: null };
  return { ...WeeklyGoalPrivateInput.parse({ specialNotes: r.special_notes, priorOutcome: r.prior_outcome, revision: r.revision }), updatedAt: new Date(r.updated_at).toISOString() };
}

/** Atomic compare-and-swap: missing row revision=0; two writers can never both succeed. */
export async function saveWeeklyGoal(k: WeeklyGoalKey, input: WeeklyGoalInput): Promise<boolean> {
  const v = WeeklyGoalInput.parse(input);
  const args = [...keyArgs(k), v.goals.production, v.goals.inflow, v.goals.contacts, v.goals.meetings, v.goals.contracts, v.task, v.revision];
  const result = v.revision === 0
    ? await pool().query(
      `insert into weekly_goals(student_id,cohort,course_start,week_start,production,inflow,contacts,meetings,contracts,task,revision)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1) on conflict do nothing returning revision`, args.slice(0, 10))
    : await pool().query(
      `update weekly_goals set production=$5,inflow=$6,contacts=$7,meetings=$8,contracts=$9,task=$10,
       revision=revision+1,updated_at=now() where ${where} and revision=$11 returning revision`, args);
  return result.rowCount === 1;
}
export async function saveWeeklyGoalPrivate(k: WeeklyGoalKey, input: WeeklyGoalPrivateInput): Promise<boolean> {
  const v = WeeklyGoalPrivateInput.parse(input);
  const args = [...keyArgs(k), v.specialNotes, v.priorOutcome, v.revision];
  const result = v.revision === 0
    ? await pool().query(
      `insert into weekly_goal_private(student_id,cohort,course_start,week_start,special_notes,prior_outcome,revision)
       values($1,$2,$3,$4,$5,$6,1) on conflict do nothing returning revision`, args.slice(0, 6))
    : await pool().query(
      `update weekly_goal_private set special_notes=$5,prior_outcome=$6,revision=revision+1,updated_at=now()
       where ${where} and revision=$7 returning revision`, args);
  return result.rowCount === 1;
}
