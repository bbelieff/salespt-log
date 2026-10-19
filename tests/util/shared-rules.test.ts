/**
 * 구조 개선 ⑦·⑫ — 여러 화면이 따로 적던 규칙을 한 곳으로 모은 뒤의 동작 고정.
 * 모든 입력은 합성값.
 */
import { describe, expect, it } from "vitest";
import { DB_SHEET_QUALIFIED_RESULTS, DB_SHEET_RESULTS, isQualifiedDbSheetContact } from "@/types/db-sheet";
import { DAY_KO, isValidISODate } from "@/util/week";
import { outcomeLabel, outcomes, recordContact, blank, validDate } from "@/app/(app)/db-sheet/_components/model";
import { STATUS_FILTERS } from "@/app/(app)/db-sheet/_components/status-filter";
import { isSlotComplete } from "@/app/(app)/contact/_lib/slot-validation";
import { slotComplete } from "@/app/(app)/contact/_lib/meeting-draft";
import { isValidIsoDate } from "@/app/(app)/db/_lib/db-autosave";
import { CHANNEL_BADGE_CLASS } from "@/components/ui/ChannelBadge";
import { CHANNEL_BADGE } from "@/app/(app)/schedule/_lib/badges";

describe("DB관리시트 실적 컨택 판정 — 한 곳", () => {
  it("컨택진행·상담 후 거절만 실적", () => {
    expect(DB_SHEET_RESULTS.filter(isQualifiedDbSheetContact)).toEqual(["컨택진행", "상담 후 거절"]);
  });
  it("화면 선택지는 결과 목록 순서 그대로", () => {
    expect([...outcomes]).toEqual(["미컨택", "부재", "단순거절", "재통화", "컨택진행", "상담 후 거절", "AS예정"]);
  });
  it("라벨·상태 필터·기록이 같은 판정을 쓴다", () => {
    expect(outcomeLabel("상담 후 거절")).toContain("STEP 2 컨택진행 +1");
    expect(outcomeLabel("재통화")).toContain("집계 제외");
    expect(STATUS_FILTERS.find(f => f.id === "progress")!.results).toEqual([...DB_SHEET_QUALIFIED_RESULTS]);
    const row = { ...blank(), stage: "미컨택", hasQualifiedContact: false };
    expect(recordContact(row, "컨택진행", "2026-10-19").stage).toBe("상담 중");
    expect(recordContact(row, "부재", "2026-10-19").stage).toBe("미컨택");
  });
});

describe("날짜 검증 — week.ts 하나", () => {
  it.each(["2026-02-30", "2026-13-01", "26-01-01", " 2026-01-01", ""])("거부 %s", (v) => {
    expect(validDate(v)).toBe(false);
    expect(isValidIsoDate(v)).toBe(false);
  });
  it("실제 날짜는 통과", () => {
    expect(validDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate(20260228)).toBe(false);
    expect(isValidISODate("2024-02-29")).toBe(true);
  });
});

describe("기타 공용 표", () => {
  it("요일 배열", () => { expect(DAY_KO).toEqual(["일", "월", "화", "수", "목", "금", "토"]); });
  it("채널 배지 표는 하나", () => { expect(CHANNEL_BADGE).toBe(CHANNEL_BADGE_CLASS); });
  it("미팅 카드 완료 판정은 하나", () => {
    const slot = { 미팅날짜: "2026-10-20", 미팅시간: "10:00", 업체명: "예시상사", 장소: "본사" } as Parameters<typeof isSlotComplete>[0];
    expect(isSlotComplete(slot)).toBe(true);
    expect(slotComplete).toBe(isSlotComplete);
    expect(isSlotComplete({ ...slot, 장소: " " })).toBe(false);
  });
});
