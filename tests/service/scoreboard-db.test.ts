/**
 * BBE-63(R7 Phase 3 #14) — 전광판 주차별 5지표 DB 재현 순수함수 단위 대조.
 * ⚠️ dashboard-aggregates.test.ts 헤더와 동일 원칙: 여기 테스트는 "설계대로 구현됐는지"만
 * 고정한다. 대시보드 C33:H40 자체와의 라이브 시트 일치는 scripts/ops/scoreboard-parity.mjs
 * (VPS 실행)로 확정한다 — 미팅=완료 정의는 setup-formulas.ts 01!L 수식 실측에 근거하나
 * 대시보드 셀 자체의 수식 문자열은 코드로 미확인(§0.8 Report: 미확정, PR 설명 참고).
 */
import { describe, expect, it } from "vitest";
import type { Meeting } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import { weeklyPerfFromDb } from "@/service/scoreboard-db";

const CS = new Date(2026, 5, 1); // courseStart 2026-06-01 (로컬 자정), dashboard-aggregates.test.ts 와 동일 픽스처

function sales(date: string, channel: string, p: number, i: number, c: number): DbSalesRow {
  return { date, channel, production: p, inflow: i, contactProgress: c, meetingReservation: 0 };
}
function mtg(partial: Partial<Meeting>): Meeting {
  return {
    id: partial.id ?? "m", 예약일: "", 예약시각: "", 미팅날짜: partial.미팅날짜 ?? "",
    미팅시간: "", channel: partial.channel ?? "매입DB", 업체명: "업체", 장소: "서울",
    예약비고: "", 상태: partial.상태 ?? "예약", 계약여부: partial.계약여부 ?? false,
    수임비: 0, 미팅사유: "", 구분: partial.구분,
  } as Meeting;
}

describe("weeklyPerfFromDb", () => {
  it("생산/유입/컨택 = salesRows 주차 블록 합(채널 무관)", () => {
    const rows = [
      sales("2026-06-02", "매입DB", 10, 5, 4), // 1주차
      sales("2026-06-03", "현수막", 3, 1, 1), // 1주차 — 채널 달라도 합산
      sales("2026-06-09", "매입DB", 2, 2, 2), // 2주차
    ];
    const weeks = weeklyPerfFromDb(rows, [], CS);
    expect(weeks[0]).toMatchObject({ week: 1, 생산: 13, 유입: 6, 컨택: 5 });
    expect(weeks[1]).toMatchObject({ week: 2, 생산: 2, 유입: 2, 컨택: 2 });
  });

  it("미팅 = 상태∈{완료,계약}만 카운트 — '예약'은 제외", () => {
    const IN = "2026-06-10"; // 2주차
    const meetings = [
      mtg({ 상태: "예약", 미팅날짜: IN }),
      mtg({ 상태: "완료", 미팅날짜: IN }),
      mtg({ 상태: "계약", 계약여부: true, 미팅날짜: IN }),
      mtg({ 상태: "변경", 미팅날짜: IN }),
      mtg({ 상태: "취소", 미팅날짜: IN }),
    ];
    const weeks = weeklyPerfFromDb([], meetings, CS);
    expect(weeks[1]!.미팅).toBe(2); // 완료 + 계약만
  });

  it("계약 = 상태==='계약' (계약여부 불리언 아님) — setup-formulas.ts N열 수식 그대로", () => {
    const IN = "2026-06-10";
    const meetings = [
      mtg({ 상태: "완료", 계약여부: true, 미팅날짜: IN }), // 계약여부=true 지만 상태≠계약 → 미포함
      mtg({ 상태: "계약", 계약여부: false, 미팅날짜: IN }), // 상태=계약 이면 계약여부 무관 → 포함
    ];
    const weeks = weeklyPerfFromDb([], meetings, CS);
    expect(weeks[1]!.계약).toBe(1);
    expect(weeks[1]!.미팅).toBe(2); // 둘 다 DONE(완료∪계약)
  });

  it("이월(구분='이월') 미팅은 미팅·계약 양쪽에서 제외", () => {
    const IN = "2026-06-10";
    const meetings = [
      mtg({ 상태: "계약", 미팅날짜: IN, 구분: "이월" }),
      mtg({ 상태: "완료", 미팅날짜: IN, 구분: "이월" }),
    ];
    const weeks = weeklyPerfFromDb([], meetings, CS);
    expect(weeks[1]).toMatchObject({ 미팅: 0, 계약: 0 });
  });

  it("주차 창(1~8) 밖 — 시작 전·9주차+는 자연 제외(배열 경계)", () => {
    const before = "2026-05-20"; // courseStart 이전 → week 0
    const after = "2026-08-20"; // 9주차+
    const rows = [sales(before, "매입DB", 100, 0, 0), sales(after, "매입DB", 100, 0, 0)];
    const meetings = [mtg({ 상태: "계약", 미팅날짜: before }), mtg({ 상태: "계약", 미팅날짜: after })];
    const weeks = weeklyPerfFromDb(rows, meetings, CS);
    expect(weeks).toHaveLength(8);
    const totalProd = weeks.reduce((s, w) => s + w.생산, 0);
    const totalContract = weeks.reduce((s, w) => s + w.계약, 0);
    expect(totalProd).toBe(0); // 창 밖 salesRows 는 어느 주차에도 안 들어감
    expect(totalContract).toBe(0);
  });

  it("날짜 파싱 불가 행은 fail-closed 제외", () => {
    const rows = [sales("", "매입DB", 5, 5, 5), sales("bad-date", "매입DB", 5, 5, 5)];
    const meetings = [mtg({ 상태: "계약", 미팅날짜: "" })];
    const weeks = weeklyPerfFromDb(rows, meetings, CS);
    expect(weeks.every((w) => w.생산 === 0 && w.계약 === 0)).toBe(true);
  });
});
