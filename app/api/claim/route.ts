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
import { revalidatePath } from "next/cache";
import { getCurrentUserEmail } from "@/auth/stub";
import { claimAccount, ClaimError } from "@/service/auth";
import { revalidateAdminPages } from "@/auth/revalidate-admin";

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
  // 수강생: 숫자. 트레이너: "T"/"t" (claimAccount 가 cohort=T 면 trainer pending 으로 등록).
  if (
    !cohortStr ||
    !nameStr ||
    !/^(\d+|[Tt])$/.test(cohortStr.replace(/기\s*$/, ""))
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const result = await claimAccount(email, cohortStr, nameStr);
    // claim 후 캐시 즉시 무효화:
    //   - admin 페이지: 승인 대기 섹션 즉시 노출.
    //   - 홈 페이지("/"): claim 성공한 사용자가 router.push("/") 후 server
    //     component 다시 실행될 때 fresh registry 데이터 — 옛 캐시면 findUserByEmail
    //     null → redirect("/claim") 무한 루프 (2026-05-13 사고).
    //   - /claim: 자기 자신도 무효화 (다시 진입 시 fresh).
    //   - layout 레벨로 호출 — 전체 트리.
    revalidateAdminPages();
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ClaimError) {
      return NextResponse.json({ error: e.reason }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
