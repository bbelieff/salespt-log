/**
 * POST /api/admin/set-trainer-dept  { email, department: "trainer"|"management" }
 *
 * 트레이너 row 의 B 컬럼을 "T" 또는 "관리" 로 변경.
 *   - trainer → "T" (담당 배정 대상)
 *   - management → "관리" (담당 배정 제외, 기존 매핑 자동 정리)
 *
 * role 은 trainer 그대로 — 라우팅·인증 영향 없음.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { setTrainerDepartment, findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; department?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }

  const target = String(body.email ?? "").trim();
  const dept = String(body.department ?? "").trim();
  if (!target || (dept !== "trainer" && dept !== "management")) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainer") {
    return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }

  await setTrainerDepartment(target, dept as "trainer" | "management");
  return NextResponse.json({ updated: { email: target, department: dept } });
}
