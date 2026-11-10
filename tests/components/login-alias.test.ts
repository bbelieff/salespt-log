/**
 * /login 별칭 회귀 테스트 — docs/plans/completed/login-alias.md.
 * auth.ts `pages.signIn`·구글 캘린더 콜백이 보내던 /login 이 404 였다.
 * 별칭은 바깥 주소로 보내지 않고(경로만 꺼내 safeLoginReturn 재검증), 오류면 안내 플래그를 붙인다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loginRedirectTarget } from "@/util/login-return";

describe("loginRedirectTarget — /login 별칭", () => {
  it("아무것도 없으면 첫 화면", () => {
    expect(loginRedirectTarget({})).toBe("/");
  });
  it("오류면 안내 플래그를 붙인다(오류 코드 원문은 옮기지 않는다)", () => {
    expect(loginRedirectTarget({ error: "OAuthCallbackError" })).toBe("/?loginError=1");
  });
  it("Auth.js 의 절대 callbackUrl 은 경로만 꺼내 검증한다", () => {
    expect(loginRedirectTarget({ callbackUrl: "https://example.test/dashboard?d=1" }))
      .toBe("/?returnTo=%2Fdashboard%3Fd%3D1");
  });
  it("허용 목록 밖·프로토콜 상대 주소는 버린다", () => {
    expect(loginRedirectTarget({ callbackUrl: "//evil.test/x" })).toBe("/");
    expect(loginRedirectTarget({ returnTo: "/api/secret" })).toBe("/");
  });
  it("returnTo 가 callbackUrl 보다 우선", () => {
    expect(loginRedirectTarget({ returnTo: "/payment", callbackUrl: "/dashboard" })).toBe("/?returnTo=%2Fpayment");
  });
  it("페이지가 실제로 있고, 로그인 화면이 플래그를 받는다", () => {
    expect(readFileSync("app/login/page.tsx", "utf8")).toContain("loginRedirectTarget");
    expect(readFileSync("app/page.tsx", "utf8")).toContain("loginError={!!params?.loginError}");
    expect(readFileSync("components/auth/LoginScene.tsx", "utf8")).toMatch(/loginError && \(\s*<p role="alert"/);
  });
});
