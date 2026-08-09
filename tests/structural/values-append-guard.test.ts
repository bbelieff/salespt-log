/**
 * BBE-97 — values.append 열밀림 기계 가드.
 *
 * 사고 이력(같은 근인이 2회): 2026-06-14 로그인 무한반송 · 2026-08-05 A2 열밀림
 * (아레나 시즌2 등록 54명이 registry `users!A:T` 대신 `S~AL` 열로 밀려 들어가 loadRegistry()
 * 에서 안 보인 사고 — scripts/ops/arena-season2-batch.mjs 헤더에 근인 기록: 시트에 예전 넓은
 * 테이블의 잔재가 남아있으면 `values.append` 가 호출자의 range 를 무시하고 Sheets 자체
 * "테이블 자동탐지"로 엉뚱한 열에 붙인다). 지금까지 주석 + 개별 리뷰로만 막고 있었다 — 같은
 * 사고가 두 번 나면 skill issue 가 아니라 harness issue 다(CLAUDE.md §0 Hashimoto 원칙).
 *
 * 안전한 대체: read 로 다음 빈 행을 직접 계산해 `values.update` 로 명시 range 에 쓴다
 * (db.ts 의 findFirstEmptyRow + writeRow, arena-season2-batch.mjs 의 appendA2Row 가 이미 이 패턴).
 *
 * 면제(EXEMPT): 사유와 함께 파일 단위로 등록. 새 위반은 면제 없이 무조건 빨간불 —
 * 정말 안전하다는 근거(단일 논리 테이블 + 그 근거)가 있을 때만 사유를 적고 추가한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");

function walk(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, ext));
    else if (ext.test(name)) out.push(full);
  }
  return out;
}

/** 레포 상대경로(/ 구분) → 면제 사유. 이 파일 전체에서 `.values.append(` 가 허용된다. */
const EXEMPT: Record<string, string> = {
  "lib/repo/sheets-client.ts":
    "appendRows() 래퍼의 유일한 정의 지점. 호출자(cohorts.ts·users.ts 등)는 이 함수를 통해서만 " +
    "접근하고, 전부 registry 의 단일 논리 테이블(users A~T·cohorts A~J)만 대상으로 한다 — " +
    "03 DB관리 같은 다중 섹션 탭은 db.ts 가 findFirstEmptyRow+values.update 를 직접 쓴다(면제 대상 아님).",
};

function scan(files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (EXEMPT[rel]) continue;
    const src = readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      if (/\.values\.append\(/.test(line)) violations.push(`${rel}:${i + 1}`);
    });
  }
  return violations;
}

function remediation(violations: string[]): string {
  return (
    `values.append 는 Sheets 의 "테이블 자동탐지"에 의존해 열밀림 사고를 두 번 냈다` +
    `(2026-06-14 로그인 무한반송 · 2026-08-05 A2 열밀림, arena-season2-batch.mjs 헤더 참고).\n` +
    `대신 read 로 다음 빈 행을 직접 계산해 values.update(명시 range)로 쓰세요(db.ts:findFirstEmptyRow 참고).\n` +
    `정말 안전하다고 판단되면(단일 논리 테이블 등 근거 필수) 이 테스트 파일의 EXEMPT 에 사유와 함께 등록하세요.\n` +
    `위반: ${violations.join(", ") || "(없음)"}`
  );
}

describe("values.append 금지 — 열밀림 사고 기계 가드(BBE-97)", () => {
  it("lib/repo/** 에 미승인 values.append 없음", () => {
    const files = walk(join(ROOT, "lib", "repo"), /\.ts$/);
    const violations = scan(files);
    expect(violations, remediation(violations)).toEqual([]);
  });

  it("scripts/ops/** 에 미승인 values.append 없음", () => {
    const files = walk(join(ROOT, "scripts", "ops"), /\.mjs$/);
    const violations = scan(files);
    expect(violations, remediation(violations)).toEqual([]);
  });

  it("면제 목록의 파일이 실제로 존재한다(고아 면제 방지)", () => {
    for (const rel of Object.keys(EXEMPT)) {
      expect(() => statSync(join(ROOT, rel)), `면제된 파일이 없어짐: ${rel}`).not.toThrow();
    }
  });
});
