import { describe, expect, it } from "vitest";
import {
  buildRecontactLeads,
  buildStalledWork,
  buildTodoFollowUps,
  buildUnresultedMeetings,
  followUpHeadline,
  meetingLookbackMonths,
  summarizeFollowUps,
  type FollowUpCounts,
} from "@/lib/analytics/dashboard-follow-ups";
import { TODAY, contract, lead, meeting, slot, todo } from "./follow-ups-factories";

const counts = (over: Partial<FollowUpCounts> = {}): FollowUpCounts =>
  ({ overdue: 0, today: 0, meeting: 0, recontact: 0, stalled: 0, upcoming: 0, ...over });

describe("오늘 챙길 일 — 할 일", () => {
  const cp = contract({ 수납1: slot({ 진행기관: "신용보증기금" }) });

  it("오늘보다 이른 날은 밀림(D+NN), 오늘은 '오늘', 1~7일 뒤는 보조(D-NN), 8일 뒤는 뺀다", () => {
    const out = buildTodoFollowUps([
      todo({ id: "a", 예정일자: "2026-10-11" }), todo({ id: "b", 예정일자: TODAY }),
      todo({ id: "c", 예정일자: "2026-10-19" }), todo({ id: "d", 예정일자: "2026-10-20" }),
    ], [cp], TODAY);
    expect(out.overdue.map((i) => [i.key, i.badge])).toEqual([["todo:a", "D+01"]]);
    expect(out.today.map((i) => [i.key, i.badge])).toEqual([["todo:b", "오늘"]]);
    expect(out.upcoming.map((i) => [i.key, i.badge])).toEqual([["todo:c", "D-07"]]);
  });

  it("일반 이벤트·History·완료·날짜가 비었거나 틀린 할 일은 나오지 않는다", () => {
    const out = buildTodoFollowUps([
      todo({ type: "일반", 예정일자: "2026-10-01" }), todo({ 기록종류: "history", 예정일자: "2026-10-01" }),
      todo({ 완료여부: true, 예정일자: "2026-10-01" }), todo({ 예정일자: "" }), todo({ 예정일자: "2026-02-30" }),
    ], [cp], TODAY);
    expect([out.overdue, out.today, out.upcoming].flat()).toEqual([]);
    expect(out.unlinked).toBe(0);
  });

  it("해지·숨김 계약의 할 일은 빼고, 계약을 못 찾은 할 일은 칩에서 빼고 따로 센다", () => {
    const out = buildTodoFollowUps([
      todo({ contractRef: "2026-08-01|샘플 별빛식품", 예정일자: "2026-10-01" }),
      todo({ contractRef: "2026-08-02|샘플 은하상사", 예정일자: "2026-10-01" }),
      todo({ contractRef: "2026-07-01|샘플 옛이름상사", 예정일자: "2026-10-01" }),
    ], [
      contract({ row: 7, 계약일: "2026-08-01", 업체명: "샘플 별빛식품", 해지일: "2026-09-20" }),
      contract({ row: 8, 계약일: "2026-08-02", 업체명: "샘플 은하상사", 해지숨김: true }),
    ], TODAY);
    expect(out.overdue).toEqual([]);
    expect(out.unlinked).toBe(1);
  });

  it("기관명 앞뒤 공백이 달라도 맞는 진행으로 보내고, 맞는 기관이 없으면 데이터 있는 첫 진행으로 보낸다", () => {
    const two = contract({ row: 4, 수납1: slot({ 진행기관: "신용보증기금" }), 수납2: slot({ 진행기관: " 소진공 " }) });
    const out = buildTodoFollowUps([
      todo({ id: "x/1", institutionRef: "소진공", 예정일자: "2026-10-01" }),
      todo({ id: "y", institutionRef: "기술보증기금", 예정일자: "2026-10-02" }),
    ], [two], TODAY);
    expect(out.overdue.map((i) => i.href)).toEqual([
      "/payment?row=4&slot=2&focus=x%2F1",
      "/payment?row=4&slot=1&focus=y",
    ]);
    expect(out.overdue[0]!.detail).toBe("서류 확인 · 소진공");
  });

  it("날짜 → 시각 순으로 정렬하고 시각이 빈 할 일은 그날의 맨 뒤에 둔다", () => {
    const out = buildTodoFollowUps([
      todo({ id: "late", 예정일자: "2026-10-05", 예정시각: "" }),
      todo({ id: "pm", 예정일자: "2026-10-05", 예정시각: "15:00" }),
      todo({ id: "am", 예정일자: "2026-10-05", 예정시각: "09:00" }),
      todo({ id: "early", 예정일자: "2026-10-01", 예정시각: "" }),
    ], [cp], TODAY);
    expect(out.overdue.map((i) => i.key)).toEqual(["todo:early", "todo:am", "todo:pm", "todo:late"]);
  });
});

describe("오늘 챙길 일 — 결과 안 적은 미팅", () => {
  it("상태 '예약'이고 오늘−30 ~ 어제 미팅만, 변경·완료·계약·취소·오늘·31일 전은 뺀다", () => {
    const out = buildUnresultedMeetings([
      meeting({ id: "in30", 미팅날짜: "2026-09-12" }), meeting({ id: "out31", 미팅날짜: "2026-09-11" }),
      meeting({ id: "yday", 미팅날짜: "2026-10-11", 업체명: "(변경) 샘플 나래공업" }), meeting({ id: "today", 미팅날짜: TODAY }),
      ...(["변경", "완료", "계약", "취소"] as const).map((상태) => meeting({ 상태, 미팅날짜: "2026-10-05" })),
    ], TODAY);
    expect(out.map((i) => i.key)).toEqual(["meeting:in30", "meeting:yday"]);
    expect(out[1]).toMatchObject({ title: "샘플 나래공업", badge: "D+01", href: "/schedule?date=2026-10-11&focus=yday" });
    expect(out[0]!.detail).toBe("9/12(토) 14:00 · 가상 카페");
  });

  it("두 달 응답에 같은 미팅이 있으면 한 번만 센다", () => {
    const m = meeting({ id: "dup", 미팅날짜: "2026-10-01" });
    expect(buildUnresultedMeetings([m, { ...m }], TODAY)).toHaveLength(1);
  });

  it("조회할 달: 월 중순 2개 · 31일 달 말일 1개 · 비윤년 3월 2일 3개 · 1월 초는 전년 12월 포함", () => {
    expect(meetingLookbackMonths("2026-10-12")).toEqual(["2026-09", "2026-10"]);
    expect(meetingLookbackMonths("2026-10-31")).toEqual(["2026-10"]);
    expect(meetingLookbackMonths("2026-03-02")).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(meetingLookbackMonths("2026-01-05")).toEqual(["2025-12", "2026-01"]);
  });
});

describe("오늘 챙길 일 — 다시 연락할 DB", () => {
  it("결과 4종이고 다음 연락일이 오늘 이전·오늘인 업체만, 다음 연락일 순", () => {
    const out = buildRecontactLeads([
      lead({ id: "t", result: "부재", next: TODAY }), lead({ id: "p", result: "재통화", next: "2026-10-09" }),
      lead({ result: "컨택진행", next: "2026-10-01" }), lead({ result: "미컨택", next: "2026-10-01" }),
      lead({ result: "부재", next: "" }), lead({ result: "단순거절", next: "2026-10-15" }),
      lead({ id: "s", result: "상담 후 거절", next: "2026-10-10" }),
    ], TODAY);
    expect(out.map((i) => [i.key, i.badge])).toEqual([["lead:p", "D+03"], ["lead:s", "D+02"], ["lead:t", "오늘"]]);
    expect(out[0]).toMatchObject({ detail: "재통화 · 매입DB", href: "/db-sheet?lead=p" });
  });

  it("다음 연락일 이후에 상담 기록이 있으면(이미 다시 연락함) 뺀다", () => {
    const contact = (date: string) => ({ ...lead().contact, date });
    expect(buildRecontactLeads([lead({ next: "2026-10-09", contact: contact("2026-10-09") })], TODAY)).toEqual([]);
    expect(buildRecontactLeads([lead({ next: "2026-10-09", contact: contact("2026-10-08") })], TODAY)).toHaveLength(1);
  });

  it("전화번호를 화면 문구에 넣지 않는다", () => {
    const [item] = buildRecontactLeads([lead({ phone: "010-0000-0000", next: TODAY })], TODAY);
    expect(JSON.stringify(item)).not.toContain("010-0000-0000");
  });
});

describe("오늘 챙길 일 — 멈춘 업체(다음 할 일 없음)", () => {
  const base = { 계약일: "2026-09-01", 업체명: "샘플상사", 수납1: slot({ 진행기관: "신용보증기금", 메모: "통화" }) };
  const history = (date: string, institutionRef = "신용보증기금") => todo({ 기록종류: "history", 예정일자: date, institutionRef });

  it("미완료 할 일이 있는 진행은 멈춤이 아니다", () => {
    expect(buildStalledWork([contract(base)], [history("2026-09-20"), todo({ institutionRef: "신용보증기금 ", 예정일자: "2026-10-20" })], TODAY)).toEqual([]);
  });

  it("마지막 일정이 7일 전이면 포함, 6일 전이면 뺀다", () => {
    expect(buildStalledWork([contract(base)], [history("2026-10-05")], TODAY)[0]).toMatchObject({
      badge: "7일째", detail: "진행 1 · 신용보증기금 · 마지막 일정 10/5", href: "/payment?row=3&slot=1",
    });
    expect(buildStalledWork([contract(base)], [history("2026-10-06")], TODAY)).toEqual([]);
  });

  it("완료한 할 일도 마지막 일정으로 센다(미래 예정일은 오늘로 자른다)", () => {
    const done = (예정일자: string) => todo({ 완료여부: true, 예정일자, institutionRef: "신용보증기금" });
    expect(buildStalledWork([contract(base)], [history("2026-09-01"), done("2026-10-30")], TODAY)).toEqual([]);
    expect(buildStalledWork([contract(base)], [done("2026-10-02")], TODAY)[0]!.badge).toBe("10일째");
  });

  it("기록이 없으면 계약일 기준 — 10일 지났으면 포함, 3일이면 뺀다", () => {
    expect(buildStalledWork([contract({ 계약일: "2026-10-02" })], [], TODAY)[0]).toMatchObject({ badge: "계약 후 10일", detail: "진행 1 · 기관 미정 · 아직 일정 없음" });
    expect(buildStalledWork([contract({ 계약일: "2026-10-09" })], [], TODAY)).toEqual([]);
  });

  it("승인·수납대기·수납완료, 해지·숨김, 계약일 빈칸은 빼고 이월은 넣는다", () => {
    const old = { 계약일: "2026-08-01" };
    const rows = [
      contract({ ...old, row: 3, 수납1: slot({ 승인금액: 30_000_000 }) }),
      contract({ ...old, row: 4, 수납1: slot({ 승인금액: 1, 수납일: "2026-10-30" }) }),
      contract({ ...old, row: 5, 수납1: slot({ 수납액: 1 }) }),
      contract({ ...old, row: 6, 해지일: "2026-09-01" }),
      contract({ ...old, row: 7, 해지숨김: true }),
      contract({ row: 8, 계약일: "" }),
      contract({ ...old, row: 9, 구분: "이월", 업체명: "샘플 이월상사" }),
    ];
    expect(buildStalledWork(rows, [], TODAY).map((i) => i.title)).toEqual(["샘플 이월상사"]);
  });

  it("업체 단위로 한 줄 — 가장 오래 멈춘 진행으로 연결하고 멈춘 진행 수를 덧붙인다, 오래된 순", () => {
    const two = contract({ row: 4, 업체명: "샘플 두진행", 계약일: "2026-08-01",
      수납1: slot({ 진행기관: "신용보증기금", 메모: "a" }), 수납2: slot({ 진행기관: "소진공", 메모: "b" }) });
    const out = buildStalledWork([contract(base), two], [
      history("2026-10-01"),
      todo({ contractRef: "2026-08-01|샘플 두진행", 기록종류: "history", institutionRef: "신용보증기금", 예정일자: "2026-09-30" }),
      todo({ contractRef: "2026-08-01|샘플 두진행", 기록종류: "history", institutionRef: "소진공", 예정일자: "2026-09-20" }),
    ], TODAY);
    expect(out.map((i) => [i.title, i.badge, i.href])).toEqual([
      ["샘플 두진행", "22일째", "/payment?row=4&slot=2"],
      ["샘플상사", "11일째", "/payment?row=3&slot=1"],
    ]);
    expect(out[0]!.detail).toContain("멈춘 진행 2건");
  });

  it("어느 진행과도 기관명이 맞지 않는 미완료 할 일이 있는 계약은 뺀다(칩 겹침 방지)", () => {
    expect(buildStalledWork([contract(base)], [todo({ institutionRef: "기술보증기금", 예정일자: "2026-10-01" })], TODAY)).toEqual([]);
  });
});

describe("오늘 챙길 일 — 총건수·한 줄 문구", () => {
  it("우선순위: 밀림 > 미팅 > 오늘 > 다시 연락 > 멈춤, 0건이면 칭찬 문구", () => {
    expect(followUpHeadline(counts({ overdue: 2, meeting: 1, today: 1 }))).toBe("밀린 할 일 2건부터 정리해요");
    expect(followUpHeadline(counts({ meeting: 2, today: 1 }))).toBe("지난 미팅 2건 결과를 적어 주세요");
    expect(followUpHeadline(counts({ today: 1, recontact: 3 }))).toBe("오늘 할 일 1건, 하나씩 끝내 봐요");
    expect(followUpHeadline(counts({ recontact: 3, stalled: 1 }))).toBe("다시 연락할 DB가 3곳 있어요");
    expect(followUpHeadline(counts({ stalled: 4 }))).toBe("4곳이 7일 이상 다음 할 일 없이 멈춰 있어요");
    expect(followUpHeadline(counts({ upcoming: 5 }))).toBe("오늘 챙길 일이 없어요 👏");
  });

  it("총건수는 7일 안 할 일을 빼고, 받지 못한 조회는 그 종류만 비운다", () => {
    const summary = summarizeFollowUps({
      contracts: [contract({ 수납1: slot({ 진행기관: "신용보증기금" }) })],
      todos: [todo({ 예정일자: "2026-10-11" }), todo({ 예정일자: "2026-10-14" })],
      meetings: undefined,
      leads: [lead({ next: TODAY })],
    }, TODAY);
    expect(summary.counts).toMatchObject({ overdue: 1, upcoming: 1, meeting: 0, recontact: 1 });
    expect(summary.total).toBe(2);
  });
});
