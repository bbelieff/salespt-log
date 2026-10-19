import { listGoalStudents, assertGoalStudentAccess, resolveGoalStudent } from "./weekly-goals";
import { readWeeklyGoal } from "@/repo/db/weekly-goals";

import { usesDbStorage } from "./daily-source";
import { goalWeekOf, goalWeekWindow, isValidISODate, todayKST } from "@/util/week";
import type { GoalOverviewRow } from "@/types/weekly-goals";

/** Aggregate only authorized students' persisted public goals. No private notes or N-person actual reads. */
export async function loadGoalOverview(): Promise<GoalOverviewRow[]> {
  const students = await listGoalStudents();
  const today = todayKST();
  const result: GoalOverviewRow[] = new Array(students.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, students.length) }, async () => {
    while (next < students.length) {
      const i = next++, student = students[i]!;
      try {
        const u = await resolveGoalStudent(student.email);
        if (!u || u.cohort !== student.cohort || !isValidISODate(u.courseStartISO) || !usesDbStorage(u)) throw new Error();
        await assertGoalStudentAccess(u);
        const week = goalWeekOf(today, u.courseStartISO);
        const weekStart = goalWeekWindow(u.courseStartISO, week).start;
        const record = await readWeeklyGoal({ studentId: u.spreadsheetId, cohort: u.cohort, courseStart: u.courseStartISO, weekStart });
        result[i] = { ...student, week, record, error: null };
      } catch {
        result[i] = { ...student, week: null, record: null, error: "목표를 불러오지 못했어요." };
      }
    }
  }));
  return result;
}
