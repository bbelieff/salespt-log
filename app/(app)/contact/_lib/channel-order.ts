/**
 * 컨택관리 탭의 4채널 표시 순서 — 사용자별 localStorage 저장.
 *
 * SSOT: 비즈니스 데이터는 Google Sheets, 이건 단순 UI preference이므로
 * device-local 저장 (CLAUDE.md YAGNI 원칙). 다른 디바이스에서는 다시 정렬.
 *
 * key: "salespt:channel-order"
 * value: JSON array of 4 unique Channel strings
 */
import { CHANNEL_ORDER, type Channel } from "@/types";

const STORAGE_KEY = "salespt:channel-order";

/** localStorage에서 순서 읽기. 손상/없음 시 기본 CHANNEL_ORDER. */
export function loadChannelOrder(): Channel[] {
  if (typeof window === "undefined") return [...CHANNEL_ORDER];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...CHANNEL_ORDER];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== CHANNEL_ORDER.length) {
      return [...CHANNEL_ORDER];
    }
    // 모든 항목이 valid Channel + 중복 없음 검증
    const valid = parsed.every(
      (c): c is Channel =>
        typeof c === "string" && (CHANNEL_ORDER as readonly string[]).includes(c),
    );
    if (!valid) return [...CHANNEL_ORDER];
    if (new Set(parsed).size !== CHANNEL_ORDER.length) {
      return [...CHANNEL_ORDER];
    }
    return parsed as Channel[];
  } catch {
    return [...CHANNEL_ORDER];
  }
}

/** localStorage에 순서 저장 (실패 무시 — 4탭 quota 영향 무시할 수준). */
export function saveChannelOrder(order: Channel[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // private mode / quota / etc. — silently ignore
  }
}

/** from을 to 위치로 이동 (배열 immutable 반환). */
export function moveChannel(
  order: Channel[],
  from: Channel,
  to: Channel,
): Channel[] {
  if (from === to) return order;
  const fi = order.indexOf(from);
  const ti = order.indexOf(to);
  if (fi < 0 || ti < 0) return order;
  const next = [...order];
  next.splice(fi, 1);
  next.splice(ti, 0, from);
  return next;
}
