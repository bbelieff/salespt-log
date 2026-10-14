/**
 * Structural — app/·components/ 는 repo(@/repo) 를 직접 import 하지 않는다 (CLAUDE.md §1·§2: API 라우트는
 * Service 만 호출, 컴포넌트는 Repo 직접 import 금지). layers.test.ts 는 lib/ 4레이어만 보므로 여기서 메운다.
 *
 * 2026-10-15 실사(B7): 이미 직접 import 하는 파일이 있어 GRANDFATHERED 로 박제했다. 새 파일은 면제 없음.
 * 박제 파일이 repo import 를 없애면 목록에서도 지워야 통과한다(목록이 줄어드는 방향으로만 움직이게).
 * `import type` 은 런타임 의존이 아니라 허용.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");

const GRANDFATHERED = new Set<string>([
  "app/(app)/layout.tsx",
  "app/admin/arena/page.tsx",
  "app/admin/cohorts/page.tsx",
  "app/admin/page.tsx",
  "app/admin/trainers/page.tsx",
  "app/admin/users/_components/UsersRoster.tsx",
  "app/api/admin/add-trainee-prep/route.ts",
  "app/api/admin/approve-all-pending-trainees/route.ts",
  "app/api/admin/approve-trainee/route.ts",
  "app/api/admin/assign-trainee/route.ts",
  "app/api/admin/bulk-add-trainee-prep/route.ts",
  "app/api/admin/create-arena-members/route.ts",
  "app/api/admin/create-cohort-members/route.ts",
  "app/api/admin/migrate-registry-cache/route.ts",
  "app/api/admin/reject-trainee/route.ts",
  "app/api/admin/remove-trainee/route.ts",
  "app/api/admin/retry-cohort-creates/route.ts",
  "app/api/admin/set-arena-captain/route.ts",
  "app/api/admin/set-cohort-status/route.ts",
  "app/api/admin/set-season-start/route.ts",
  "app/api/admin/set-trainee-reserved/route.ts",
  "app/api/admin/set-trainee-team/route.ts",
  "app/api/admin/set-user-sort-orders/route.ts",
  "app/api/admin/switch/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/db-sheet/route.ts",
  "app/api/db/[channel]/route.ts",
  "app/api/drive-link/route.ts",
  "app/api/expenses/route.ts",
  "app/api/me/route.ts",
  "app/captain/page.tsx",
  "app/page.tsx",
  "app/trainer/layout.tsx",
  "app/trainer/page.tsx",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** 런타임 repo import 가 있는가 — `import type {…} from "@/repo…"` 는 제외. */
function importsRepo(file: string): boolean {
  const src = readFileSync(file, "utf8");
  const re = /(^|\n)\s*(import|export)(\s+type)?[^;]*?from\s+['"](@\/repo(?:\/[^'"]*)?|[./]+lib\/repo(?:\/[^'"]*)?)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) if (!m[3]) return true;
  return false;
}

const files = ["app", "components"].flatMap((d) => walk(join(ROOT, d)));
const violators = files.map((f) => relative(ROOT, f).replace(/\\/g, "/")).filter((rel) => importsRepo(join(ROOT, rel)));

describe("app·components → repo 직접 import 금지", () => {
  it("새 파일이 repo 를 직접 import 하지 않는다", () => {
    const fresh = violators.filter((v) => !GRANDFATHERED.has(v));
    expect(
      fresh,
      `화면·API 라우트가 repo 를 직접 불렀어요.\n` +
        `→ 고치는 법: lib/service/ 에 유스케이스 함수를 두고 그걸 부르세요(타입만 필요하면 \`import type\`).\n` +
        fresh.map((v) => "  • " + v).join("\n"),
    ).toEqual([]);
  });

  it("박제 목록은 실제 위반만 담는다(고친 파일은 목록에서 지운다)", () => {
    const stale = [...GRANDFATHERED].filter((g) => !violators.includes(g));
    expect(stale, `repo import 가 없어진 파일이에요 — GRANDFATHERED 에서 지우세요:\n${stale.join("\n")}`).toEqual([]);
  });
});
