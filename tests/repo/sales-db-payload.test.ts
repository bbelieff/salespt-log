/**
 * R3⑤ PR-1 — `salesDbPayload`: 컨택 저장의 DB payload 는 **시트에 쓰는 것과 정확히 같은 값**만 싣는다.
 * 파일럿은 DB 를 읽으므로 시트↔DB 불일치 = 화면 오류. 채널별 규칙(단일 원천):
 *   매입DB     시트 F:H  (E=03 매입 집계 파생, ADR-0020)   → production 미기입
 *   콜·지·기·소 시트 G:H  (E:F=03 접수 집계 파생, ADR-0029) → production·inflow 미기입
 *   직접생산    시트 E=유입 (ADR-0024)                     → production := inflow (**매핑**)
 *   현수막      시트 E=production (게시, ADR-0025)          → 그대로
 *
 * 선재 버그 회귀 고정: 직접생산은 클라 draft 에코(읽기전용 행이라 안 바뀜)가 DB 에 실려
 * **아무 writer 도 안 고쳐 0/백필값에 영구 고정** → 파일럿 대시보드 생산 과소표시.
 * strip 이 아니라 **매핑**이어야 하는 이유(생략하면 영구 0).
 */
import { describe, expect, it } from "vitest";
import type { ChannelDailyRow } from "@/types";
import { salesDbPayload } from "@/repo/db/sales-payload";

const mk = (o: Partial<ChannelDailyRow>): ChannelDailyRow =>
  ({
    date: "2026-04-18", channel: "매입DB", production: 0, inflow: 0,
    contactProgress: 0, meetingReservation: 0, ...o,
  }) as ChannelDailyRow;

describe("salesDbPayload — 채널별 DB payload = 시트 쓰기 규칙 1:1", () => {
  it("매입DB — production 미기입(03 집계 파생), 나머지는 실림", () => {
    const p = salesDbPayload(mk({ channel: "매입DB", production: 3, inflow: 7, contactProgress: 1, meetingReservation: 2 }));
    expect("production" in p).toBe(false); // 클라 에코가 03 집계 파생값을 덮지 못하게
    expect(p).toEqual({ date: "2026-04-18", channel: "매입DB", inflow: 7, contactProgress: 1, meetingReservation: 2 });
  });

  it("콜·지·기·소 — production·inflow 둘 다 미기입(ADR-0029)", () => {
    const p = salesDbPayload(mk({ channel: "콜·지·기·소", production: 3, inflow: 9, contactProgress: 4, meetingReservation: 1 }));
    expect("production" in p).toBe(false);
    expect("inflow" in p).toBe(false);
    expect(p).toEqual({ date: "2026-04-18", channel: "콜·지·기·소", contactProgress: 4, meetingReservation: 1 });
  });

  it("직접생산 — production := inflow (**매핑**, 시트 E=유입과 동일). strip 이면 영구 0 고정", () => {
    const p = salesDbPayload(mk({ channel: "직접생산", production: 0, inflow: 8, contactProgress: 2, meetingReservation: 0 }));
    expect(p.production).toBe(8); // 클라 에코(0) 가 아니라 유입
    expect(p.inflow).toBe(8);
    expect("production" in p).toBe(true); // 생략하면 아무도 안 써서 0 에 고정됨
  });

  it("직접생산 — 스테일 에코가 유입과 달라도 유입이 이긴다(시트 E 와 일치)", () => {
    const p = salesDbPayload(mk({ channel: "직접생산", production: 3, inflow: 5 }));
    expect(p.production).toBe(5); // 이전 저장분 에코(3) 무시
  });

  it("현수막 — 그대로(시트 E = 게시 production, ADR-0025)", () => {
    const p = salesDbPayload(mk({ channel: "현수막", production: 6, inflow: 5, contactProgress: 1, meetingReservation: 0 }));
    expect(p).toEqual({
      date: "2026-04-18", channel: "현수막", production: 6, inflow: 5, contactProgress: 1, meetingReservation: 0,
    });
  });

  it("컨택 소유 지표(컨택진행·미팅예약)는 전 채널 항상 실림", () => {
    for (const ch of ["매입DB", "직접생산", "현수막", "콜·지·기·소"] as const) {
      const p = salesDbPayload(mk({ channel: ch, contactProgress: 3, meetingReservation: 2 }));
      expect(p.contactProgress).toBe(3);
      expect(p.meetingReservation).toBe(2);
    }
  });
});
