/**
 * POST /api/admin/reject-trainer  { email }  — admin only.
 * pending(or active) 트레이너 row 를 registry 에서 물리 삭제.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { deleteUserByEmail, findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { email?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  const target = String(body.email ?? "").trim();
  if (!target) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainer") {
    return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }
  await deleteUserByEmail(target);
  revalidateAdminPages();
  return NextResponse.json({ rejected: target });
}
