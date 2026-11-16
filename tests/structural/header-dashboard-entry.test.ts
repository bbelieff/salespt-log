/**
 * 헤더 «수강생 대시보드» 진입점 회귀 가드.
 *
 * 2026-09-14 사고: 트레이너 화면 헤더의 `← 수강생 대시보드` Link 가 `/dashboard` 로
 * 직행했고, `app/(app)/layout.tsx` 의 트레이너 가드(role=trainer · active ·
 * self-view 아님 → `redirect("/trainer")`)에 그대로 튕겼다. 바로 옆 `RoleViewSwitch`
 * 는 `/api/role-view` 로 self-view 를 세운 뒤 이동하므로 정상 동작한다. 즉 같은 자리에
 * 진입점이 «둘» 이고 그 중 하나만 가드를 지났다.
 *
 * 현재 계약(2026-11-16 belie 「대시보드 버튼은 다른 화면에서도 없애줘」):
 *  1. 헤더에는 `/dashboard` 로 가는 Link 가 «없다». 대시보드 복귀는 사이드 메뉴·메뉴 서랍의 「대시보드」 항목.
 *     → 가드를 못 지나는 직행 진입점이 다시 생기지 않는다.
 *  2. 수강생↔트레이너 이동은 `RoleViewSwitch` 하나 — 두 역할(canStudent && canTrainer) 계정에만 뜬다.
 *  3. 화면 판정은 `roleMode` prop 을 믿지 않는다. 실제로 넘기는 호출부가 한 곳뿐이라
 *     `/trainer` 에서는 undefined 다 → RoleViewSwitch 와 «같은» pathname 폴백을 쓴다.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("헤더 수강생 대시보드 진입점", () => {
  const header = read("components/TopHeader.tsx");

  it("헤더에 대시보드 직행 Link 가 없다 — 다시 넣으면 트레이너가 가드에 튕긴다", () => {
    expect(header).not.toMatch(/href="\/dashboard"/);
    expect(header).not.toContain("수강생 대시보드로 이동");
    expect(header).not.toContain("showStudentDashboardLink");
    // 수강생 화면 진입은 역할 토글 하나.
    expect(header).toContain("<RoleViewSwitch modeHint={roleMode} />");
  });

  // 2026-10-19 구조 개선 ⑨: 판정은 components/auth/nav-entitlements.ts 하나 — 헤더와 역할 전환이 같이 부른다.
  const ent = read("components/auth/nav-entitlements.ts");

  it("판정은 한 곳에서 받고, 토글 조건은 두 역할이며, 대시보드 링크 판정은 없다", () => {
    // 실제 capability/이동 회귀는 components/top-header-regression.test.ts에서 검증한다.
    expect(header).toMatch(/headerEntitlements\(\{ me: me\.data, trainer: trainer\.data, pathname, roleMode \}\)/);
    expect(ent).toMatch(/const roleToggleShown\s*=\s*!!trainer\?\.canStudent && !!trainer\?\.canTrainer/);
    expect(ent).not.toContain("showStudentDashboardLink");
  });

  it("화면 판정은 roleMode 가 없을 때 pathname 으로 폴백한다", () => {
    expect(ent).toMatch(/return hint \?\? \(pathname\?\.startsWith\("\/trainer"\) \? "trainer" : "student"\)/);
    expect(ent).toMatch(/const roleView = viewModeFor\(pathname, roleMode\)/);
  });

  it("폴백 규칙이 RoleViewSwitch 와 같다 — 두 컴포넌트가 다른 화면으로 판정하면 안 된다", () => {
    const sw = read("components/auth/RoleViewSwitch.tsx");
    expect(sw).toMatch(/viewModeFor\(pathname,\s*modeHint\)/);
  });

  it("토글 렌더 조건이 RoleViewSwitch 의 실제 가드와 일치한다", () => {
    const sw = read("components/auth/RoleViewSwitch.tsx");
    // RoleViewSwitch 가 이 가드를 바꾸면 TopHeader 의 roleToggleShown 도 같이 바뀌어야 한다.
    expect(sw).toMatch(/if \(!data\?\.canStudent \|\| !data\.canTrainer\) return null/);
  });

  it("트레이너 가드는 그대로 둔다 — P14 빈 대시보드 방지가 근거다", () => {
    const layout = read("app/(app)/layout.tsx");
    expect(layout).toMatch(/role === "trainer" && u\.status === "active" && !\(await isArenaSelfView\(\)\)/);
    expect(layout).toMatch(/redirect\("\/trainer"\)/);
  });
});
