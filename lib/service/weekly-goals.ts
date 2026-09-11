import { getSessionEmail, getActiveUserEmail, getEffectiveRole } from "@/auth/identity";
import { findUserByEmail, listDistinctUsers, parseAssignedTrainers } from "@/repo/users";
import { findActiveArenaRowByEmail } from "@/repo/users-arena";
import { dbEnabled, readSalesRowsFromDb } from "@/repo/db/client";
import { readMeetingsFromDb, readContractsFromDb } from "@/repo/db/read-daily";
import { readWeeklyGoal, readWeeklyGoalPrivate, saveWeeklyGoal, saveWeeklyGoalPrivate } from "@/repo/db/weekly-goals";
import { chooseDailySource } from "./daily-source";
import { weeklyGoalActuals } from "./weekly-goals-actuals";
import { addDays, fmtISO, friOf, friWeekIndexOf, isValidISODate, parseISO, todayKST } from "@/util/week";
import { WeeklyGoalInput, WeeklyGoalPrivateInput, type WeeklyGoalKey, type WeeklyGoalView, type GoalStudent } from "@/types/weekly-goals";
import type { User } from "@/types";

export class WeeklyGoalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function actor() {
  const email = await getSessionEmail();
  if (!email) throw new WeeklyGoalError(401, "로그인이 필요해요.");
  const role = await getEffectiveRole(email);
  if (role.status === "pending" || (role.role === "trainer" && role.status !== "active")) {
    throw new WeeklyGoalError(403, "접근 권한이 없어요.");
  }
  return { email, role: role.role, internal: role.role === "admin" || role.role === "trainer" };
}
/** Recheck the actual freshly resolved row, including assignment revocation between roster and detail. */
export async function assertGoalStudentAccess(u: User) {
  const a = await actor();
  if (u.role !== "trainee" || u.status === "pending" ||
    (a.role !== "admin" && a.email.toLowerCase() !== u.email.toLowerCase() &&
      !(a.role === "trainer" && parseAssignedTrainers(u.assignedTrainer).includes(a.email.toLowerCase())))) {
    throw new WeeklyGoalError(403, "이 수강생을 조회할 권한이 없어요.");
  }
  // A trainer's own student enrollment does not inherit trainer-only note rights.
  const ownArena = a.role === "trainer" ? await findActiveArenaRowByEmail(a.email) : null;
  const self = a.email.toLowerCase() === u.email.toLowerCase() ||
    !!(ownArena && ownArena.spreadsheetId === u.spreadsheetId && ownArena.cohort === u.cohort && ownArena.courseStartISO === u.courseStartISO);
  return { ...a, internal: a.role === "admin" || (a.role === "trainer" && !self && parseAssignedTrainers(u.assignedTrainer).includes(a.email.toLowerCase())) };
}

/** Same-email trainer+arena convention used by me/profile; no name-based privilege expansion. */
export async function resolveGoalStudent(email: string): Promise<User | null> {
  const preferred = await findUserByEmail(email);
  if (preferred?.role !== "trainer") return preferred;
  const arena = await findActiveArenaRowByEmail(email);
  return arena?.role === "trainee" && arena.status === "active" &&
    arena.email.toLowerCase() === email.toLowerCase() ? arena : null;
}

export async function listGoalStudents(): Promise<GoalStudent[]> {
  const a = await actor();
  if (!a.internal) throw new WeeklyGoalError(403, "트레이너만 조회할 수 있어요.");
  const users = await listDistinctUsers();
  const fresh = await actor();
  if (!fresh.internal || fresh.email !== a.email) throw new WeeklyGoalError(403, "접근 권한이 바뀌었어요.");
  return users.filter(u => u.role === "trainee" && u.status !== "pending" &&
    (fresh.role === "admin" || parseAssignedTrainers(u.assignedTrainer).includes(fresh.email.toLowerCase())))
    .map(u => ({ email: u.email, name: u.name, cohort: u.cohort }));
}

/** Resolve every request on the server; never trust a submitted cohort, role or sheet id. */
async function context(params: URLSearchParams) {
  await actor();
  const target = params.get("student") || await getActiveUserEmail();
  const u = await resolveGoalStudent(target);
  if (!u || u.role !== "trainee" || u.status === "pending") throw new WeeklyGoalError(403, "수강생 계정을 확인해 주세요.");
  const checkedActor = await assertGoalStudentAccess(u);
  if (!isValidISODate(u.courseStartISO)) throw new WeeklyGoalError(422, "수강 시작일 확인이 필요해요.");
  if (!u.spreadsheetId || chooseDailySource(u.cohort, dbEnabled()) !== "db") {
    throw new WeeklyGoalError(503, "이 계정의 주간 목표를 아직 불러올 수 없어요.");
  }
  const courseStart = parseISO(u.courseStartISO);
  const date = params.get("date") || todayKST();
  if (!isValidISODate(date)) throw new WeeklyGoalError(400, "날짜를 확인해 주세요.");
  const selected = params.get("week");
  const week = selected === null ? Math.max(1, friWeekIndexOf(parseISO(date), courseStart)) : Number(selected);
  if (!Number.isSafeInteger(week) || week < 1 || week > 5200) throw new WeeklyGoalError(400, "주차를 확인해 주세요.");
  const start = fmtISO(addDays(friOf(courseStart), (week - 1) * 7));
  // Enrollment echo prevents an old open editor silently writing into a newly assigned cohort.
  const enrollment = params.get("enrollment");
  if (enrollment !== null && enrollment !== JSON.stringify([u.cohort, u.courseStartISO])) {
    throw new WeeklyGoalError(409, "수강 정보가 바뀌었어요. 새로 불러와 주세요.");
  }
  const key: WeeklyGoalKey = { studentId: u.spreadsheetId, cohort: u.cohort, courseStart: u.courseStartISO, weekStart: start };
  return { a: checkedActor, u, key, week };
}

export async function loadWeeklyGoals(params: URLSearchParams): Promise<WeeklyGoalView> {
  const { a, u, key, week } = await context(params);
  const previousStart = fmtISO(addDays(parseISO(key.weekStart), -7));
  const [record, previous, sales, meetings, payments] = await Promise.all([
    readWeeklyGoal(key),
    week > 1 ? readWeeklyGoal({ ...key, weekStart: previousStart }) : Promise.resolve(null),
    readSalesRowsFromDb(u.spreadsheetId), readMeetingsFromDb(u.spreadsheetId), readContractsFromDb(u.spreadsheetId),
  ]);
  const all = await listDistinctUsers();
  const trainers = parseAssignedTrainers(u.assignedTrainer).map(email =>
    all.find(t => t.email.toLowerCase() === email)?.name || email);
  const weekData = (start: string, number: number, saved: typeof record) => {
    const end = fmtISO(addDays(parseISO(start), 6));
    return { week: number, start, end, record: saved, actuals: weeklyGoalActuals(sales, meetings, payments, start, end) };
  };
  // Explicit public projection: never spread User (tokens) or private record into a response.
  return {
    student: { email: u.email, name: u.name, cohort: u.cohort, courseStart: u.courseStartISO, region: u.team, trainers },
    current: weekData(key.weekStart, week, record),
    previous: previous ? weekData(previousStart, week - 1, previous) : null,
    canReadInternal: a.internal,
  };
}

export async function updateWeeklyGoals(params: URLSearchParams, body: unknown) {
  if (!params.get("student")?.trim()) throw new WeeklyGoalError(400, "저장할 수강생을 확인해 주세요.");
  const { key } = await context(params);
  if (!params.has("week") || !params.has("enrollment")) throw new WeeklyGoalError(400, "저장할 주차와 수강 정보를 확인해 주세요.");
  const parsed = WeeklyGoalInput.safeParse(body);
  if (!parsed.success) throw new WeeklyGoalError(400, "목표는 0 이상의 정수 또는 빈칸으로 입력해 주세요.");
  if (!(await saveWeeklyGoal(key, parsed.data))) throw new WeeklyGoalError(409, "다른 곳에서 수정했어요. 입력을 보관한 뒤 최신 내용을 불러와 주세요.");
  return { revision: parsed.data.revision + 1 };
}
export async function loadWeeklyGoalInternal(params: URLSearchParams) {
  const { a, key } = await context(params);
  if (!a.internal) throw new WeeklyGoalError(403, "내부 기록을 조회할 권한이 없어요.");
  return readWeeklyGoalPrivate(key);
}
export async function updateWeeklyGoalInternal(params: URLSearchParams, body: unknown) {
  if (!params.get("student")?.trim()) throw new WeeklyGoalError(400, "저장할 수강생을 확인해 주세요.");
  const { a, key } = await context(params);
  if (!a.internal) throw new WeeklyGoalError(403, "내부 기록을 수정할 권한이 없어요.");
  if (!params.has("week") || !params.has("enrollment")) throw new WeeklyGoalError(400, "저장할 주차와 수강 정보를 확인해 주세요.");
  const parsed = WeeklyGoalPrivateInput.safeParse(body);
  if (!parsed.success) throw new WeeklyGoalError(400, "내부 기록 입력을 확인해 주세요.");
  if (!(await saveWeeklyGoalPrivate(key, parsed.data))) throw new WeeklyGoalError(409, "내부 기록이 다른 곳에서 수정됐어요. 입력을 보관한 뒤 최신 내용을 불러와 주세요.");
  return { revision: parsed.data.revision + 1 };
}
