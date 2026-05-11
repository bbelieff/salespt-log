/**
 * POST /api/admin/set-trainer-dept  { email, department: "trainer"|"management" }
 *
 * 트레이너 row 의 B 컬럼을 "T" 또는 "관리" 로 변경.
 * role 은 trainer 그대로.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { adminEmails, adminNames } from "@/config";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
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

  // registry 에 row 있어야 함 — 다만 admin email 은 row 없어도 OK (synth admin 케이스).
  const u = await findUserByEmail(target);
  const targetLc = target.toLowerCase();
  const isAdminTarget = adminEmails().includes(targetLc);
  if (!u && !isAdminTarget) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (u && u.role !== "trainer" && !isAdminTarget) {
    return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }

  // synth admin 의 경우 ADMIN_NAMES 의 이름을 fallback 으로 전달.
  const fallbackName = adminNames()[targetLc];
  await setTrainerDepartment(target, dept as "trainer" | "management", {
    fallbackName,
  });
  revalidateAdminPages();
  return NextResponse.json({ updated: { email: target, department: dept } });
}
