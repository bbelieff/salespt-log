/** gcal-2a 동기화 매핑 — 미팅/투두 → 구글 이벤트 shape·종일/시각·skip 조건 (google-calendar-sync §2). */
import { describe, expect, it } from "vitest";
import { meetingToInput, todoToInput } from "@/service/gcal-sync";
import type { Meeting, Todo } from "@/types";

const mkMeeting = (o: Partial<Meeting>): Meeting =>
  ({
    id: "m1",
    업체명: "가나상사",
    미팅날짜: "2026-07-15",
    미팅시간: "14:00",
    장소: "강남",
    미팅사유: "",
    예약비고: "",
    상태: "예약",
    ...o,
  }) as unknown as Meeting;

const mkTodo = (o: Partial<Todo>): Todo =>
  ({
    id: "t1",
    제목: "서류 준비",
    예정일자: "2026-07-15",
    예정시각: "10:00",
    장소: "",
    상세: "",
    type: "기타",
    showOnCalendar: true,
    ...o,
  }) as unknown as Todo;

describe("meetingToInput", () => {
  it("시각 이벤트 — 제목=업체명 맨앞, 시작+1시간, salesptId=id", () => {
    const e = meetingToInput(mkMeeting({}))!;
    expect(e.summary).toBe("가나상사 미팅");
    expect(e.allDay).toBe(false);
    expect(e.start).toBe("2026-07-15T14:00:00");
    expect(e.end).toBe("2026-07-15T15:00:00");
    expect(e.location).toBe("강남");
    expect(e.salesptId).toBe("m1");
  });

  it("자정 넘김 — end 날짜가 다음날로 롤오버(23:30→익일 00:30, end>start)", () => {
    const e = meetingToInput(mkMeeting({ 미팅시간: "23:30" }))!;
    expect(e.start).toBe("2026-07-15T23:30:00");
    expect(e.end).toBe("2026-07-16T00:30:00"); // 자정 넘으면 end.date=다음날(구글은 end<start 를 400 거부)
  });

  it("미팅시간 없으면 종일 이벤트(end=다음날 exclusive)", () => {
    const e = meetingToInput(mkMeeting({ 미팅시간: "" }))!;
    expect(e.allDay).toBe(true);
    expect(e.start).toBe("2026-07-15");
    expect(e.end).toBe("2026-07-16");
  });

  it("미팅날짜 없으면 대상 아님(null)", () => {
    expect(meetingToInput(mkMeeting({ 미팅날짜: "" }))).toBeNull();
  });

  it("설명 없으면 기본 문구", () => {
    expect(meetingToInput(mkMeeting({}))!.description).toBe("세일즈PT 경영일지");
    expect(meetingToInput(mkMeeting({ 미팅사유: "재방문" }))!.description).toBe("재방문");
  });
});

describe("todoToInput", () => {
  it("예정시각 있으면 시각 이벤트(+1h)", () => {
    const e = todoToInput(mkTodo({}))!;
    expect(e.summary).toBe("서류 준비");
    expect(e.allDay).toBe(false);
    expect(e.start).toBe("2026-07-15T10:00:00");
    expect(e.end).toBe("2026-07-15T11:00:00");
  });

  it("예정시각 없으면 종일(end=다음날)", () => {
    const e = todoToInput(mkTodo({ 예정시각: "" }))!;
    expect(e.allDay).toBe(true);
    expect(e.start).toBe("2026-07-15");
    expect(e.end).toBe("2026-07-16");
  });

  it("월말 종일 — 다음달로 exclusive end", () => {
    const e = todoToInput(mkTodo({ 예정일자: "2026-07-31", 예정시각: "" }))!;
    expect(e.end).toBe("2026-08-01");
  });

  it("예정일자 없으면 대상 아님(null)", () => {
    expect(todoToInput(mkTodo({ 예정일자: "" }))).toBeNull();
  });

  it("showOnCalendar=false 면 제외(null)", () => {
    expect(todoToInput(mkTodo({ showOnCalendar: false }))).toBeNull();
  });
});
