/**
 * POST /api/admin/set-arena-captain  { email, cohort, on:boolean } — admin only.
 *
 * 아레나 참가자(role=trainee 유지)를 그 기수(A{n}-{m}) 회장으로 지정/해제.
 * registry R(captain_of) 에 cohort(정규화) 또는 "" 기록. role 은 건드리지 않음.
 * (set-trainer-dept 패턴. §6/ADR-0014)
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { setArenaCaptain, isArenaCohort } from "@/repo/users-arena";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; cohort?: string; on?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  const cohort = String(body.cohort ?? "").trim();
  const on = body.on === true;
  if (!email || (on && !isArenaCohort(cohort))) {
    return NextResponse.json(
      { error: "invalid_input", hint: "email + 아레나 cohort(A{n}-{m}) 필요." },
      { status: 400 },
    );
  }
  try {
    await setArenaCaptain(email, cohort, on);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 404 },
    );
  }
  revalidateAdminPages();
  return NextResponse.json({ updated: { email, captainOf: on ? cohort : "" } });
}
