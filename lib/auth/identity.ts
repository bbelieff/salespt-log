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
import { findUserByEmail, parseAssignedTrainers } from "@/repo/users";

const AS_COOKIE = "salespt_as";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * 실제 로그인한 사용자 email (impersonation 무시).
 *
 * STUB_USER_EMAIL fallback 은 **dev 전용** — 프로덕션에서 이게 살아있으면
 * 미들웨어(쿠키 기반)와 server component(STUB fallback) 간 인증 판정이 어긋나
 * `/` ↔ `/admin` 무한 리다이렉트 루프 발생. (incident: 2026-05-11 ERR_TOO_MANY_REDIRECTS)
 */
export async function getSessionEmail(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.email) return session.user.email;
  if (process.env.NODE_ENV !== "production" && process.env.STUB_USER_EMAIL) {
    return process.env.STUB_USER_EMAIL;
  }
  return null;
}

export type EffectiveRole = "admin" | "trainer" | "trainee";

/**
 * 관리부서 멤버 — registry trainer row 중 B 컬럼(cohort)="관리".
 * 권한: /admin/users, /admin/trainers, /admin/cohorts **조회 가능** (편집 X).
 */
export async function isManagementMember(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const u = await findUserByEmail(email);
  return (
    !!u &&
    u.role === "trainer" &&
    u.status === "active" &&
    u.cohort.trim() === "관리"
  );
}

/** admin OR management — 조회 권한 게이트. */
export async function canViewAdminPages(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  return isManagementMember(email);
}

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

/**
 * impersonation 권한 게이트.
 *   - 본인 (self): OK
 *   - admin: 누구든
 *   - active trainer: 자기가 (다중) 담당 매핑에 포함된 trainee 만
 *
 * 2026-05-11: 단일 매칭 (===) → parseAssignedTrainers().includes() 로 수정.
 */
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
  return parseAssignedTrainers(target.assignedTrainer).includes(
    sessionEmail.toLowerCase(),
  );
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
