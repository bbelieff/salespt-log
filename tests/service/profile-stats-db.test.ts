/**
 * BBE-64 — `traineeFunnelStatsFromDbRows` 순수 함수 단위 테스트.
 * `readProfileBundle.sumFunnelDataRows`(01 영업관리!E~N 8주 블록) 의 DB 재현이 실제
 * 수식 설치 코드(lib/repo/setup-formulas.ts L/N)와 같은 결과를 내는지 고정한다.
 * ⚠️ "계약" = 상태(J)="계약" 카운트다 — 계약여부(K) 아님(meeting.ts:79 "동기화용 호환 필드"
 * 주석·setup-formulas.ts N 열 수식 실측으로 확정). 이 파일이 그 규칙을 고정한다.
 */
import { describe, expect, it } from "vitest";
import type { Meeting } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import { STATS_WEEKS } from "@/config/cohort-dates"; // 리터럴 금지(period-hardcode G3)
import { traineeFunnelStatsFromDbRows } from "@/service/profile-stats-db";

const CS = new Date(2026, 5, 1); // courseStart 2026-06-01 (로컬 자정, 월요일)

function sales(date: string, mr: number): DbSalesRow {
  return { date, channel: "매입DB", production: 0, inflow: 0, contactProgress: 0, meetingReservation: mr };
}
function mtg(partial: Partial<Meeting>): Meeting {
  return {
    id: partial.id ?? "m", 예약일: "", 예약시각: "", 미팅날짜: partial.미팅날짜 ?? "",
    미팅시간: "", channel: partial.channel ?? "매입DB", 업체명: "업체", 장소: "서울",
    예약비고: "", 상태: partial.상태 ?? "예약", 계약여부: partial.계약여부 ?? false,
    수임비: 0, 미팅사유: "", 계약조건: "", 구분: partial.구분,
  } as Meeting;
}

describe("traineeFunnelStatsFromDbRows — 미팅예정(sales)", () => {
  it("1~8주차 창 안의 meetingReservation 만 합산", () => {
    const rows = [sales("2026-06-01", 3), sales("2026-06-05", 2)]; // week1
    const stats = traineeFunnelStatsFromDbRows(rows, [], CS);
    expect(stats.미팅예정).toBe(5);
  });

  it("9주차 이후(무제한 CRM 유예)는 8주 통계에서 제외", () => {
    const rows = [sales("2026-06-01", 3), sales("2026-08-20", 99)]; // week1, week11+
    const stats = traineeFunnelStatsFromDbRows(rows, [], CS);
    expect(stats.미팅예정).toBe(3);
  });

  it("courseStart 이전(week 0) 은 제외", () => {
    const rows = [sales("2026-05-01", 10)];
    expect(traineeFunnelStatsFromDbRows(rows, [], CS).미팅예정).toBe(0);
  });
});

describe("traineeFunnelStatsFromDbRows — 미팅완료(상태∈{완료,계약})", () => {
  it("완료·계약 상태만 카운트, 예약·변경·취소는 제외", () => {
    const meetings = [
      mtg({ 미팅날짜: "2026-06-02", 상태: "완료" }),
      mtg({ 미팅날짜: "2026-06-03", 상태: "계약" }),
      mtg({ 미팅날짜: "2026-06-04", 상태: "예약" }),
      mtg({ 미팅날짜: "2026-06-05", 상태: "변경" }),
      mtg({ 미팅날짜: "2026-06-06", 상태: "취소" }),
    ];
    expect(traineeFunnelStatsFromDbRows([], meetings, CS).미팅완료).toBe(2);
  });
});

describe("traineeFunnelStatsFromDbRows — 계약(상태==='계약', 계약여부 아님)", () => {
  it("상태='계약'만 카운트한다 — 계약여부=true 라도 상태가 '완료'면 제외", () => {
    const meetings = [
      mtg({ 미팅날짜: "2026-06-02", 상태: "계약", 계약여부: true }),
      // 계약여부만 true 이고 상태는 완료인 (사후 갱신 누락 등) 케이스 — N 열 수식은 J 만 본다.
      mtg({ 미팅날짜: "2026-06-03", 상태: "완료", 계약여부: true }),
    ];
    const stats = traineeFunnelStatsFromDbRows([], meetings, CS);
    expect(stats.계약).toBe(1);
    expect(stats.미팅완료).toBe(2); // 완료 판정은 여전히 둘 다 포함
  });
});

describe("traineeFunnelStatsFromDbRows — 이월(구분='이월') 제외 (AO<>이월 가드)", () => {
  it("이월 미팅은 상태·날짜가 맞아도 미팅완료·계약 모두 제외", () => {
    const meetings = [
      mtg({ 미팅날짜: "2026-06-02", 상태: "계약", 구분: "이월" }),
      mtg({ 미팅날짜: "2026-06-03", 상태: "완료", 구분: "이월" }),
    ];
    const stats = traineeFunnelStatsFromDbRows([], meetings, CS);
    expect(stats).toEqual({ 미팅예정: 0, 미팅완료: 0, 계약: 0 });
  });

  it("native(구분 미설정) 미팅은 그대로 카운트 — 이월 필터가 정상 미팅까지 지우지 않는다", () => {
    const meetings = [mtg({ 미팅날짜: "2026-06-02", 상태: "계약" })];
    expect(traineeFunnelStatsFromDbRows([], meetings, CS).계약).toBe(1);
  });
});

describe("traineeFunnelStatsFromDbRows — 창 경계·빈 입력", () => {
  it("빈 salesRows/meetings → 전부 0", () => {
    expect(traineeFunnelStatsFromDbRows([], [], CS)).toEqual({ 미팅예정: 0, 미팅완료: 0, 계약: 0 });
  });

  it("날짜 파싱 불가(빈 문자열) 미팅은 fail-closed 로 제외", () => {
    const meetings = [mtg({ 미팅날짜: "", 상태: "계약" })];
    expect(traineeFunnelStatsFromDbRows([], meetings, CS).계약).toBe(0);
  });

  it(`정확히 ${STATS_WEEKS}주차 마지막 날은 포함, 그 다음 주는 제외 (경계값)`, () => {
    // week STATS_WEEKS 마지막 날 = courseStart + (STATS_WEEKS*7 - 1)일.
    // toISOString()(UTC) 대신 로컬 자정 기준 수동 포맷 — TZ 무관하게 재현.
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const lastDayOfWindow = new Date(CS);
    lastDayOfWindow.setDate(CS.getDate() + STATS_WEEKS * 7 - 1);
    const firstDayAfterWindow = new Date(CS);
    firstDayAfterWindow.setDate(CS.getDate() + STATS_WEEKS * 7);
    const meetings = [
      mtg({ 미팅날짜: iso(lastDayOfWindow), 상태: "계약" }),
      mtg({ 미팅날짜: iso(firstDayAfterWindow), 상태: "계약" }),
    ];
    expect(traineeFunnelStatsFromDbRows([], meetings, CS).계약).toBe(1);
  });
});
