/** lib/util keeps the zero-import contract (CLAUDE.md §2), so the funnel order and the
 * value shapes are restated structurally here instead of imported from @/types.
 * They stay assignable to GoalKey / GoalActuals / WeeklyGoalValues.
 */
const KEYS = ["production", "inflow", "contacts", "meetings", "contracts"] as const;
type Key = typeof KEYS[number];
type Actuals = Record<Key, number>;
type Values = Record<Key, number | null>;

const MAX = 2147483647;

function assertTarget(contracts: number) {
  if (!Number.isSafeInteger(contracts) || contracts < 0 || contracts > MAX) {
    throw new Error("계약 목표는 0 이상의 정수로 입력해 주세요.");
  }
}

/** Approved cohort-6 convenience rates, not measured live conversion statistics.
 * Each upstream target is ceil(contracts / cumulative rates); no intermediate rounding.
 * Integer rational arithmetic avoids floating-point boundary and overflow mistakes.
 */
export function proposeWeeklyGoals(contracts: number) {
  assertTarget(contracts);
  const target = BigInt(contracts);
  const ceil = (numerator: bigint, denominator: bigint) => {
    const result = (target * numerator + denominator - 1n) / denominator;
    if (result > 2147483647n) throw new Error("제안 목표가 저장 가능한 범위를 넘어요. 계약 목표를 줄여 주세요.");
    return Number(result);
  };
  return {
    production: ceil(100000000n, 40n * 42n * 48n * 83n),
    inflow: ceil(1000000n, 40n * 42n * 48n),
    contacts: ceil(10000n, 40n * 42n),
    meetings: ceil(100n, 40n),
    contracts,
  };
}

export interface GoalProposalBasis {
  key: Key;
  /** Week 1 … previous week actual for this metric. */
  cumulative: number;
  /** Cumulative metric per one cumulative contract, or null when the fixed rate was used. */
  perContract: number | null;
  value: number;
  /** True when this stage fell back to the approved fixed rate instead of the student's own record. */
  fallback: boolean;
}

export interface GoalProposal {
  goals: Values;
  basis: GoalProposalBasis[];
  /** True when no stage could use the student's cumulative record. */
  allFallback: boolean;
}

/** Back-calculation from the student's own week 1 … previous week cumulative actuals.
 * Every upstream target is ceil(contracts * cumulative[key] / cumulative.contracts) — one division
 * against the cumulative ratio, so no intermediate rounding compounds down the funnel.
 * A stage with no cumulative record to divide by falls back to the approved fixed rate.
 */
export function proposeFromCumulative(cumulative: Actuals, contracts: number): GoalProposal {
  assertTarget(contracts);
  const fixed = proposeWeeklyGoals(contracts);
  const target = BigInt(contracts);
  const denominator = BigInt(Math.max(0, Math.trunc(cumulative.contracts)));
  const goals: Values = { ...fixed };
  const basis: GoalProposalBasis[] = [];
  for (const key of KEYS) {
    const raw = Math.max(0, Math.trunc(cumulative[key]));
    if (key === "contracts") {
      basis.push({ key, cumulative: raw, perContract: denominator === 0n ? null : 1, value: contracts, fallback: false });
      continue;
    }
    const usable = denominator > 0n && raw > 0;
    if (usable) {
      const result = (target * BigInt(raw) + denominator - 1n) / denominator;
      if (result > BigInt(MAX)) throw new Error("제안 목표가 저장 가능한 범위를 넘어요. 계약 목표를 줄여 주세요.");
      goals[key] = Number(result);
    }
    basis.push({
      key,
      cumulative: raw,
      perContract: usable ? raw / Number(denominator) : null,
      value: goals[key] ?? 0,
      fallback: !usable,
    });
  }
  return { goals, basis, allFallback: basis.every(b => b.fallback || b.key === "contracts") };
}
