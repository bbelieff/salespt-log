/**
 * record-merge — 두 기록(실무/수납 쪽 · 영업기록 쪽)을 칸별로 합치는 순수 도구(import 없음).
 *
 * 「영업기록 없이 추가」 업체를 미팅에 연결할 때(belie 2026-09-29): 빈 칸은 서로 채우고, 둘 다 값이 있고
 * 다르면 **최근에 기록한 쪽**을 기본으로 고르되 사용자가 칸마다 바꿀 수 있다.
 */

export type MergeSide = "contract" | "meeting";

export type FieldConflict = { key: string; contract: string; meeting: string; pick: MergeSide };

/** 최근 쪽. 시각을 모르면 실무/수납(contract) 쪽 — 사람이 나중에 자세히 적었을 가능성이 크다. */
export function newerSide(contractAt: string | null | undefined, meetingAt: string | null | undefined): MergeSide {
  if (contractAt && meetingAt) return meetingAt > contractAt ? "meeting" : "contract";
  if (meetingAt && !contractAt) return "meeting";
  return "contract";
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** 글 칸끼리 비교해 서로 다른(둘 다 값 있는) 칸 목록. 객체 칸(커스텀 등)은 건너뛴다. */
export function findConflicts(
  contract: Record<string, unknown>,
  meeting: Record<string, unknown>,
  defaultPick: MergeSide,
): FieldConflict[] {
  const keys = new Set([...Object.keys(contract), ...Object.keys(meeting)]);
  const out: FieldConflict[] = [];
  for (const key of keys) {
    const a = text(contract[key]);
    const b = text(meeting[key]);
    if (a && b && a !== b) out.push({ key, contract: a, meeting: b, pick: defaultPick });
  }
  return out;
}

/**
 * 합친 결과. 글 칸: 한쪽만 값 → 그 값, 다르면 picks[key](없으면 defaultPick) 쪽.
 * 객체 칸(커스텀 {업체:{}, 대표자:{}}): 하위 칸별로 같은 규칙(충돌은 defaultPick).
 */
export function mergeRecords(
  contract: Record<string, unknown>,
  meeting: Record<string, unknown>,
  defaultPick: MergeSide,
  picks: Record<string, MergeSide> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(contract), ...Object.keys(meeting)]);
  for (const key of keys) {
    const a = contract[key];
    const b = meeting[key];
    const side = picks[key] ?? defaultPick;
    if (isPlainObject(a) || isPlainObject(b)) {
      out[key] = mergeRecords(isPlainObject(a) ? a : {}, isPlainObject(b) ? b : {}, side);
      continue;
    }
    const ta = text(a);
    const tb = text(b);
    if (!ta) out[key] = b ?? a ?? "";
    else if (!tb) out[key] = a;
    else out[key] = side === "meeting" ? b : a;
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 업체명 비교용 — 띄어쓰기·(주)·주식회사·㈜ 무시. */
export function normalizeCompanyName(name: string): string {
  return name
    .replace(/\(\s*주\s*\)|㈜|주식회사|\(\s*유\s*\)|유한회사/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** 같은 업체로 볼지 — 정규화 이름이 같거나 한쪽이 다른 쪽을 품는다(2글자 이상). */
export function sameCompanyName(a: string, b: string): boolean {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x));
}
