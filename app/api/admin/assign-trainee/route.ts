/**
 * POST /api/admin/assign-trainee  { traineeEmail, trainerEmail }  — admin only.
 * 수강생에게 담당 트레이너 배정 (registry G 컬럼 갱신).
 * trainerEmail="" → 배정 해제.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { assignTrainerToTrainee, findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { traineeEmail?: string; trainerEmail?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  const trainee = String(body.traineeEmail ?? "").trim();
  const trainer = String(body.trainerEmail ?? "").trim();
  if (!trainee) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const u = await findUserByEmail(trainee);
  if (!u || u.role !== "trainee") return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  if (trainer) {
    const t = await findUserByEmail(trainer);
    if (!t || t.role !== "trainer") return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }
  await assignTrainerToTrainee(trainee, trainer);
  return NextResponse.json({ assigned: { trainee, trainer: trainer || null } });
}
