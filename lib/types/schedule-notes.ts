/** 일정·계약 탭 주간 보드 — 일별 메모·주간 이슈(DB schedule_notes, 2026-11-11). */
import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const ScheduleIssue = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(300),
  urgent: z.boolean().default(false),
  done: z.boolean().default(false),
});
export type ScheduleIssue = z.infer<typeof ScheduleIssue>;
export const ScheduleIssues = z.array(ScheduleIssue).max(50);

export const ScheduleMemoText = z.string().max(2000);

/** GET 응답 — memos: 날짜 → 메모(없는 날은 빠짐) · issues: 그 수강 주(금요일 시작)의 이슈. */
export interface ScheduleNotesView {
  memos: Record<string, string>;
  issues: ScheduleIssue[];
}

/** PUT 본문 — 메모 한 날 또는 이슈 목록 한 주를 통째로 저장. */
export const ScheduleNotePut = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("memo"), date: IsoDate, text: ScheduleMemoText }),
  z.object({ kind: z.literal("issues"), weekStart: IsoDate, issues: ScheduleIssues }),
]);
export type ScheduleNotePut = z.infer<typeof ScheduleNotePut>;
