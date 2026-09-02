/**
 * 「잘못 적었어요 → 옮기기」 규칙 — 회귀 가드.
 *
 * 배경(2026-09-02~03 belie): 미팅의 예정일시는 고칠 수 있는데 **기록된 날짜·채널**은 못
 * 고쳤다. 네 선택지로 옮길 수 있게 하면서, **절대 옮기면 안 되는 두 가지**를 여기서 못 박는다.
 *
 * ★ = 어기면 통계가 틀어지는 줄.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { ChannelDailyRowMetrics } from "@/service";
import {
  describeDeltas,
  hasAnyRecord,
  hasMetricMove,
  isDateLocked,
  isInflowLocked,
  isSamePlace,
  moveDeltas,
  MOVE_OPTIONS,
} from "@/app/(app)/contact/_lib/record-move";

const M = (
  production: number,
  inflow: number,
  contactProgress: number,
  meetingReservation: number,
): ChannelDailyRowMetrics => ({
  production,
  inflow,
  contactProgress,
  meetingReservation,
});

describe("네 선택지", () => {
  it("네 개다 — 미팅만 / 묶음 / 숫자 전부 / 채널만", () => {
    expect(MOVE_OPTIONS).toEqual(["meet", "part", "all", "chan"]);
  });

  it("「미팅만」은 숫자를 하나도 안 옮긴다", () => {
    expect(moveDeltas("meet", M(8, 3, 2, 2), false)).toEqual({});
    expect(hasMetricMove(moveDeltas("meet", M(8, 3, 2, 2), false))).toBe(false);
  });

  it("「묶음」은 1씩만 옮긴다", () => {
    expect(moveDeltas("part", M(8, 3, 2, 2), false)).toEqual({
      inflow: 1,
      contactProgress: 1,
      meetingReservation: 1,
    });
  });

  it("「채널만」도 1씩 — 옮기는 양은 묶음과 같고 날짜만 잠긴다", () => {
    const src = M(8, 3, 2, 2);
    expect(moveDeltas("chan", src, false)).toEqual(moveDeltas("part", src, false));
    expect(isDateLocked("chan")).toBe(true);
    for (const k of ["meet", "part", "all"] as const) {
      expect(isDateLocked(k)).toBe(false);
    }
  });

  it("「숫자 전부」는 그 자리 값을 통째로 옮긴다", () => {
    expect(moveDeltas("all", M(8, 3, 2, 2), false)).toEqual({
      inflow: 3,
      contactProgress: 2,
      meetingReservation: 2,
    });
  });

  it("원본에 없는 지표는 건너뛴다 — 음수가 나올 수 없다", () => {
    expect(moveDeltas("part", M(0, 0, 1, 0), false)).toEqual({ contactProgress: 1 });
    expect(moveDeltas("all", M(5, 0, 0, 0), false)).toEqual({});
  });
});

describe("★ 절대 안 옮기는 것", () => {
  it("★생산은 어떤 선택지에서도 안 옮긴다 — DB구매·게시·접수에서 나오는 값이라 미팅과 짝이 아니다", () => {
    for (const opt of MOVE_OPTIONS) {
      const d = moveDeltas(opt, M(99, 3, 2, 2), false);
      expect(d).not.toHaveProperty("production");
      expect(JSON.stringify(d)).not.toContain("production");
    }
  });

  it("★콜·지·기·소가 끼면 유입은 안 옮긴다 (ADR-0029 파생값)", () => {
    expect(isInflowLocked("콜·지·기·소", "매입DB")).toBe(true);
    expect(isInflowLocked("매입DB", "콜·지·기·소")).toBe(true);
    expect(isInflowLocked("매입DB", "현수막")).toBe(false);

    const locked = moveDeltas("all", M(8, 7, 2, 2), true);
    expect(locked).not.toHaveProperty("inflow");
    expect(locked).toEqual({ contactProgress: 2, meetingReservation: 2 });
  });
});

describe("같은 자리 판정", () => {
  it("날짜·채널이 둘 다 같아야 같은 자리", () => {
    expect(
      isSamePlace(
        { date: "2026-09-02", channel: "매입DB" },
        { date: "2026-09-02", channel: "매입DB" },
      ),
    ).toBe(true);
    expect(
      isSamePlace(
        { date: "2026-09-02", channel: "매입DB" },
        { date: "2026-09-02", channel: "현수막" },
      ),
    ).toBe(false);
    expect(
      isSamePlace(
        { date: "2026-09-02", channel: "매입DB" },
        { date: "2026-08-29", channel: "매입DB" },
      ),
    ).toBe(false);
  });
});

describe("옮길 자리에 기록이 있나", () => {
  it("네 지표 중 하나라도 0보다 크면 있다", () => {
    expect(hasAnyRecord(M(0, 0, 0, 0))).toBe(false);
    expect(hasAnyRecord(M(1, 0, 0, 0))).toBe(true);
    expect(hasAnyRecord(M(0, 0, 0, 1))).toBe(true);
    expect(hasAnyRecord(undefined)).toBe(false);
  });
});

describe("미리보기 문구", () => {
  it("옮기는 것만 사람 말로 나열한다", () => {
    expect(describeDeltas({ inflow: 1, contactProgress: 1, meetingReservation: 1 })).toBe(
      "유입 1 · 컨택진행 1 · 미팅예약 1",
    );
    expect(describeDeltas({ contactProgress: 2 })).toBe("컨택진행 2");
    expect(describeDeltas({})).toBe("");
  });
});

describe("★ 서버로 나가는 것 (소스 가드)", () => {
  const api = readFileSync("app/api/daily/move/route.ts", "utf8");
  const hook = readFileSync("app/(app)/contact/_lib/use-record-move.ts", "utf8");

  it("★API 는 생산·미팅예약을 아예 안 받는다 — 실수로도 못 옮긴다", () => {
    const deltaBlock = api.slice(api.indexOf("deltas: z.object("));
    expect(deltaBlock).toContain("inflow");
    expect(deltaBlock).toContain("contactProgress");
    expect(deltaBlock.slice(0, deltaBlock.indexOf("}),"))).not.toContain("production");
    expect(deltaBlock.slice(0, deltaBlock.indexOf("}),"))).not.toContain("meetingReservation");
  });

  it("★미팅 카드를 먼저 옮긴 뒤 숫자를 옮긴다 — H(미팅예약)가 카드 수 파생이라(ADR-0010)", () => {
    expect(hook.indexOf("appendMeeting.mutateAsync")).toBeGreaterThan(-1);
    expect(hook.indexOf("moveMetrics.mutateAsync")).toBeGreaterThan(
      hook.indexOf("appendMeeting.mutateAsync"),
    );
  });

  it("같은 자리로는 못 보낸다", () => {
    expect(api).toContain("from.date === to.date && from.channel === to.channel");
  });
});
