/**
 * GET /api/me  → 사용자 프로필 + 매칭 상태.
 *
 * 응답 케이스:
 *   1. 로그인 X                    → 401 { error: "unauthenticated" }
 *   2. 로그인 + registry 미등록    → 200 { status: "needs_claim", email }
 *   3. 로그인 + registry 등록 완료 → 200 MeProfile (기존 형식)
 */
import { NextResponse } from "next/server";
import { loadMe } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";
import { findUserByEmail } from "@/repo/users";

export async function GET() {
  let email: string;
  try {
    email = await getCurrentUserEmail();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // registry 등록 여부 확인 — 미등록이면 needs_claim 으로 응답 (UI 가 /claim 으로 이동)
  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ status: "needs_claim", email }, { status: 200 });
  }

  // 정상 프로필 로드
  try {
    const me = await loadMe(email);
    return NextResponse.json(me);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
