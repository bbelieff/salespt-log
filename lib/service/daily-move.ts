/**
 * 「잘못 적었어요 → 옮기기」 — 하루치 지표를 다른 날짜·채널로 옮긴다.
 *
 * ## 왜 서버에서 하나
 * 화면은 **보고 있는 하루치만** 들고 있다(`useDay(date)`). 다른 날짜로 옮기려면 그 날짜의
 * 현재 값을 알아야 하는데, 클라이언트가 가져와서 더한 뒤 통째로 덮어쓰면 그 사이 다른
 * 곳에서 바뀐 값을 날린다. **읽고-더하고-쓰기를 여기 한 곳에서** 한다.
 *
 * ## 미팅예약(H)은 왜 안 옮기나 — 옮길 필요가 없다
 * `saveContactMetrics` 가 미팅예약을 **그 날짜·채널의 실제 카드 수로 재계산**한다(ADR-0010).
 * 그러니 미팅 행의 예약일(B)·채널(F)만 옮겨 놓고 **양쪽 날짜를 각각 저장**하면 H 는 저절로
 * 맞는다. 손으로 ±1 하면 오히려 카드 수와 어긋난다. 그래서 이 함수가 받는 델타는
 * **유입·컨택진행 둘뿐**이다.
 *
 * ## 생산은 왜 아예 못 받나
 * DB구매·현수막 게시·영업기회 접수에서 나오는 숫자라 미팅 한 건과 짝이 아니다. 스키마에서
 * 받지 않으므로 실수로도 못 옮긴다. 원본·대상의 생산 값은 **읽은 그대로 되쓴다**.
 *
 * ## 콜·지·기·소 유입
 * ADR-0029 파생값이라 애초에 저장되지 않는다(시트 G:H·DB toDbRows 가 제외). 호출부가
 * 유입 델타를 안 보내는 게 정본이고, 보내더라도 저장 단계에서 무시된다.
 */
import type { Channel } from "@/types";
import { loadDay, saveContactMetrics, type ChannelDailyRowMetrics } from "./contact";

/** 옮길 수 있는 지표 — 미팅예약(파생)·생산(무관)은 없다. */
export interface MoveMetricDeltas {
  inflow?: number;
  contactProgress?: number;
}

export interface MovePlaceInput {
  date: string;
  channel: Channel;
  /** 화면이 들고 있는 현재 값. 저장 안 한 입력을 날리지 않으려고 클라가 준다. 없으면 서버가 읽는다. */
  metrics?: ChannelDailyRowMetrics;
}

export interface MoveDailyMetricsInput {
  from: MovePlaceInput;
  to: MovePlaceInput;
  deltas: MoveMetricDeltas;
}

export interface MoveDailyMetricsResult {
  /** 옮긴 뒤 원본 자리의 값 — 화면이 draft 를 이걸로 맞춘다. */
  from: ChannelDailyRowMetrics;
  /** 옮긴 뒤 대상 자리의 값. */
  to: ChannelDailyRowMetrics;
  /** 실제로 옮겨진 양(원본에 없어서 깎인 뒤). */
  applied: MoveMetricDeltas;
}

const ZERO: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  meetingReservation: 0,
};

async function readMetrics(
  email: string,
  place: MovePlaceInput,
  cache: Map<string, Record<Channel, ChannelDailyRowMetrics>>,
): Promise<ChannelDailyRowMetrics> {
  if (place.metrics) return place.metrics;
  let day = cache.get(place.date);
  if (!day) {
    const view = await loadDay(email, place.date);
    day = view.channels;
    cache.set(place.date, day);
  }
  return day[place.channel] ?? ZERO;
}

/**
 * 원본에서 빼고 대상에 더한다. 델타는 **원본 현재값으로 깎아** 음수가 못 나오게 한다.
 * 같은 날짜면 두 채널을 한 번에 저장한다 — 두 번 저장하면 뒤 저장이 앞 저장을 덮는다.
 */
export async function moveDailyMetrics(
  email: string,
  input: MoveDailyMetricsInput,
): Promise<MoveDailyMetricsResult> {
  const { from, to, deltas } = input;
  if (from.date === to.date && from.channel === to.channel) {
    throw new Error("[daily-move] 옮길 자리가 지금 자리와 같습니다");
  }

  const cache = new Map<string, Record<Channel, ChannelDailyRowMetrics>>();
  const src = await readMetrics(email, from, cache);
  const dst = await readMetrics(email, to, cache);

  const applied: MoveMetricDeltas = {};
  const nextFrom: ChannelDailyRowMetrics = { ...src };
  const nextTo: ChannelDailyRowMetrics = { ...dst };

  for (const key of ["inflow", "contactProgress"] as const) {
    const want = Math.max(0, Math.trunc(deltas[key] ?? 0));
    if (want === 0) continue;
    const move = Math.min(want, src[key]);
    if (move === 0) continue;
    applied[key] = move;
    nextFrom[key] = src[key] - move;
    nextTo[key] = dst[key] + move;
  }

  // 미팅예약은 저장 단계가 카드 수로 다시 센다(ADR-0010) — 여기서 손대지 않는다.
  if (from.date === to.date) {
    await saveContactMetrics(email, from.date, {
      [from.channel]: nextFrom,
      [to.channel]: nextTo,
    } as Partial<Record<Channel, ChannelDailyRowMetrics>>);
  } else {
    // 대상 먼저 — 중간에 실패해도 숫자가 사라지지 않고 겹치는 쪽(합계 유지)으로 남는다.
    await saveContactMetrics(email, to.date, { [to.channel]: nextTo } as Partial<
      Record<Channel, ChannelDailyRowMetrics>
    >);
    await saveContactMetrics(email, from.date, { [from.channel]: nextFrom } as Partial<
      Record<Channel, ChannelDailyRowMetrics>
    >);
  }

  return { from: nextFrom, to: nextTo, applied };
}
