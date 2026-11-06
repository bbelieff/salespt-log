/** DB 시트 자동 확인 판단 규칙(2026-11-06 belie) — 시각 칸·지문·새 줄 고르기·저장 입력. 합성 데이터만. */
import { describe, expect, it } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";
import { FEED_MAX_ADD, feedFingerprint, feedInitialSeen, feedLeadInput, feedSlot, planFeedRun } from "@/lib/analytics/db-import/feed";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { contactDraft } from "@/app/(app)/db-sheet/_components/ContactPanel";

const kst = (hhmm: string) => new Date(`2026-11-06T${hhmm}:00+09:00`);
const SHEET = [
  "업체명,이름,연락처,접수일시,메모",
  "가상상회,김가상,010-0000-1001,2026-11-05 10:00:00,",
  "가상꽃집,이가상,01000001002,2026-11-05 11:00:00,오후 통화",
  "가상공방,박가상,1000001003,,",
  ",,,2026-11-05 12:00:00,이름 없음",
].join("\n");
const base = { rules: {}, supplier: "애드프로", channel: "매입DB", today: "2026-11-06", seen: new Set<string>(), existing: [] };

describe("시각 칸", () => {
  it("07~21시 매시간 한 칸, 그 밖은 쉰다", () => {
    expect(feedSlot(kst("06:59"))).toBeNull();
    expect(feedSlot(kst("07:00"))).toBe("2026-11-06 07");
    expect(feedSlot(kst("13:45"))).toBe("2026-11-06 13");
    expect(feedSlot(kst("21:59"))).toBe("2026-11-06 21");
    expect(feedSlot(kst("22:00"))).toBeNull();
  });
});

describe("줄 지문", () => {
  it("번호 꼴·공백·대소문자가 달라도 같은 고객이면 같고, 다른 고객이면 다르다", () => {
    expect(feedFingerprint({ phone: "010-0000-1001", company: "가상 상회", owner: "김가상" })).toBe(feedFingerprint({ phone: "p:+821000001001", company: "가상상회", owner: "김가상 " }));
    expect(feedFingerprint({ phone: "010-0000-1001", company: "가상상회", owner: "김가상" })).not.toBe(feedFingerprint({ phone: "010-0000-1002", company: "가상상회", owner: "김가상" }));
    expect(feedFingerprint({ phone: "010-0000-1001", company: "가상상회", owner: "김가상" })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("새 줄 고르기", () => {
  it("처음엔 온전한 3줄을 넣고, 이름 없는 줄은 확인 대기 · 공급처·유형은 연결값 · 빈 유입일은 오늘", () => {
    const plan = planFeedRun({ ...base, text: SHEET });
    expect(plan.add.map((r) => r.company)).toEqual(["가상상회", "가상꽃집", "가상공방"]);
    expect(plan.add.every((r) => r.supplier === "애드프로" && r.channel === "매입DB")).toBe(true);
    expect(plan.add[2]!.date).toBe("2026-11-06");
    expect(plan.add[2]!.phone).toBe("010-0000-1003");
    expect(plan.review).toBe(1);
    expect(plan.seen).toHaveLength(3);
  });
  it("본 줄은 다시 넣지 않는다(지운 DB가 살아나지 않음)", () => {
    const first = planFeedRun({ ...base, text: SHEET });
    const again = planFeedRun({ ...base, text: SHEET, seen: new Set(first.seen) });
    expect(again.add).toEqual([]);
    expect(again.review).toBe(1);
  });
  it("목록·휴지통에 이미 있는 업체는 넣지 않고 본 줄로만 기억", () => {
    const plan = planFeedRun({ ...base, text: SHEET, existing: [{ company: "가상꽃집", phone: "", biz: "" }] });
    expect(plan.add.map((r) => r.company)).toEqual(["가상상회", "가상공방"]);
    expect(plan.seen).toHaveLength(3);
  });
  it(`한 번에 ${FEED_MAX_ADD}건까지, 나머지는 기억하지 않고 다음 시각으로`, () => {
    const rows = Array.from({ length: FEED_MAX_ADD + 5 }, (_, i) => `가상${i}상회,김가상,010-1${String(i).padStart(3, "0")}-0000,2026-11-05,`);
    const plan = planFeedRun({ ...base, text: ["업체명,이름,연락처,접수일시,메모", ...rows].join("\n") });
    expect(plan.add).toHaveLength(FEED_MAX_ADD);
    expect(plan.deferred).toBe(5);
    expect(plan.seen).toHaveLength(FEED_MAX_ADD);
  });
  it("연결할 때는 시트의 모든 줄을 본 줄로", () => {
    expect(feedInitialSeen(SHEET, {})).toHaveLength(4);
  });
});

describe("저장 입력", () => {
  it("화면 가져오기(contactDraft)와 같은 모양 + 유입은 반영 안 함", () => {
    const row = { ...blank(), supplier: "애드프로", date: "2026-11-05", company: "가상상회", owner: "김가상", phone: "010-0000-1001", address: "서울 송파구", note: "오후 통화" };
    const server = DbSheetLeadInput.parse(feedLeadInput(row, "2026-11-06", false));
    const screen = DbSheetLeadInput.parse({ ...row, contact: { ...contactDraft(row), date: "2026-11-06", companyName: row.company }, recording: { inflow: false, activities: true } });
    expect(server).toEqual(screen);
    expect(server.recording).toEqual({ inflow: false, activities: true });
  });
});
