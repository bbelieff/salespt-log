/**
 * POST /api/admin/assign-trainee  — admin only.
 *
 * 두 모드 (한 endpoint 통합):
 *
 *  1) 다중 배정 (권장, 신규):
 *     { traineeEmail: string, trainerEmails: string[] }
 *     → registry G 컬럼을 통째로 교체. 빈 배열이면 담당 해제.
 *
 *  2) 단일 배정 (legacy 호환):
 *     { traineeEmail: string, trainerEmail: string }
 *     → trainerEmail="" 면 해제.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  setTraineeAssignments,
  findUserByEmail,
} from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    traineeEmail?: string;
    trainerEmail?: string;
    trainerEmails?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const trainee = String(body.traineeEmail ?? "").trim();
  if (!trainee) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const u = await findUserByEmail(trainee);
  if (!u || u.role !== "trainee") {
    return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  }

  // 입력 모드 통합 → 배열로 정규화.
  let trainerEmails: string[];
  if (Array.isArray(body.trainerEmails)) {
    trainerEmails = body.trainerEmails
      .map((e) => String(e ?? "").trim())
      .filter(Boolean);
  } else {
    const single = String(body.trainerEmail ?? "").trim();
    trainerEmails = single ? [single] : [];
  }

  // 각 trainer 존재 + role=trainer 검증.
  for (const te of trainerEmails) {
    const t = await findUserByEmail(te);
    if (!t || t.role !== "trainer") {
      return NextResponse.json(
        { error: "not_trainer", invalid: te },
        { status: 404 },
      );
    }
  }

  await setTraineeAssignments(trainee, trainerEmails);
  revalidateAdminPages();
  return NextResponse.json({ assigned: { trainee, trainers: trainerEmails } });
}
