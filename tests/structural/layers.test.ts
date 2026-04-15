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
        `→ 고치는 법: 쓰기는 daily / contracts / db 섹션으로만. ` +
        `참고: docs/architecture.md#퍼시스턴스-google-sheets\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});
