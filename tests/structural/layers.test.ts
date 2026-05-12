/**
 * Structural tests — 레이어 경계와 Sheets 격리를 기계적으로 강제.
 * 실패 메시지는 "어떻게 고치는지"까지 포함한다 (remediation-as-error).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");

// ── 레이어 정의 (낮은 → 높은) ─────────────────────────────────
const LAYERS = ["types", "config", "repo", "service"] as const;
type Layer = (typeof LAYERS)[number];
const RANK: Record<Layer, number> = { types: 0, config: 1, repo: 2, service: 3 };

const SHEETS_PACKAGES = ["googleapis", "google-auth-library", "gspread"];

// ── 파일 수집 ────────────────────────────────────────────────
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const re = /(?:^|\s)(?:import|from)\s+['"]([^'"]+)['"]/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) names.push(m[1]!);
  return names;
}

function layerOf(importPath: string): Layer | null {
  // 경로별칭 @/types, @/config, @/repo, @/service
  const alias = importPath.match(/^@\/(types|config|repo|service)(?:\/|$)/);
  if (alias) return alias[1] as Layer;
  const rel = importPath.match(/lib\/(types|config|repo|service)(?:\/|$)/);
  if (rel) return rel[1] as Layer;
  return null;
}

// ── 테스트 1: 레이어는 상위를 import 할 수 없다 ─────────────
describe("layer direction", () => {
  for (const layer of LAYERS) {
    it(`${layer} → 상위 레이어 import 금지`, () => {
      const dir = join(ROOT, "lib", layer);
      const files = walk(dir);
      const violations: string[] = [];
      for (const file of files) {
        for (const imp of importsOf(file)) {
          const other = layerOf(imp);
          if (!other || other === layer) continue;
          if (RANK[other] > RANK[layer]) {
            violations.push(`${relative(ROOT, file)} → ${imp}`);
          }
        }
      }
      expect(
        violations,
        `레이어 위반. 상위 레이어를 import 하지 마세요.\n` +
          `→ 고치는 법: 공통 로직을 Service 로 올리거나, 의존을 역전하세요. ` +
          `참고: docs/architecture.md\n` +
          violations.map((v) => "  • " + v).join("\n"),
      ).toEqual([]);
    });
  }
});

// ── 테스트 2: googleapis 는 오직 lib/repo/ 에서만 ──────────
describe("sheets isolation", () => {
  it("googleapis / google-auth 는 lib/repo/ 전용", () => {
    const bad: string[] = [];
    for (const dir of ["lib/types", "lib/config", "lib/service", "app", "components"]) {
      const abs = join(ROOT, dir);
      let files: string[] = [];
      try {
        files = walk(abs);
      } catch {
        continue;
      }
      for (const file of files) {
        for (const imp of importsOf(file)) {
          if (SHEETS_PACKAGES.some((p) => imp === p || imp.startsWith(p + "/"))) {
            bad.push(`${relative(ROOT, file)} imports ${imp}`);
          }
        }
      }
    }
    expect(
      bad,
      `Sheets 격리 위반 — googleapis 는 lib/repo/ 전용.\n` +
        `→ 고치는 법: Repo 에 메서드를 추가해 호출을 위임하고, ` +
        `호출부는 Zod 모델만 받도록 하세요. ` +
        `참고: docs/architecture.md#퍼시스턴스-google-sheets\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ── 테스트 3: 탭1(대시보드) 범위에 쓰기 금지 ────────────────
describe("dashboard is read-only", () => {
  it("lib/repo 에서 SHEET_RANGES.dashboard 범위로 append/update 하지 않는다", () => {
    const dir = join(ROOT, "lib/repo");
    const bad: string[] = [];
    for (const file of walk(dir)) {
      const src = readFileSync(file, "utf8");
      // "SHEET_RANGES.dashboard" 를 쓰기 API 근처에서 쓰면 의심
      if (
        /SHEET_RANGES\.dashboard/.test(src) &&
        /(appendRows|values\.append|values\.update|batchUpdate)/.test(src)
      ) {
        bad.push(relative(ROOT, file));
      }
    }
    expect(
      bad,
      `대시보드 탭은 수식이 계산하므로 쓰기 금지.\n` +
        `→ 고치는 법: 쓰기는 sales(E~H 입력영역) / meetings / payments / retro 섹션으로만. ` +
        `참고: docs/architecture.md#퍼시스턴스-google-sheets\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ── 테스트 4: revalidateTag / revalidatePath 는 render-safe 해야 한다 ──
//
// Next.js 15+ 의 Server Component render phase 에서 revalidateTag/Path 를
// 직접 호출하면 throw 한다 (production digest 크래시).
// 사고 이력: 2026-05-12 /admin/cohorts digest 4050334537 — ensureCohortsTab
// 이 server component 에서 호출되며 revalidateTag(COHORTS_TAG) throw.
//
// 가드 정책: revalidateTag/revalidatePath 호출 라인은 반드시 try/catch 블록
// 안에 있어야 한다. lib/, app/, components/ 전 영역 적용.
// 면제: 테스트/스크립트 파일.
describe("render-safe revalidations", () => {
  it("revalidateTag/Path 호출 라인은 try/catch 로 감싸야 한다", () => {
    const scanDirs = ["lib", "app", "components"];
    const bad: string[] = [];
    for (const d of scanDirs) {
      const abs = join(ROOT, d);
      let files: string[] = [];
      try {
        files = walk(abs);
      } catch {
        continue;
      }
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        const lines = src.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          // import 라인 제외.
          if (/^\s*import\b/.test(line)) continue;
          // 주석 라인 제외 — //, /*, *, * ... */
          if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
          // 코드 위치를 분석하기 위해 인라인 // 주석 제거 후 검사.
          const codeOnly = line.replace(/\/\/.*$/, "");
          if (!/\b(revalidateTag|revalidatePath)\s*\(/.test(codeOnly)) continue;
          // 같은 함수 안에 try { ... revalidate* ... } 블록이 있는지 휴리스틱:
          // 호출 라인 직전 20줄 안에 `try {` 가 있고, 그 사이 닫는 `}` 갯수 <= `{` 갯수.
          let foundTry = false;
          for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
            const ln = lines[j] ?? "";
            if (/^\s*try\s*\{/.test(ln)) {
              foundTry = true;
              break;
            }
          }
          if (!foundTry) {
            bad.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
          }
        }
      }
    }
    expect(
      bad,
      `revalidateTag / revalidatePath 가 try/catch 없이 호출됨.\n` +
        `→ Next.js 15 Server Component render phase 에서 호출되면 throw.\n` +
        `   디지스트 4050334537 사고와 동일 패턴.\n` +
        `→ 고치는 법: 호출을 try/catch 로 감싸세요. 예시:\n` +
        `     try { revalidateTag("foo"); } catch { /* render context */ }\n` +
        `   참고: lib/repo/cohorts.ts invalidateCohorts() 동일 패턴.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});
