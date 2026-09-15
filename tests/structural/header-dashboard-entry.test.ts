/**
 * 헤더 «수강생 대시보드» 진입점 회귀 가드.
 *
 * 2026-09-14 사고: 트레이너 화면 헤더의 `← 수강생 대시보드` Link 가 `/dashboard` 로
 * 직행했고, `app/(app)/layout.tsx` 의 트레이너 가드(role=trainer · active ·
 * self-view 아님 → `redirect("/trainer")`)에 그대로 튕겼다. 바로 옆 `RoleViewSwitch`
 * 는 `/api/role-view` 로 self-view 를 세운 뒤 이동하므로 정상 동작한다. 즉 같은 자리에
 * 진입점이 «둘» 이고 그 중 하나만 가드를 지났다.
 *
 * 현재 계약:
 *  1. 수강생 화면은 자격 조회 결과와 무관하게 Link를 표시한다. 트레이너 화면의 dual-role은 안전한 토글만 사용한다.
 *  2. 일반 수강생(canStudent=true, canTrainer=false)은 토글이 안 뜨므로 Link 를 유지한다 — /dashboard
 *     /calendar /contact /db /payment /schedule /updates /captain /claim 의 유일한 복귀 동선이다.
 *  3. 화면 판정은 `roleMode` prop 을 믿지 않는다. 실제로 넘기는 호출부가 한 곳뿐이라
 *     `/trainer` 에서는 undefined 다 → RoleViewSwitch 와 «같은» pathname 폴백을 쓴다.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("헤더 수강생 대시보드 진입점", () => {
  const header = read("components/TopHeader.tsx");

  it("Link 는 조건부다 — 무조건 렌더하면 트레이너가 다시 튕긴다", () => {
    expect(header).toMatch(/\{showStudentDashboardLink && \(\s*<Link href="\/dashboard"/);
  });

  it("학생 권한 확인과 dual-role 트레이너 진입점 중복 방지를 모두 적용한다", () => {
    // 기존 조건은 trainer-only에도 가짜 학생 진입점을 노출했다.
    // 실제 capability/이동 회귀는 components/top-header-regression.test.ts에서 검증한다.
    expect(header).toMatch(/const roleToggleShown\s*=\s*!!trainer\.data\?\.canStudent && !!trainer\.data\?\.canTrainer/);
    expect(header).toMatch(
      /const showStudentDashboardLink\s*=\s*roleView === "student" \|\| \(trainer\.data\?\.canStudent === true &&\s*!roleToggleShown\)/,
    );
  });

  it("화면 판정은 roleMode 가 없을 때 pathname 으로 폴백한다", () => {
    expect(header).toMatch(
      /const roleView\s*=\s*roleMode \?\? \(pathname\?\.startsWith\("\/trainer"\) \? "trainer" : "student"\)/,
    );
  });

  it("폴백 규칙이 RoleViewSwitch 와 같다 — 두 컴포넌트가 다른 화면으로 판정하면 안 된다", () => {
    const sw = read("components/auth/RoleViewSwitch.tsx");
    expect(sw).toMatch(/pathname\.startsWith\("\/trainer"\) \? "trainer" : "student"/);
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
