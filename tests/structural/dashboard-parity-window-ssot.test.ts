/**
 * BBE-155 — dashboard parity 의 JS 상수 사본이 통계 창 SSOT 와 함께 움직이는지 고정한다.
 *
 * MAX_SHEET_WEEK(10)는 시트 물리 좌표 상한이고 STATS_WEEKS(8)는 대시보드 통계 창이다.
 * 둘을 바꿔 적어도 값만 8이면 기존 동작 테스트는 통과할 수 있으므로 값과 설명을 함께 검증한다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const canonical = read("lib/config/cohort-dates.ts");
const parityCopy = read("scripts/ops/dashboard-parity-lib.mjs");

function constantValue(source: string, declaration: RegExp, label: string): number {
  const match = source.match(declaration);
  expect(match, `${label} 선언을 찾지 못함`).not.toBeNull();
  return Number(match![1]);
}

describe("dashboard parity 통계 창 SSOT 사본", () => {
  const canonicalWeeks = constantValue(
    canonical,
    /export const STATS_WEEKS\s*=\s*(\d+)\s*;/,
    "cohort-dates STATS_WEEKS",
  );
  const copiedWeeks = constantValue(
    parityCopy,
    /const STATS_WEEKS\s*=\s*(\d+)\s*;/,
    "dashboard-parity STATS_WEEKS",
  );

  it("정본과 parity 사본이 모두 8주이며 서로 같다", () => {
    expect(canonicalWeeks).toBe(8);
    expect(copiedWeeks).toBe(canonicalWeeks);
  });

  it("사본 주석이 물리 상한이 아니라 통계 창을 가리킨다", () => {
    expect(parityCopy).toContain(
      "STATS-WEEKS-SSOT-COPY: lib/config/cohort-dates.ts STATS_WEEKS(8) 사본",
    );
    expect(parityCopy).not.toContain("MAX-SHEET-WEEK-SSOT-COPY");
    expect(parityCopy).not.toContain("주차 창(1~MAX_SHEET_WEEK)");
    expect(parityCopy).not.toContain("시트 표현 가능 창(1~10주)");
    expect(parityCopy).not.toContain("N 주차블록 합(1~10주)");
  });

  it("물리 10주 좌표 상한은 별도 SSOT 로 보존한다", () => {
    expect(canonical).toMatch(/export const MAX_SHEET_WEEK\s*=\s*10\s*;/);
    expect(parityCopy).toContain("for (let week = 0; week < 10; week++)");
  });
});
