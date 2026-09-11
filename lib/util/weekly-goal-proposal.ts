/** Approved cohort-6 convenience rates, not measured live conversion statistics.
 * Each upstream target is ceil(contracts / cumulative rates); no intermediate rounding.
 * Integer rational arithmetic avoids floating-point boundary and overflow mistakes.
 */
export function proposeWeeklyGoals(contracts: number) {
  if (!Number.isSafeInteger(contracts) || contracts < 0 || contracts > 2147483647) {
    throw new Error("계약 목표는 0 이상의 정수로 입력해 주세요.");
  }
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
