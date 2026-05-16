/**
 * POST /api/admin/diagnose-sheet — 개별 trainee 시트 진단.
 * 본문: { email: string }. 반환: DiagnosticResult[] (정상이면 빈 배열).
 *
 * read-only — 시트 수정 없음. 안전.
 */
import { NextResponse } from "next/server";
import { isAdminEmail, getSessionEmail } from "@/auth/identity";
import { findUserByEmail } from "@/repo/users";
import { diagnoseSheet } from "@/service/sheet-diagnostics";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let email: string;
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body.email ?? "").trim().toLowerCase();
    if (!email) throw new Error("email 필요");
  } catch (e) {
    return NextResponse.json(
      { error: `bad request: ${e instanceof Error ? e.message : "json parse"}` },
      { status: 400 },
    );
  }
  const user = await findUserByEmail(email);
  if (!user || !user.spreadsheetId) {
    return NextResponse.json(
      { error: `사용자 ${email} 의 spreadsheetId 없음` },
      { status: 404 },
    );
  }
  try {
    const results = await diagnoseSheet(user.spreadsheetId);
    return NextResponse.json({ email, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
