/** 미리 알림 1단계 (belie 2026-10-26) — 미팅 N분 전·할 일 15분 전·부재 다시 걸기. 합성 업체·시각. */
import { describe, expect, it } from "vitest";
import type { ContractPayment, Meeting, Todo } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";
import { REMINDER_KINDS } from "@/types/push";
import { dueReminders } from "@/service/push-reminders";

const DAY = "2026-10-27"; // Tue
const at = (time: string) => ({ date: DAY, weekday: 2, time });
const prefs = { reminderKinds: [...REMINDER_KINDS], meetingLeadMinutes: 60 as const, showCompanyNames: true };
const meeting = (p: Partial<Meeting> = {}): Meeting => ({ id: "m1", 미팅날짜: DAY, 미팅시간: "14:00", 업체명: "한빛상사", 장소: "강남", 상태: "예약", ...p } as unknown as Meeting);
const todo = (p: Partial<Todo> = {}): Todo => ({ id: "t1", contractRef: "2026-09-20|한빛상사", institutionRef: "", 업체명: "한빛상사", type: "전화", 제목: "서류 제출", 예정일자: DAY, 예정시각: "15:00", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false, 생성시각: "", 분류: "", 기록종류: "todo", ...p } as Todo);
const lead = (p: Partial<DbSheetLead> = {}): DbSheetLead => ({ id: "l1", company: "새봄유통", result: "부재", next: DAY, meetingId: null, date: "2026-10-20", absences: [{ date: "2026-10-26", hour: 10 }], ...p } as unknown as DbSheetLead);
const cp = { row: 7, 계약일: "2026-09-20", 업체명: "한빛상사" } as unknown as ContractPayment;

describe("meeting_before", () => {
  it("fires in the tick that holds meeting time − lead, once", () => {
    expect(dueReminders({ meetings: [meeting()] }, prefs, at("12:45"))).toEqual([]);
    const [r] = dueReminders({ meetings: [meeting()] }, prefs, at("13:00"));
    expect(r).toMatchObject({ kind: "meeting_before", key: "meeting_before:m1", url: `/schedule?date=${DAY}&focus=m1` });
    expect(r!.body).toBe("14:00 한빛상사 미팅, 1시간 남았어요. 지난 상담 메모 한 번 볼까요?");
    expect(dueReminders({ meetings: [meeting()] }, prefs, at("13:15"))).toEqual([]);
  });
  it("follows the 30분·2시간 choice and skips other days, results already in, or before 7am", () => {
    expect(dueReminders({ meetings: [meeting()] }, { ...prefs, meetingLeadMinutes: 120 }, at("12:00"))[0]!.body).toContain("2시간 남았어요");
    expect(dueReminders({ meetings: [meeting({ 미팅날짜: "2026-10-28" })] }, prefs, at("13:00"))).toEqual([]);
    expect(dueReminders({ meetings: [meeting({ 상태: "완료" } as Partial<Meeting>)] }, prefs, at("13:00"))).toEqual([]);
    expect(dueReminders({ meetings: [meeting({ 미팅시간: "07:30" })] }, prefs, at("06:30"))).toEqual([]);
  });
  it("hides the company when asked", () => {
    expect(dueReminders({ meetings: [meeting()] }, { ...prefs, showCompanyNames: false }, at("13:00"))[0]!.body).toBe("1시간 뒤 미팅이 있어요. 준비할 것을 한 번 볼까요?");
  });
});

describe("todo_before", () => {
  it("fires 15 minutes before a timed open todo and links to its contract", () => {
    const [r] = dueReminders({ todos: [todo()], contracts: [cp] }, prefs, at("14:45"));
    expect(r!.body).toBe("15분 뒤 한빛상사 「서류 제출」 하기로 하셨어요.");
    expect(r!.url).toBe("/payment?row=7&focus=t1");
  });
  it("ignores done, untimed, history and personal events", () => {
    for (const t of [todo({ 완료여부: true }), todo({ 예정시각: "" }), todo({ 기록종류: "history" }), todo({ type: "일반" })]) {
      expect(dueReminders({ todos: [t] }, prefs, at("14:45"))).toEqual([]);
    }
  });
});

describe("absence_retry", () => {
  it("suggests the other half of the day from the last absence", () => {
    const [r] = dueReminders({ leads: [lead()] }, prefs, at("14:45"));
    expect(r!.body).toBe("어제 오전 10시엔 부재였던 새봄유통, 오후 3시에 다시 걸어 볼까요?");
    expect(r!.url).toBe("/db-sheet?lead=l1");
    const [m] = dueReminders({ leads: [lead({ absences: [{ date: "2026-10-20", hour: 16 }] })] }, prefs, at("09:45"));
    expect(m!.body).toBe("지난번 오후 4시엔 부재였던 새봄유통, 오전 10시에 다시 걸어 볼까요?");
  });
  it("only for 부재 due today, not already called today, with a past absence", () => {
    expect(dueReminders({ leads: [lead({ next: "2026-10-28" })] }, prefs, at("14:45"))).toEqual([]);
    expect(dueReminders({ leads: [lead({ result: "재통화" } as Partial<DbSheetLead>)] }, prefs, at("14:45"))).toEqual([]);
    expect(dueReminders({ leads: [lead({ followUp: { generation: 2, completedGeneration: 2, lastContactDate: DAY } })] }, prefs, at("14:45"))).toEqual([]);
    expect(dueReminders({ leads: [lead({ absences: [] })] }, prefs, at("14:45"))).toEqual([]);
  });
});

it("respects per-kind switches", () => {
  expect(dueReminders({ meetings: [meeting()] }, { ...prefs, reminderKinds: ["todo_before"] }, at("13:00"))).toEqual([]);
});
