/**
 * POST /api/admin/create-cohort-members — admin only. BBE-70(R7-#21) — DB-only 재작성.
 *
 * ⚠️ 이 라우트는 BBE-69(시트 미러 폐기) 완료 전까지 **머지 보류**(belie 지시, 2026-08-10).
 * 설계 근거·머지 조건 = `docs/plans/active/cohort-create-db-insert.md`.
 *
 * body: { token: string, members: [{name}], courseStartISO?: string }
 *   (구 필드 mode/config/sheetUrl 은 무시 — 프런트가 여전히 보내도 안전, 시트가 없는 세상엔
 *   의미가 없다)
 *
 * 옛 흐름(Drive 파일복사 + 폴더생성 + 레지스트리 시트쓰기 + O1/O2 기록 + 복사실패 재시도큐)을
 * 단일 DB upsert 로 대체 — 개인 시트 자체가 없으므로 복제할 대상도, 실패할 Drive 호출도 없다.
 * 폴백 없음: dbEnabled()=false 면 503(ADR-0030 §2 — R7-#21 이후 신규 기수는 시트가 없다).
 *
 * 멱등: (cohort, name) 이 이미 DB 에 있으면 skip. 부분 실패 허용 — 한 명 실패해도 나머지 진행.
 *
 * 응답 계약은 구 라우트와 동일하게 유지(프런트 `CohortCreateModal.tsx` 무변경) —
 * `pending`·`dates` 는 이 흐름에 존재하지 않는 개념이라 항상 빈 배열(정확한 표현이지 결손 아님).
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { parseCohortToken } from "@/service/cohort-token";
import { decideMemberDbAction } from "@/service/cohort-create-db";
import { isValidISODate, computeGraduationISO } from "@/service/cohort-dates";
import { dbEnabled } from "@/repo/db/client";
import { findUserByCohortName, upsertUserRow, upsertCohortCells } from "@/repo/db/registry";
import { withApiTiming } from "@/lib/analytics/api-timing";

interface MemberInput {
  name?: unknown;
}

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "db_unavailable", hint: "DATABASE_URL 미설정 — 이 흐름은 시트 폴백이 없습니다." },
      { status: 503 },
    );
  }

  let body: { token?: unknown; members?: unknown; courseStartISO?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const courseStartISO = String(body.courseStartISO ?? "").trim();
  if (courseStartISO && !isValidISODate(courseStartISO)) {
    return NextResponse.json(
      { error: "invalid_input", hint: "수강시작일은 YYYY-MM-DD 형식이어야 합니다." },
      { status: 400 },
    );
  }
  const graduationISO = courseStartISO ? computeGraduationISO(courseStartISO) : "";

  const parsed = parseCohortToken(String(body.token ?? ""));
  if (!parsed) {
    return NextResponse.json(
      { error: "invalid_token", hint: '기수 토큰 형식: "8" / "8기" / "a1" / "A1회"' },
      { status: 400 },
    );
  }
  const members = Array.isArray(body.members) ? (body.members as MemberInput[]) : [];
  if (members.length === 0) {
    return NextResponse.json({ error: "no_members" }, { status: 400 });
  }
  if (members.length > 100) {
    return NextResponse.json(
      { error: "too_many", hint: "한 번에 최대 100명." },
      { status: 400 },
    );
  }

  // 기수 자체를 존재시킨다 — 부분 upsert(status/note 는 안 건드림, 클로버링 방지).
  await upsertCohortCells(parsed.label, {
    type: parsed.type,
    ...(courseStartISO ? { season_start_iso: courseStartISO } : {}),
  });

  const created: { name: string }[] = [];
  const skipped: { name: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const m of members) {
    const name = String(m.name ?? "").trim();
    try {
      const existing = name ? await findUserByCohortName(parsed.label, name) : null;
      const plan = decideMemberDbAction({ name, existingUser: existing !== null });

      if (plan.action === "skip") {
        skipped.push({ name: plan.name });
        continue;
      }
      if (plan.action === "fail") {
        failed.push({ name: plan.name, reason: plan.reason });
        continue;
      }

      await upsertUserRow({
        email: "",
        cohort: parsed.label,
        name,
        spreadsheetId: "",
        role: "trainee",
        status: "active",
        assignedTrainer: "",
        team: "",
        cohortLabel: parsed.display,
        nameLabel: name,
        courseStartISO,
        graduationISO,
        sortOrder: 0,
        driveParentPath: "",
        feedbackFolderId: "",
        driveLinkStatus: "",
        memo: "",
        captainOf: "",
        gcalToken: "",
        gcalSettings: "",
      });
      created.push({ name });
    } catch (e) {
      failed.push({
        name: name || String(m.name ?? ""),
        reason: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    label: parsed.label,
    display: parsed.display,
    type: parsed.type,
    created,
    skipped,
    failed,
    pending: [],
    dates: [],
  });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/create-cohort-members:POST", POST_handler);
