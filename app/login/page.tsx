/**
 * /login — 로그인 진입 별칭. auth.ts `pages.signIn` 과 구글 캘린더 연결 콜백(세션 만료)이 이리로 보낸다.
 * 로그인 화면 정본은 `/`(LoginScene) 라서 여기서는 화면을 그리지 않고 `/` 로 넘긴다.
 *
 * - Auth.js 가 붙이는 `callbackUrl`(절대/상대 URL)과 우리 `returnTo` 는 경로만 꺼내
 *   safeLoginReturn 으로 다시 검증한다 — 바깥 주소로는 절대 보내지 않는다.
 * - `error` 가 있으면 `loginError=1` 로 넘겨 로그인 화면에 한 줄 안내를 띄운다.
 *   오류 코드 원문은 화면에 옮기지 않는다(사용자에게 의미 없음).
 */
import { redirect } from "next/navigation";
import type { Route } from "next";
import { loginRedirectTarget, type LoginAliasParams } from "@/util/login-return";

export const dynamic = "force-dynamic";

export default async function LoginAliasPage({
  searchParams,
}: {
  searchParams?: Promise<LoginAliasParams>;
}) {
  redirect(loginRedirectTarget((await searchParams) ?? {}) as Route);
}
