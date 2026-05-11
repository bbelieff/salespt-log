/**
 * 인증·신원 헬퍼 — Admin impersonation 지원.
 *
 * 두 가지 개념:
 *   - sessionEmail: 실제 로그인한 Google 계정 (NextAuth session)
 *   - activeEmail:  현재 작업 대상 사용자 email
 *     · 일반 사용자: sessionEmail 과 동일
 *     · Admin:      cookie `as=<email>` 있으면 그 사용자, 없으면 sessionEmail
 *
 * 모든 API route 는 `getActiveUserEmail()` 사용. 그러면 admin이 impersonate 한 사용자
 * 데이터를 자동으로 읽고/쓴다. Audit 용으로 sessionEmail 도 별도 얻을 수 있다.
 */
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { adminEmails } from "@/config";

const AS_COOKIE = "salespt_as";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/** 실제 로그인한 사용자 email (impersonation 무시). */
export async function getSessionEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? process.env.STUB_USER_EMAIL ?? null;
}

/**
 * 현재 작업 대상 email — admin 이 다른 사람을 보고 있으면 그 사람.
 * 미인증 시 throw.
 */
export async function getActiveUserEmail(): Promise<string> {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) throw new Error("[auth] 로그인이 필요합니다.");
  if (!isAdminEmail(sessionEmail)) return sessionEmail;

  // Admin: cookie 로 impersonate 대상 확인
  const jar = await cookies();
  const as = jar.get(AS_COOKIE)?.value;
  return as && as.includes("@") ? as.toLowerCase() : sessionEmail;
}

/** Admin only: impersonation cookie set/unset. UI 라우터 핸들러에서 사용. */
export async function setImpersonation(target: string | null): Promise<void> {
  const sessionEmail = await getSessionEmail();
  if (!isAdminEmail(sessionEmail)) {
    throw new Error("[auth] Admin 권한이 필요합니다.");
  }
  const jar = await cookies();
  if (target && target.includes("@")) {
    jar.set(AS_COOKIE, target.toLowerCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일
    });
  } else {
    jar.delete(AS_COOKIE);
  }
}
