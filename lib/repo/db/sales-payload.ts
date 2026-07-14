/**
 * Layer: repo — 컨택 저장이 DB sales 행에 실을 payload 매핑 (**시트 쓰기 규칙과 1:1**).
 *
 * 컨택탭이 시트 E(생산)에 무엇을 쓰는지는 채널마다 다르다(`batchWriteChannelDailyRows`).
 * DB payload 가 그 규칙과 어긋나면 시트와 DB 가 서로 다른 값을 갖는다 — 파일럿은 **DB 를 읽으므로**
 * 그 어긋남이 곧 화면 오류다. 그래서 두 저장소에 같은 규칙을 강제한다:
 *
 * | 채널 | 시트 | DB payload |
 * |---|---|---|
 * | 매입DB | F:H (E = 03 매입 집계 파생, ADR-0020) | `production` **미기입** |
 * | 콜·지·기·소 | G:H (E:F = 03 접수 집계 파생, ADR-0029) | `production`·`inflow` **미기입** |
 * | 직접생산 | E = **유입** (ADR-0024) | `production := inflow` (**매핑**, strip 아님) |
 * | 현수막 | E = production (게시, ADR-0025) | 그대로 |
 *
 * **미기입(키 생략)** → jsonb 병합(`payload || excluded.payload`)이 **기존 파생값을 보존**한다
 * (`writeProductionCell` 이 유일 writer). **매핑**이 필요한 직접생산은 생략하면 안 된다 —
 * 아무도 그 키를 안 쓰므로 영구히 0 에 고정된다.
 *
 * 선재 버그(이 매퍼가 수리): 컨택 저장이 매입DB·직접생산의 `production` 에 **클라 draft 에코**를
 * 그대로 실었다. 직접생산은 그 값을 고쳐주는 writer 가 없어 **DB 가 0/백필값에 고정**됐고,
 * 파일럿 대시보드(생산·주간활동)가 직접생산 생산을 **과소표시**해 왔다.
 */
import type { ChannelDailyRow } from "@/types";
import type { SalesRowForDb } from "./client";

/** 컨택 저장 1행 → DB payload. 시트에 쓰는 것과 정확히 같은 값만 싣는다. */
export function salesDbPayload(r: ChannelDailyRow): SalesRowForDb {
  const base = {
    date: r.date,
    channel: r.channel,
    contactProgress: r.contactProgress,
    meetingReservation: r.meetingReservation,
  };
  // 콜·지·기·소: 생산·유입 둘 다 03 접수 파생 — 컨택 저장은 두 키를 안 쓴다.
  if (r.channel === "콜·지·기·소") return base;
  // 매입DB: 생산은 03 매입 집계 파생 — 컨택 저장은 production 을 안 쓴다(유입은 사용자 입력).
  if (r.channel === "매입DB") return { ...base, inflow: r.inflow };
  // 직접생산: 시트 E = 유입 미러 → DB 도 production := inflow (생략하면 영구 0 고정).
  if (r.channel === "직접생산") return { ...base, inflow: r.inflow, production: r.inflow };
  // 현수막: 시트 E = 게시(production) — 그대로.
  return { ...base, inflow: r.inflow, production: r.production };
}
