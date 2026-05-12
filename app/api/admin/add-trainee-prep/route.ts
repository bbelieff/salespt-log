/**
 * POST /api/admin/add-trainee-prep
 *   { cohort: string|number, name: string, spreadsheetUrl: string,
 *     assignedTrainer?: string }
 *   — admin only.
 *
 * 신규 수강생 prep row 사전 등록.
 *   - spreadsheetUrl 은 URL 또는 raw ID 둘 다 OK (extractSpreadsheetId 가 파싱).
 *   - 같은 (cohort, name) row 있으면 D 컬럼만 갱신 (시트 변경).
 *   - 없으면 새 row append.
 *
 * 본인이 /claim 에서 같은 (cohort, name) 입력 시 → email 만 채워져서 즉시 active.
 * Drive 시트 이름 정확 일치 검사 우회 — admin 이 명시적 매핑.
 *
 * 시트 공유 정책 (2026-05-12):
 *   - SA 자동 공유는 OAuth drive scope 가 필요하지만, 그 scope 가 모든 사용자에게
 *     sensitive 권한 동의를 강제 + Testing 모드 외부 사용자 차단.
 *   - 운영 방식 변경: admin 이 Drive 폴더 하나에 모든 시트를 모으고 그 폴더를
 *     SA email 과 공유 (편집자) → 그 폴더 안 시트는 자동 권한 상속.
 *   - 코드 자동화 제거 — 사용자/수강생 OAuth drive scope 동의 요청 0.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { addTraineePrepRow, extractSpreadsheetId } from "@/repo/users-prep";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    cohort?: unknown;
    name?: unknown;
    spreadsheetUrl?: unknown;
    assignedTrainer?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const cohort = String(body.cohort ?? "").trim();
  const name = String(body.name ?? "").trim();
  const urlOrId = String(body.spreadsheetUrl ?? "").trim();
  const assigned = String(body.assignedTrainer ?? "").trim();

  if (!cohort || !name || !urlOrId) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const spreadsheetId = extractSpreadsheetId(urlOrId);
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(spreadsheetId)) {
    return NextResponse.json(
      {
        error: "invalid_spreadsheet_id",
        hint: "스프레드시트 URL 또는 ID 가 올바른지 확인하세요.",
      },
      { status: 400 },
    );
  }

  const result = await addTraineePrepRow(cohort, name, spreadsheetId, assigned);
  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    cohort,
    name,
    spreadsheetId,
    created: result.created,
  });
}
