/**
 * POST /api/setup → 사용자 시트에 자동 집계 수식 일괄 설치.
 *
 * 한 번만 호출하면 04 업체관리(N/O/Q) + 01 영업관리(I~P) 수식이 박힘.
 * 멱등(idempotent) — 재호출 안전.
 *
 * 사용법:
 *   curl -X POST http://localhost:3000/api/setup
 */
import { NextResponse } from "next/server";
import { findUserByEmail } from "@/repo/users";
import { installFormulas } from "@/repo/setup-formulas";
import { getCurrentUserEmail } from "@/auth/stub";

export async function POST() {
  try {
    const email = getCurrentUserEmail();
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: `등록되지 않은 사용자: ${email}` },
        { status: 404 },
      );
    }
    const report = await installFormulas(user.spreadsheetId);
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
