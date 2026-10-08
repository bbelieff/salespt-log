/**
 * POST /api/admin/set-trainee-reserved  { email, reserved: boolean }  — admin only.
 *
 * Trainee 의 유보(reserved) 상태 토글.
 *   - reserved=true  → registry B="유보". /admin/users 의 정규 기수 그룹에서 제외,
 *                        "유보 수강생" 별도 섹션에만 노출.
 *   - reserved=false → registry B="" (복귀). 표시 라벨은 개인 시트 B3 SSOT.
 *
 * 의도: 마스터 본인 계정처럼 명단에서 보기 싫지만 row 는 남겨두고 싶은 trainee
 * 정리. 퇴출(row 삭제) 전 안전한 중간 단계.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  findUserByEmail,
  isReservedTrainee,
  listAllUsers,
  setTraineeReservation,
} from "@/repo/users";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; reserved?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const target = String(body.email ?? "").trim();
  if (!target || typeof body.reserved !== "boolean") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainee") {
    return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  }

  // 한 사람이 여러 이메일로 같은 시트를 쓰면(연결 계정) 함께 유보·복귀한다.
  const emails = await linkedTraineeEmails(target, u.spreadsheetId, body.reserved);
  for (const email of emails) await setTraineeReservation(email, body.reserved);
  revalidateAdminPages();
  return NextResponse.json({
    updated: { email: target, reserved: body.reserved, emails },
  });
}

async function linkedTraineeEmails(
  target: string,
  spreadsheetId: string,
  reserved: boolean,
): Promise<string[]> {
  const emails = new Set([target]);
  if (!spreadsheetId) return [...emails];
  for (const other of await listAllUsers()) {
    if (other.role !== "trainee" || other.spreadsheetId !== spreadsheetId) continue;
    if (isReservedTrainee(other) === reserved) continue;
    emails.add(other.email);
  }
  return [...emails];
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/set-trainee-reserved:POST", POST_handler);
