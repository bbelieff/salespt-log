/**
 * POST /api/admin/set-trainer-dept  { email, department: "trainer"|"management" }
 *
 * 트레이너 row 의 B 컬럼을 "T" 또는 "관리" 로 변경.
 * role 은 trainer 그대로.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  setTrainerDepartment,
  findUserByEmail,
  isAdminSynthCandidate,
} from "@/repo/users";

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

  // 케이스 1: registry 에 있는 trainer row → 그대로 진행.
  // 케이스 2: ADMIN_EMAILS 멤버 → row state·role 무관하게 진행 (synth 면 자동 row 생성).
  //   beliefkimkim 처럼 registry 에 role="admin" row 가 있는 경우도 포함.
  //   이전엔 `!u && isAdminSynthCandidate` 였는데 admin row 있으면 u truthy 라
  //   가드 fail → not_trainer 사고 (PR #182 와 같은 패턴, 다른 endpoint).
  // 그 외 (수강생이거나 미등록 일반인) → 404.
  const u = await findUserByEmail(target);
  const isTrainerRow = !!u && u.role === "trainer";
  const isAdmin = isAdminSynthCandidate(target);
  if (!isTrainerRow && !isAdmin) {
    return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }

  await setTrainerDepartment(target, dept as "trainer" | "management");
  revalidateAdminPages();
  return NextResponse.json({ updated: { email: target, department: dept } });
}
