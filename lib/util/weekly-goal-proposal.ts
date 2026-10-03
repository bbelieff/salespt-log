/** Personal cumulative metrics only; zero imports keep the util layer independent. */
type Key = "production" | "inflow" | "contacts" | "meetings" | "contracts";

export type ProposalReason = "no-contract-history" | "no-stage-history" | null;

export interface GoalProposalBasis {
  key: Key;
  cumulative: number;
  perContract: number | null;
  value: number | null;
  reason: ProposalReason;
}

export interface GoalProposal {
  goals: Record<Key, number | null>;
  basis: GoalProposalBasis[];
}

const ORDERED_KEYS: readonly Key[] = [
  "production",
  "inflow",
  "contacts",
  "meetings",
  "contracts",
];

const UPSTREAM_KEYS: readonly Key[] = [
  "production",
  "inflow",
  "contacts",
  "meetings",
];

const MAX_TARGET = 2147483647;

function normalizeCumulativeValue(value: unknown): number {
  if (typeof value !== "number") {
    return 0;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.trunc(value);
}

function ceilTargetForMetric(target: number, metric: number, ownContracts: number): number {
  const numerator = BigInt(target) * BigInt(metric);
  const denominator = BigInt(ownContracts);
  const quotient = (numerator + denominator - 1n) / denominator;
  if (quotient > BigInt(MAX_TARGET)) {
    throw new RangeError("제안 목표가 저장 가능한 범위를 넘어요. 계약 목표를 줄여 주세요.");
  }
  return Number(quotient);
}

export function proposeFromCumulative(
  cumulative: Record<Key, number>,
  contracts: number
): GoalProposal {
  if (!Number.isSafeInteger(contracts) || contracts < 0 || contracts > MAX_TARGET) {
    throw new RangeError("계약 목표는 0 이상의 정수로 입력해 주세요.");
  }
  const source = (cumulative ?? {}) as Record<Key, unknown>;
  const normalized = {} as Record<Key, number>;
  for (const key of ORDERED_KEYS) {
    normalized[key] = normalizeCumulativeValue(source[key]);
  }
  const ownContracts = normalized.contracts;
  const goals = {} as Record<Key, number | null>;
  const basis: GoalProposalBasis[] = [];
  for (const key of UPSTREAM_KEYS) {
    const metric = normalized[key];
    if (ownContracts <= 0) {
      goals[key] = null;
      basis.push({
        key,
        cumulative: metric,
        perContract: null,
        value: null,
        reason: "no-contract-history",
      });
    } else if (metric <= 0) {
      goals[key] = null;
      basis.push({
        key,
        cumulative: metric,
        perContract: null,
        value: null,
        reason: "no-stage-history",
      });
    } else {
      const value = ceilTargetForMetric(contracts, metric, ownContracts);
      goals[key] = value;
      basis.push({
        key,
        cumulative: metric,
        perContract: metric / ownContracts,
        value,
        reason: null,
      });
    }
  }
  goals.contracts = contracts;
  basis.push({
    key: "contracts",
    cumulative: ownContracts,
    perContract: ownContracts > 0 ? 1 : null,
    value: contracts,
    reason: null,
  });
  return { goals, basis };
}
