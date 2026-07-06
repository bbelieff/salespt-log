/**
 * POST /api/admin/remove-trainee  { email }  — admin only.
 *
 * Trainee registry row 물리 삭제.
 * UI 가드: "유보" 상태일 때만 노출 — 정규 명단에서 바로 퇴출 방지 (실수 방지).
 * Google 시트 자체와 권한은 건드리지 않음 (사용자 데이터 보호).
 *
 * 참고: trainer 퇴출은 /api/admin/remove-trainer (담당 trainee 매핑 cleanup 동반).
 * trainee 는 매핑 cleanup 불필요 (G 컬럼은 자기 자신의 데이터).
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  findUserByEmail,
  removeTraineeCompletely,
  isReservedTrainee,
} from "@/repo/users";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const target = String(body.email ?? "").trim();
  if (!target)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainee") {
    return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  }
  // 안전 가드: 유보 상태만 퇴출 허용. 정규 명단에서 실수로 못 지움.
  if (!isReservedTrainee(u)) {
    return NextResponse.json(
      { error: "must_reserve_first", hint: "먼저 유보 처리 후 퇴출 가능합니다." },
      { status: 409 },
    );
  }

  await removeTraineeCompletely(target);
  revalidateAdminPages();
  return NextResponse.json({ removed: target });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/remove-trainee:POST", POST_handler);
