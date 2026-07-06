/**
 * POST /api/admin/fix-sheet — 진단된 이슈에 대한 자동 fix 실행.
 * 본문: { email: string, ruleId: string }. 반환: { summary: string }.
 *
 * fix 는 룰마다 다름. installFormulas (raw 값 보존) 등.
 */
import { NextResponse } from "next/server";
import { isAdminEmail, getSessionEmail } from "@/auth/identity";
import { findUserByEmail } from "@/repo/users";
import { fixSheet } from "@/service/sheet-diagnostics";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let email: string;
  let ruleId: string;
  try {
    const body = (await req.json()) as { email?: string; ruleId?: string };
    email = String(body.email ?? "").trim().toLowerCase();
    ruleId = String(body.ruleId ?? "").trim();
    if (!email || !ruleId) throw new Error("email + ruleId 필요");
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
    const result = await fixSheet(user.spreadsheetId, ruleId);
    return NextResponse.json({ email, ruleId, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/fix-sheet:POST", POST_handler);
