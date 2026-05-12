/**
 * POST /api/admin/bulk-add-trainee-prep
 *   { items: [{ cohort, name, spreadsheetUrl, assignedTrainer? }, ...] }
 *   — admin only.
 *
 * 일괄 prep row 등록. 각 item 은 addTraineePrepRow 와 동일 인자.
 * 순차 처리 — Sheets API rate limit 안전.
 *
 * 응답: { ok, created, updated, failed: [{cohort,name,error}] }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { getServerAccessToken } from "@/auth/google-token";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { addTraineePrepRow, extractSpreadsheetId } from "@/repo/users-prep";
import { shareSheetWithServiceAccount } from "@/repo/drive-client";

interface Item {
  cohort?: unknown;
  name?: unknown;
  spreadsheetUrl?: unknown;
  assignedTrainer?: unknown;
}

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { items?: Item[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (body.items.length > 100) {
    return NextResponse.json(
      { error: "too_many", hint: "한 번에 최대 100명." },
      { status: 400 },
    );
  }

  // OAuth token 한 번 추출 — 모든 item 의 시트에 SA 자동 공유 trigger 에 사용.
  const userToken = await getServerAccessToken();

  let created = 0;
  let updated = 0;
  let shared = 0;
  let shareSkipped = 0;
  const failed: { cohort: string; name: string; error: string }[] = [];
  const shareFailed: { cohort: string; name: string; error: string }[] = [];

  for (const it of body.items) {
    const cohort = String(it.cohort ?? "").trim();
    const name = String(it.name ?? "").trim();
    const urlOrId = String(it.spreadsheetUrl ?? "").trim();
    const assigned = String(it.assignedTrainer ?? "").trim();
    if (!cohort || !name || !urlOrId) {
      failed.push({ cohort, name, error: "invalid_input" });
      continue;
    }
    const sheetId = extractSpreadsheetId(urlOrId);
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(sheetId)) {
      failed.push({ cohort, name, error: "invalid_spreadsheet_id" });
      continue;
    }
    try {
      const r = await addTraineePrepRow(cohort, name, sheetId, assigned);
      if (r.created) created++;
      else updated++;
    } catch (e) {
      failed.push({
        cohort,
        name,
        error: e instanceof Error ? e.message : "unknown",
      });
      continue;
    }

    // 자동 SA 공유 — admin token 있을 때만.
    if (userToken) {
      const s = await shareSheetWithServiceAccount(sheetId, userToken);
      if (s.shared) shared++;
      else shareFailed.push({ cohort, name, error: s.error ?? "unknown" });
    } else {
      shareSkipped++;
    }
  }

  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    created,
    updated,
    failed,
    shared,
    shareSkipped,
    shareFailed,
    shareHint:
      shareSkipped > 0
        ? "admin OAuth scope 확장이 필요합니다. 로그아웃 후 재로그인하세요."
        : undefined,
  });
}
