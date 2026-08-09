/**
 * 구조 테스트 — `values.append` 열밀림 사고 재발 방지 (BBE-97).
 *
 * `spreadsheets.values.append` 는 Sheets 가 "테이블" 범위를 스스로 탐지해서 그
 * 오른쪽/아래에 붙인다. 빈 A열 행이 있거나 과거 넓은 테이블 흔적이 남아 있으면
 * 의도한 열이 아닌 곳에 기록된다 — 같은 사고가 두 번 났다(2026-06-14 클레임 행
 * H열~ 밀림 · 2026-08-05 A2 registry 54명분 S~AL 열 밀림). 문서·주석만으로는
 * 새 코드가 다시 이 함수를 쓰는 걸 막지 못한다 — 이 테스트가 그 기계 가드다.
 *
 * 정본 수정 패턴(claim-append-columns, lib/repo/users-claim.ts): 현재 데이터
 * 행 수를 읽어 `nextRegistryRowNumber()`로 다음 행 번호를 계산하고, `values.update`
 * 로 `A{n}`(첫 컬럼 좌표)부터 고정 배열을 쓴다 — Sheets 의 테이블 자동탐지를
 * 아예 거치지 않는다.
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
  "`values.append` 는 테이블 자동탐지로 열이 밀린다(2026-06-14·2026-08-05 사고). " +
  "현재 데이터 행 수를 읽어 nextRegistryRowNumber(rows.length)로 다음 행 번호를 " +
  "계산한 뒤 `values.update(range: 'A{n}')` 로 고정 좌표에 써라 " +
  "(정본 패턴: lib/repo/users-claim.ts:nextRegistryRowNumber, lib/repo/registry-row.ts). " +
  "정말 안전한 append(레지스트리 아닌 전용 로그·명단 탭)라면 이 테스트 상단 " +
  "EXEMPT 목록에 사유 한 줄과 함께 추가해라 — 새로 추가하는 면제는 리뷰에서 근거를 요구한다.";

// ── 면제 목록 (사유 한 줄씩, docs/.ssot-grandfathered.md 와 같은 정신) ──────
// 새 PR 이 여기 추가하는 항목은 사유가 빈약하면 반려 대상. 이 목록은 줄어드는
// 방향이 정상 — 정말 안전한 것만 남는다.
const EXEMPT_LIB_FILES = new Set<string>([
  // appendArenaRoster(rosterSheetId, ...) — 레지스트리(users/cohorts)가 아니라
  // 아레나 참가자 명단용 별도 시트(admin 사전 생성, A~D 4열 고정). BBE-55 PR 판단 계승.
  "lib/repo/cohorts.ts",
]);
const EXEMPT_SCRIPT_FILES = new Set<string>([
  // 레지스트리(users/cohorts)가 아니라 'updates' 탭(새소식 팝업 로그) 전용 append.
  // 카드 본문 경고: "새소식 적재 같은 단순 로그성 append 까지 막으면 과잉이다."
  "scripts/append-updates.mjs",
  "scripts/backfill-updates.mjs",
]);

describe("sheets values.append 열밀림 가드 (BBE-97)", () => {
  it("lib/repo/** 는 appendRows()·values.append() 직접 호출을 쓰지 않는다 — 면제 목록 제외", () => {
    const files = walk(join(ROOT, "lib", "repo"), /\.ts$/);
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      // sheets-client.ts 는 appendRows()·values.append() 의 정의 그 자체(정본 wrapper).
      // 여기서 스캔하는 건 "호출부"이지 정의가 아니다.
      if (rel === "lib/repo/sheets-client.ts") continue;
      if (EXEMPT_LIB_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (/\bappendRows\s*\(/.test(src) || /\.values\.append\s*\(/.test(src)) {
        violations.push(rel);
      }
    }
    expect(violations, `values.append 열밀림 위험 — ${REMEDIATION}`).toEqual([]);
  });

  it("scripts/** 는 spreadsheets.values.append() 직접 호출을 쓰지 않는다 — 면제 목록 제외", () => {
    const files = walk(join(ROOT, "scripts"), /\.mjs$/);
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (EXEMPT_SCRIPT_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (/\.values\.append\s*\(/.test(src)) violations.push(rel);
    }
    expect(violations, `values.append 열밀림 위험 — ${REMEDIATION}`).toEqual([]);
  });

  it("면제 목록의 각 항목은 실제로 그 파일에 존재한다 (죽은 면제 방지)", () => {
    for (const rel of [...EXEMPT_LIB_FILES, ...EXEMPT_SCRIPT_FILES]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(
        /\bappendRows\s*\(/.test(src) || /\.values\.append\s*\(/.test(src),
        `${rel} 이 면제 목록에 있지만 append 호출이 더 이상 없다 — 면제 항목을 지워라(줄어드는 목록 원칙).`,
      ).toBe(true);
    }
  });
});
