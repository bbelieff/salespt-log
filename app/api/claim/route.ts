/**
 * POST /api/claim  → Self-claim (기수 + 이름 → Drive 검색 → 시트 매칭).
 *
 * Request:  { cohort: number|string, name: string }
 * Response:
 *   200 { email, cohort, name, spreadsheetId }     — 매칭 성공
 *   400 { error: "invalid_input" }                 — 입력 부족·형식 오류
 *   401 { error: "unauthenticated" }               — 로그인 X
 *   404 { error: "not_found" }                     — 매칭 시트 없음
 *   500 { error: ... }                             — 기타
 */
import { NextResponse } from "next/server";
import { getCurrentUserEmail } from "@/auth/stub";
import { claimAccount, ClaimError } from "@/service/auth";

export async function POST(req: Request) {
  let email: string;
  try {
    email = await getCurrentUserEmail();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { cohort, name } = (body ?? {}) as { cohort?: unknown; name?: unknown };
  const cohortStr = String(cohort ?? "").trim();
  const nameStr = String(name ?? "").trim();
  if (!cohortStr || !nameStr || !/^\d+$/.test(cohortStr.replace(/기\s*$/, ""))) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const result = await claimAccount(email, cohortStr, nameStr);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ClaimError) {
      return NextResponse.json({ error: e.reason }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
