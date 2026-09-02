/**
 * 「잘못 적었어요 → 옮기기」 순수 규칙.
 *
 * ## 왜 (2026-09-02 belie)
 * 미팅의 **예정일시**(04 D열)는 카드에서 고칠 수 있지만 **기록된 날짜**(B열 예약일)와
 * **채널**(F열)은 화면 어디에서도 못 고쳤다 — 그 둘은 「지금 보는 날짜」와 「지금 열린 탭」에서
 * 자동으로 정해지기 때문이다. 잘못 적으면 지우고 다시 넣어야 했고, 그러면 그날 4지표까지
 * 손으로 맞춰야 했다.
 *
 * ## 이 파일이 정하는 것
 * 네 선택지가 각각 **어떤 숫자를 얼마나** 옮기는가, 그리고 **무엇을 못 옮기는가**.
 * UI·네트워크는 전혀 모른다 — 그래서 테스트로 못 박을 수 있다.
 *
 * ## 절대 규칙 두 개
 * ① **생산은 안 옮긴다.** DB구매·현수막 게시·영업기회 접수에서 나오는 숫자라 이 미팅 한 건과
 *    짝이 아니다. 미팅을 옮긴다고 그날 생산이 따라갈 이유가 없다.
 * ② **콜·지·기·소가 끼면 유입은 안 옮긴다.** ADR-0029 가 그 채널 유입을 「그 날짜에 접수한
 *    건수」로 정의한다 — 파생값이라 손으로 옮기면 접수 원장과 어긋난다. 옮기려면 STEP 1 에서
 *    그 영업기회의 접수일을 고쳐야 한다.
 */
import { METRIC_LABEL, type Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";

/** 옮길 수 있는 지표 — `production` 은 의도적으로 없다(위 규칙 ①). */
export type MovableMetric = "inflow" | "contactProgress" | "meetingReservation";

export const MOVABLE_METRICS: readonly MovableMetric[] = [
  "inflow",
  "contactProgress",
  "meetingReservation",
] as const;

/** 콜·지·기·소 — 유입이 파생값인 유일한 채널(ADR-0029). */
export const DERIVED_INFLOW_CHANNEL: Channel = "콜·지·기·소";

/** 네 선택지. UI 문구는 컴포넌트가, 「무엇이 움직이나」는 여기가 정한다. */
export type MoveOption = "meet" | "part" | "all" | "chan";

export const MOVE_OPTIONS: readonly MoveOption[] = ["meet", "part", "all", "chan"] as const;

/** 로그·토스트용 짧은 이름. */
export const MOVE_OPTION_LABEL: Record<MoveOption, string> = {
  meet: "미팅만",
  part: "이 미팅 묶음",
  all: "숫자 전부",
  chan: "채널만",
};

export interface MovePlace {
  date: string;
  channel: Channel;
}

/** from·to 중 하나라도 콜·지·기·소면 유입은 잠긴다(규칙 ②). */
export function isInflowLocked(from: Channel, to: Channel): boolean {
  return from === DERIVED_INFLOW_CHANNEL || to === DERIVED_INFLOW_CHANNEL;
}

/** 「같은 날짜에서 채널만 바꾸기」는 날짜를 못 고른다 — 그게 이 선택지의 뜻이다. */
export function isDateLocked(option: MoveOption): boolean {
  return option === "chan";
}

/** 옮길 데가 지금 자리와 같으면 옮길 게 없다. */
export function isSamePlace(from: MovePlace, to: MovePlace): boolean {
  return from.date === to.date && from.channel === to.channel;
}

/**
 * from 에서 **빼고** to 에 **더할** 양(항상 0 이상).
 *
 * - `meet` — 숫자는 안 건드린다(미팅 카드만 옮김)
 * - `part` · `chan` — 이 미팅 몫 **1씩**. 원본에 없으면(0) 그 지표는 건너뛴다
 * - `all` — 그 자리 숫자 **전부**
 *
 * 원본 값으로 clamp 하므로 음수가 되는 조합이 나올 수 없다.
 */
export function moveDeltas(
  option: MoveOption,
  source: ChannelDailyRowMetrics,
  inflowLocked: boolean,
): Partial<Record<MovableMetric, number>> {
  if (option === "meet") return {};
  const out: Partial<Record<MovableMetric, number>> = {};
  for (const key of MOVABLE_METRICS) {
    if (key === "inflow" && inflowLocked) continue;
    const have = Math.max(0, source[key] ?? 0);
    if (have === 0) continue;
    out[key] = option === "all" ? have : Math.min(1, have);
  }
  return out;
}

/** 실제로 움직이는 숫자가 있나 — 없으면 「미팅 카드만 옮겨요」라고 말해줘야 한다. */
export function hasMetricMove(deltas: Partial<Record<MovableMetric, number>>): boolean {
  return MOVABLE_METRICS.some((k) => (deltas[k] ?? 0) > 0);
}

/** "유입 1 · 컨택진행 1 · 미팅예약 1" — 미리보기 한 줄. */
export function describeDeltas(
  deltas: Partial<Record<MovableMetric, number>>,
): string {
  return MOVABLE_METRICS.filter((k) => (deltas[k] ?? 0) > 0)
    .map((k) => `${METRIC_LABEL[k]} ${deltas[k]}`)
    .join(" · ");
}

/** 옮길 자리에 이미 뭔가 적혀 있나 — 덮어쓰지 않고 **더해진다**고 미리 알려주기 위함. */
export function hasAnyRecord(metrics: ChannelDailyRowMetrics | undefined): boolean {
  if (!metrics) return false;
  return (
    metrics.production > 0 ||
    metrics.inflow > 0 ||
    metrics.contactProgress > 0 ||
    metrics.meetingReservation > 0
  );
}
