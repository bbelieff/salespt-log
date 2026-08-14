/**
 * 구조 테스트 — `values.append` 열밀림 사고 재발 방지 (BBE-97).
 *
 * 레지스트리 users/cohorts는 현재 데이터 행 수를 읽고 `values.update(A{n})`로
 * 결정적 좌표에 써야 한다. 전용 로그·명단 탭의 안전한 append만 사유와 함께 면제한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");

function walk(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, pattern));
    else if (pattern.test(name)) out.push(full);
  }
  return out;
}

const REMEDIATION =
  "레지스트리 append는 nextRegistryRowNumber(rows.length)와 values.update(range: 'A{n}')를 사용하라. " +
  "레지스트리가 아닌 전용 로그·명단 탭만 사유와 함께 EXEMPT 목록에 추가할 수 있다.";

const EXEMPT_LIB_FILES = new Set<string>([
  // appendArenaRoster는 레지스트리가 아닌 별도 아레나 참가자 명단 A:D 전용이다.
  "lib/repo/cohorts.ts",
]);

const EXEMPT_SCRIPT_FILES = new Set<string>([
  // 새소식 팝업의 append-only updates 로그 탭 전용이다.
  "scripts/append-updates.mjs",
  "scripts/backfill-updates.mjs",
]);

describe("sheets values.append 열밀림 가드 (BBE-97)", () => {
  it("lib/repo/** 호출부는 appendRows()·values.append()를 쓰지 않는다 — 면제 제외", () => {
    const violations: string[] = [];
    for (const file of walk(join(ROOT, "lib", "repo"), /\.ts$/)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (rel === "lib/repo/sheets-client.ts" || EXEMPT_LIB_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (/\bappendRows\s*\(/.test(src) || /\.values\.append\s*\(/.test(src)) violations.push(rel);
    }
    expect(violations, REMEDIATION).toEqual([]);
  });

  it("scripts/**는 spreadsheets.values.append()를 쓰지 않는다 — 면제 제외", () => {
    const violations: string[] = [];
    for (const file of walk(join(ROOT, "scripts"), /\.mjs$/)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (EXEMPT_SCRIPT_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (/\.values\.append\s*\(/.test(src)) violations.push(rel);
    }
    expect(violations, REMEDIATION).toEqual([]);
  });

  it("면제 목록은 실제 append 호출이 남아 있는 파일만 포함한다", () => {
    for (const rel of [...EXEMPT_LIB_FILES, ...EXEMPT_SCRIPT_FILES]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(
        /\bappendRows\s*\(/.test(src) || /\.values\.append\s*\(/.test(src),
        `${rel} 면제가 죽었다 — 목록에서 제거하라.`,
      ).toBe(true);
    }
  });
});
