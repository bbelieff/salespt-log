import { describe, expect, it } from "vitest";
import { ContractPayment, type Meeting } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import { weeklyGoalActuals } from "@/service/weekly-goals-actuals";

const start = "2026-09-04", end = "2026-09-10";
const sales = (over: Partial<DbSalesRow> = {}): DbSalesRow => ({ date: start, channel: "직접생산", production: 2, inflow: 3, contactProgress: 4, meetingReservation: 999, ...over });
const meeting = (over: Partial<Meeting> = {}): Meeting => ({ id: "fixture-meeting", 예약일: start, 예약시각: "10:00", 미팅날짜: start, 미팅시간: "10:00", channel: "직접생산", 업체명: "Fixture Company", 장소: "", 예약비고: "", 상태: "계약", 계약여부: true, 수임비: 1000, 미팅사유: "", 계약조건: "", ...over } as Meeting);
const payment = (over: Partial<ContractPayment> = {}) => ContractPayment.parse({ 계약일: start, 업체명: "Fixture Company", 수임비: 1000, ...over });

describe("weekly goal actuals from current raw records", () => {
  it("includes both week boundaries and excludes neighboring or invalid dates and unknown channels", () => {
    const rows = [sales(), sales({ date: end }), sales({ date: "2026-09-03" }), sales({ date: "2026-09-11" }), sales({ date: "2026-02-31" }), sales({ channel: "invalid" })];
    expect(weeklyGoalActuals(rows, [], [], start, end)).toEqual({ production: 4, inflow: 6, contacts: 8, meetings: 0, contracts: 0 });
  });
  it("counts completed meetings from status, excludes carryover, and never uses reservation totals", () => {
    const rows = [meeting({ 상태: "완료" }), meeting(), meeting({ 상태: "예약" }), meeting({ 상태: "취소" }), meeting({ 구분: "이월" })];
    expect(weeklyGoalActuals([sales()], rows, [], start, end)).toMatchObject({ meetings: 2, contracts: 2 });
  });
  it("preserves historical contract metric using status instead of the separate checkbox", () => {
    expect(weeklyGoalActuals([], [meeting({ 계약여부: false }), meeting({ 상태: "완료", 계약여부: true })], [], start, end).contracts).toBe(1);
  });
  it("subtracts termination in its original contract week even if terminated later", () => {
    expect(weeklyGoalActuals([], [meeting(), meeting({ id: "second" })], [payment({ 해지일: "2026-10-01" })], start, end).contracts).toBe(1);
  });
  it("does not subtract contracts from another week and clamps over-subtraction at zero", () => {
    expect(weeklyGoalActuals([], [meeting()], [payment({ 계약일: "2026-09-03", 해지일: end })], start, end).contracts).toBe(1);
    expect(weeklyGoalActuals([], [], [payment({ 해지일: end })], start, end).contracts).toBe(0);
  });
  it("reflects corrected and deleted rows on the next aggregation without mutating source records", () => {
    const original = [sales()];
    const snapshot = structuredClone(original);
    expect(weeklyGoalActuals(original, [meeting()], [], start, end)).toMatchObject({ production: 2, meetings: 1, contracts: 1 });
    expect(weeklyGoalActuals([sales({ production: 0, contactProgress: 1 })], [meeting({ 상태: "취소" })], [], start, end)).toMatchObject({ production: 0, contacts: 1, meetings: 0, contracts: 0 });
    expect(weeklyGoalActuals([], [], [], start, end)).toEqual({ production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 });
    expect(original).toEqual(snapshot);
  });
});
