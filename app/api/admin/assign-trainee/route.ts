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
  isAdminSynthCandidate,
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

  // 각 trainer 검증.
  //   (1) registry row 가 trainer 면 OK
  //   (2) ADMIN_EMAILS 멤버는 registry row 유무·role 과 무관하게 OK
  //       (마스터는 트레이너처럼 담당 받음. role="admin" row 가 있어도 동일.)
  //
  // 사고 (2026-05-14): 1차 fix 는 `!t && isAdminSynthCandidate(te)` 였는데
  // beliefkimkim 이 registry 에 role="admin" row 가 존재 → t 가 truthy →
  // 1차 fix 가 안 먹어서 not_trainer 재발. (2) 는 row state 무관하게 통과.
  for (const te of trainerEmails) {
    const t = await findUserByEmail(te);
    const isTrainerRow = !!t && t.role === "trainer";
    const isAdminEmail = isAdminSynthCandidate(te);
    if (!isTrainerRow && !isAdminEmail) {
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
