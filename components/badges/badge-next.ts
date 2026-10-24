/** 「다음 배지」 계산과 대시보드 칩 문구 — 배지 수집 화면과 대시보드 칩이 같은 규칙을 쓴다. */
import { BADGES, type BadgeDef } from "@/lib/analytics/badge-catalog";
import type { BadgeState } from "@/lib/analytics/badges";

export type BadgeRow = { def: BadgeDef; state: BadgeState };

export function badgeRows(states: readonly BadgeState[]): BadgeRow[] {
  const byId = new Map(states.map(s => [s.id, s]));
  return BADGES.map(def => ({ def, state: byId.get(def.id) ?? { id: def.id, earned: false, earnedOn: null, progress: null } }));
}

/** 가장 가까운 다음 배지 — 진행 막대가 있는 것 중 남은 비율이 가장 작은 것, 없으면 행동이 있는 첫 배지. 숨은 배지는 제외. */
export function pickNext(rows: readonly BadgeRow[]): BadgeRow | null {
  const open = rows.filter(r => r.def.ready && !r.state.earned && r.def.group !== "secret");
  const left = (r: BadgeRow) => 1 - r.state.progress!.cur / r.state.progress!.max;
  const withBar = open.filter(r => r.state.progress).sort((a, b) => left(a) - left(b));
  return withBar[0] ?? open.find(r => r.def.cta) ?? null;
}

export interface ChipModel {
  kind: "new" | "next" | "first" | "done";
  got: number;
  total: number;
  /** 배지 개수 뒤에 붙는 한 줄. */
  text: string;
  img: string;
  /** 진행 막대 0~100. */
  pct: number;
}

/** 대시보드 칩 — 새 배지 > 다음 배지까지 남은 양 > 첫 행동 > 다 모음 순. */
export function chipModel(states: readonly BadgeState[], newIds: readonly string[]): ChipModel {
  const rows = badgeRows(states);
  const got = rows.filter(r => r.state.earned).length;
  const total = rows.length;
  const base = { got, total, pct: Math.round((got / total) * 100) };
  // 새 배지가 여럿이면 가장 최근에 얻은 것(날짜 없는 것은 뒤).
  const fresh = rows.filter(r => newIds.includes(r.def.id) && r.state.earned)
    .sort((a, b) => (b.state.earnedOn ?? "").localeCompare(a.state.earnedOn ?? ""))[0];
  if (fresh) return { ...base, kind: "new", text: `새 배지 「${fresh.def.name}」 ✨`, img: fresh.def.img };
  const next = pickNext(rows);
  if (!next) return { ...base, kind: "done", text: "지금 얻을 수 있는 배지를 모두 모았어요", img: "trophy" };
  const p = next.state.progress;
  if (p) return { ...base, kind: "next", text: `다음 ${next.def.name.replace(" · ", " ")}까지 ${p.max - p.cur}${p.unit}`, img: next.def.img, pct: Math.round((p.cur / p.max) * 100) };
  if (got === 0) return { ...base, kind: "first", text: "첫 배지: 오늘 연락 1건 기록", img: "rocket", pct: 0 };
  return { ...base, kind: "next", text: `다음: ${next.def.name}`, img: next.def.img, pct: 0 };
}
