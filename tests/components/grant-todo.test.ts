/** 맞춤공고 「할 일로 담기」(2026-10-26 4b) — 업체 단위 공고 할 일. 합성 데이터만. */
import { describe, expect, it } from "vitest";
import { buildStalledWork, buildTodoFollowUps } from "@/lib/analytics/dashboard-follow-ups";
import { grantIdOfTodo, isGrantTodo, todoSlotOf } from "@/lib/analytics/todo-slot";
import { grantTodoDue, withoutTaken, type GrantMatchesResponse } from "@/lib/analytics/grant-match";
import { TODAY, contract, slot, todo } from "./follow-ups-factories";

const grantTodo = (o = {}) => todo({ id: "g", institutionRef: "", 분류: "공고:P1", 제목: "가상 자금 신청 준비", ...o });

describe("공고 할 일", () => {
  it("진행건 미지정이 정상 — 「진행건 확인 필요」에 걸지 않는다", () => {
    const cp = contract({ 수납1: slot({ 진행기관: "기관A" }) });
    expect(isGrantTodo(grantTodo())).toBe(true);
    expect(grantIdOfTodo(grantTodo())).toBe("P1");
    expect(todoSlotOf(cp, grantTodo())).toEqual({ slot: null, ambiguous: false });
    const [item] = buildTodoFollowUps([grantTodo()], [cp], TODAY).today;
    expect(item).toMatchObject({ reasons: ["공고 신청 준비"], href: "/payment?row=3" });
    expect(item?.reasons).not.toContain("연결 진행건 확인 필요");
  });
  it("진행건 「다음 할 일 없음」은 바꾸지 않는다(진행건 상태와 무관)", () => {
    const cp = contract({ 수납1: slot({ 진행기관: "기관A" }) });
    expect(buildStalledWork([cp], [grantTodo()], TODAY)).toEqual(buildStalledWork([cp], [], TODAY));
  });
  it("담기 날짜: 마감 3일 전, 지났거나 없으면 내일", () => {
    expect(grantTodoDue("2026-11-20", "2026-10-26")).toBe("2026-11-17");
    expect(grantTodoDue("2026-10-28", "2026-10-26")).toBe("2026-10-27");
    expect(grantTodoDue("", "2026-10-26")).toBe("2026-10-27");
  });
  it("담은 공고는 칩 숫자에서 빠진다", () => {
    const res: GrantMatchesResponse = { unavailable: false, announcements: {}, companies: { "2026-10-01|가": { hasInfo: true, noRegion: false, matches: [{ id: "P1", verdict: "match", reasons: [], urgent: false }, { id: "P2", verdict: "check", reasons: ["x"], urgent: false }] } } };
    expect(withoutTaken(res, new Map([["2026-10-01|가", new Set(["P1"])]]))!.companies["2026-10-01|가"]!.matches.map((m) => m.id)).toEqual(["P2"]);
    expect(withoutTaken(res, new Map())).toBe(res);
  });
});
