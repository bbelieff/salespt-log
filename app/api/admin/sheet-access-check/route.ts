/**
 * GET /api/admin/sheet-access-check — admin only.
 *
 * 등록된 모든 trainee row 의 spreadsheetId 에 Service Account 가 실제로 read
 * 가능한지 일괄 점검. 진단 도구 — 사용자가 "왜 안 들어가지지" 의문 시 즉시
 * 어떤 시트가 권한 부족인지 표시.
 *
 * 응답:
 *   {
 *     serviceAccountEmail: string,    // admin 이 수동 공유 시 사용
 *     hasOAuthToken: boolean,         // false 면 admin 재로그인 필요
 *     sheets: [
 *       { email, name, cohort, sheetId, accessOk: bool, error?: string }
 *     ],
 *     summary: { total, ok, forbidden, notFound, other }
 *   }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { getServerAccessToken } from "@/auth/google-token";
import { listAllUsers } from "@/repo/users";
import { sheetsClient } from "@/repo/sheets-client";
import { serviceAccount } from "@/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sa = serviceAccount();
  const userToken = await getServerAccessToken();

  const all = await listAllUsers();
  const trainees = all.filter((u) => u.role === "trainee" && u.spreadsheetId);
  // 중복 시트 (multi-account) 는 한 번만 테스트, 모든 row 에 결과 매핑.
  const sheetIds = Array.from(new Set(trainees.map((u) => u.spreadsheetId)));

  const resultsBySheetId = new Map<
    string,
    { accessOk: boolean; error?: string }
  >();
  for (const sheetId of sheetIds) {
    try {
      // 가장 가벼운 read 호출 — meta(properties.title) 만.
      await sheetsClient().spreadsheets.get({
        spreadsheetId: sheetId,
        fields: "properties.title",
      });
      resultsBySheetId.set(sheetId, { accessOk: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      resultsBySheetId.set(sheetId, { accessOk: false, error: msg });
    }
  }

  const sheets = trainees.map((u) => {
    const r = resultsBySheetId.get(u.spreadsheetId) ?? { accessOk: false };
    return {
      email: u.email,
      name: u.name,
      cohort: u.cohort,
      sheetId: u.spreadsheetId,
      accessOk: r.accessOk,
      error: r.error,
    };
  });

  const summary = {
    total: sheets.length,
    ok: sheets.filter((s) => s.accessOk).length,
    forbidden: sheets.filter(
      (s) => !s.accessOk && /forbidden|permission|403/i.test(s.error ?? ""),
    ).length,
    notFound: sheets.filter(
      (s) => !s.accessOk && /not found|404/i.test(s.error ?? ""),
    ).length,
    other: 0,
  };
  summary.other =
    summary.total - summary.ok - summary.forbidden - summary.notFound;

  return NextResponse.json({
    serviceAccountEmail: sa.client_email,
    hasOAuthToken: !!userToken,
    sheets,
    summary,
  });
}
