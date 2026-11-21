/** gcal-import — 구글 일정 → 일반 일정 가져오기 판단(순수). 가상 데이터만. */
import { describe, expect, it } from "vitest";
import {
  importTodoId,
  planGcalImport,
  plainText,
  remoteToFields,
  toSeoulDateTime,
} from "@/service/gcal-import-plan";
import { todoToInput } from "@/service/gcal-sync";
import type { GcalRemoteEvent } from "@/repo/gcal-client";
import type { Todo } from "@/types";

const ev = (o: Partial<GcalRemoteEvent>): GcalRemoteEvent => ({
  id: "e1",
  status: "confirmed",
  updated: "2026-11-20T01:00:00.000Z",
  summary: "치과 예약",
  location: "",
  description: "",
  start: { dateTime: "2026-11-21T14:30:00+09:00" },
  salesptId: "",
  ...o,
});

const imported = (eventId: string, updated: string, o: Partial<Todo> = {}): Todo =>
  ({
    id: `t-${eventId}`,
    contractRef: "",
    institutionRef: "",
    업체명: "",
    type: "일반",
    제목: "치과 예약",
    예정일자: "2026-11-21",
    예정시각: "14:30",
    장소: "",
    상세: "",
    showOnCalendar: true,
    완료여부: false,
    생성시각: "",
    분류: "기타",
    기록종류: "todo",
    slot: null,
    result: "",
    prevId: "",
    gcalSource: { eventId, updated },
    ...o,
  }) as Todo;

describe("remoteToFields — 날짜·시각은 서울 기준", () => {
  it("시각 일정은 서울 시각으로 바꾼다(다른 시간대 오프셋 포함)", () => {
    expect(toSeoulDateTime("2026-11-21T05:30:00Z")).toEqual({ date: "2026-11-21", time: "14:30" });
    expect(toSeoulDateTime("2026-11-21T20:00:00Z")).toEqual({ date: "2026-11-22", time: "05:00" });
  });
  it("종일 일정은 날짜만, 시각은 빈칸", () => {
    expect(remoteToFields(ev({ start: { date: "2026-11-25" } }))).toMatchObject({ 예정일자: "2026-11-25", 예정시각: "" });
  });
  it("제목이 없으면 (제목 없음), 날짜를 못 읽으면 가져오지 않음", () => {
    expect(remoteToFields(ev({ summary: "  " }))?.제목).toBe("(제목 없음)");
    expect(remoteToFields(ev({ start: {} }))).toBeNull();
    expect(remoteToFields(ev({ start: { dateTime: "엉터리" } }))).toBeNull();
  });
  it("구글 메모의 HTML 은 글자만 남긴다", () => {
    expect(plainText("첫 줄<br>둘째 &amp; 셋째<b>굵게</b>")).toBe("첫 줄\n둘째 & 셋째굵게");
  });
});

describe("planGcalImport", () => {
  it("처음 보는 구글 일정은 새로 만든다", () => {
    const a = planGcalImport([ev({})], []);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "create", fields: { 제목: "치과 예약", 예정일자: "2026-11-21", 예정시각: "14:30" } });
  });
  it("앱이 올린 일정(salesptId)은 건너뛴다 — 중복 방지", () => {
    expect(planGcalImport([ev({ salesptId: "meeting-123" })], [])).toEqual([]);
  });
  it("이미 가져온 일정은 구글에서 안 바뀌었으면 그대로", () => {
    expect(planGcalImport([ev({})], [imported("e1", "2026-11-20T01:00:00.000Z")])).toEqual([]);
  });
  it("구글에서 고쳤으면 고친 값으로 맞춘다", () => {
    const a = planGcalImport(
      [ev({ updated: "2026-11-20T09:00:00.000Z", start: { dateTime: "2026-11-22T10:00:00+09:00" } })],
      [imported("e1", "2026-11-20T01:00:00.000Z")],
    );
    expect(a[0]).toMatchObject({ kind: "update", fields: { 예정일자: "2026-11-22", 예정시각: "10:00" } });
  });
  it("구글에서 취소한 일정은 가져온 것을 지우고, 안 가져온 취소 일정은 무시", () => {
    const t = imported("e1", "x");
    expect(planGcalImport([ev({ status: "cancelled" })], [t])).toEqual([{ kind: "remove", todo: t }]);
    expect(planGcalImport([ev({ id: "e9", status: "cancelled" })], [])).toEqual([]);
  });
  it("같은 일정이 두 번 와도 한 번만 처리", () => {
    expect(planGcalImport([ev({}), ev({})], [])).toHaveLength(1);
  });
});

describe("importTodoId — 같은 구글 일정은 늘 같은 행 id", () => {
  it("UUID 모양이고 입력이 같으면 같다", () => {
    const a = importTodoId("a".repeat(40));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(importTodoId("a".repeat(40))).toBe(a);
    expect(importTodoId("b".repeat(40))).not.toBe(a);
  });
});

describe("가져온 일정은 구글로 다시 올리지 않는다", () => {
  it("gcalSource 있으면 todoToInput = null", () => {
    expect(todoToInput(imported("e1", "x"))).toBeNull();
    expect(todoToInput(imported("e1", "x", { gcalSource: undefined }))).not.toBeNull();
  });
});
