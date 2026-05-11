/**
 * 인증·신원·권한 헬퍼.
 *
 * 역할:
 *   - admin   (env ADMIN_EMAILS): 모든 사용자 조회·편집
 *   - trainer (registry role=trainer, status=active): 본인 + 담당 수강생
 *   - trainee: 본인만
 *   - pending trainer (status=pending): 승인 대기 화면만
 *
 * Impersonation (cookie `salespt_as`):
 *   - admin: 누구든 OK
 *   - trainer: 자기 담당 수강생만
 *   - trainee: 불가
 */
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { adminEmails } from "@/config";
import { findUserByEmail } from "@/repo/users";

const AS_COOKIE = "salespt_as";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function getSessionEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? process.env.STUB_USER_EMAIL ?? null;
}

export type EffectiveRole = "admin" | "trainer" | "trainee";

/** admin env 우선, 그 다음 registry. 미등록 = trainee. */
export async function getEffectiveRole(
  email: string | null | undefined,
): Promise<{ role: EffectiveRole; status: "active" | "pending" }> {
  if (!email) return { role: "trainee", status: "active" };
  if (isAdminEmail(email)) return { role: "admin", status: "active" };
  const u = await findUserByEmail(email);
  if (!u) return { role: "trainee", status: "active" };
  return { role: u.role, status: u.status };
}

/** impersonation 권한 게이트. */
export async function canImpersonate(
  sessionEmail: string,
  targetEmail: string,
): Promise<boolean> {
  if (sessionEmail.toLowerCase() === targetEmail.toLowerCase()) return true;
  if (isAdminEmail(sessionEmail)) return true;
  const session = await findUserByEmail(sessionEmail);
  if (!session || session.role !== "trainer" || session.status !== "active") return false;
  const target = await findUserByEmail(targetEmail);
  if (!target || target.role !== "trainee") return false;
  return target.assignedTrainer.toLowerCase() === sessionEmail.toLowerCase();
}

/** 현재 작업 대상 — impersonation 적용. 미인증 시 throw. */
export async function getActiveUserEmail(): Promise<string> {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) throw new Error("[auth] 로그인이 필요합니다.");

  const jar = await cookies();
  const as = jar.get(AS_COOKIE)?.value;
  if (!as || !as.includes("@")) return sessionEmail;

  const allowed = await canImpersonate(sessionEmail, as);
  if (!allowed) return sessionEmail;
  return as.toLowerCase();
}

/** admin/trainer 만 impersonation 설정 가능. 권한 위반 시 throw. */
export async function setImpersonation(target: string | null): Promise<void> {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) throw new Error("[auth] 로그인이 필요합니다.");

  const jar = await cookies();
  if (!target) {
    jar.delete(AS_COOKIE);
    return;
  }
  const allowed = await canImpersonate(sessionEmail, target);
  if (!allowed) {
    throw new Error("[auth] 이 사용자를 조회할 권한이 없습니다.");
  }
  jar.set(AS_COOKIE, target.toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
