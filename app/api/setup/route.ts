/**
 * POST   /api/setup → 사용자 시트에 자동 집계 수식 일괄 설치 (안전 모드).
 * DELETE /api/setup → 모든 설치 수식 제거 (사용자 합계행은 별도 복구 필요).
 *
 * 멱등(idempotent) — 재호출 안전.
 *
 * 사용법:
 *   설치: Invoke-RestMethod -Uri http://localhost:3000/api/setup -Method POST
 *   제거: Invoke-RestMethod -Uri http://localhost:3000/api/setup -Method DELETE
 */
import { NextResponse } from "next/server";
import { findUserByEmail } from "@/repo/users";
import { installFormulas, uninstallFormulas } from "@/repo/setup-formulas";
import { getCurrentUserEmail } from "@/auth/stub";

async function resolveSpreadsheetId(): Promise<string> {
  const email = getCurrentUserEmail();
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

export async function POST() {
  try {
    const spreadsheetId = await resolveSpreadsheetId();
    const report = await installFormulas(spreadsheetId);
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const spreadsheetId = await resolveSpreadsheetId();
    const report = await uninstallFormulas(spreadsheetId);
    return NextResponse.json({
      ok: true,
      ...report,
      note: "v1 installer가 깨뜨린 합계행 SUM 수식은 자동 복원 안 됨. 시트에서 직접 재입력 필요.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
