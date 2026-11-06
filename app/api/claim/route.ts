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
import { claimAccount, ClaimError } from "@/service/auth";
import { isClaimableCohort } from "@/service/cohort-token";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";

async function POST_handler(req: Request) {
  // 클레임은 항상 로그인한 본인 계정으로 — 대리 보기 쿠키(salespt_as)를 따르면 트레이너가 [웹앱]으로
  // 수강생 화면을 연 뒤 /claim 할 때 그 수강생 계정으로 처리돼 아무것도 등록되지 않는다(2026-11-06 0기 코스텝).
  const email = await getSessionEmail().catch(() => null);
  if (!email) {
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
  // 수강생: 숫자. 트레이너: "T"/"t". 아레나: "A{시즌}-{기수}기" (claim 페이지 valid 와 일치).
  if (!cohortStr || !nameStr || !isClaimableCohort(cohortStr)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    // 관리자 본인 시험 계정(0기 GM) — 트레이너 행이 있어도 사전등록 수강생 행을 클레임(2026-10-06).
    const result = await claimAccount(email, cohortStr, nameStr, { isAdmin: isAdminEmail(email) });
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

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/claim:POST", POST_handler);
