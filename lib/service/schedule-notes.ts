/** Layer: service — 일정 보드 일별 메모·주간 이슈. 저장값이 이상하면 빈 값으로 읽는다. */
import { readScheduleNotes, writeScheduleNote } from "@/repo/db/schedule-notes";
import { ScheduleIssues, ScheduleMemoText, type ScheduleNotePut, type ScheduleNotesView } from "@/types";

const memoKey = (date: string) => `memo:${date}`;
const issuesKey = (weekStart: string) => `issues:${weekStart}`;

/** dates: 보드에 보이는 날짜들(메모) · issuesWeek: 이슈를 묶는 수강 주의 금요일. */
export async function getScheduleNotes(email: string, dates: string[], issuesWeek: string): Promise<ScheduleNotesView> {
  const rows = await readScheduleNotes(email, [...dates.map(memoKey), issuesKey(issuesWeek)]);
  const view: ScheduleNotesView = { memos: {}, issues: [] };
  for (const r of rows) {
    if (r.note_key === issuesKey(issuesWeek)) {
      const parsed = ScheduleIssues.safeParse(r.body);
      if (parsed.success) view.issues = parsed.data;
    } else {
      const parsed = ScheduleMemoText.safeParse(r.body);
      if (parsed.success && parsed.data) view.memos[r.note_key.slice(5)] = parsed.data;
    }
  }
  return view;
}

export async function saveScheduleNote(email: string, input: ScheduleNotePut): Promise<void> {
  if (input.kind === "memo") await writeScheduleNote(email, memoKey(input.date), input.text);
  else await writeScheduleNote(email, issuesKey(input.weekStart), input.issues);
}
