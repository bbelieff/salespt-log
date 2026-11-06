/**
 * POST /api/admin/link-prep-email { cohort, name, email } — admin only (2026-11-06 belie).
 * 사전등록 줄에 이메일을 바로 연결한다(본인 /claim 과 같은 결과). 0기 코스텝 같은 트레이너 본인 페이지용.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { linkPrepEmail, PrepLinkError } from "@/service/prep-link";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { cohort?: unknown; name?: unknown; email?: unknown };
  try {
    const result = await linkPrepEmail({ cohort: String(body.cohort ?? ""), name: String(body.name ?? ""), email: String(body.email ?? "") });
    revalidateAdminPages();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PrepLinkError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "연결하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  }
}

export const POST = withApiTiming("api/admin/link-prep-email:POST", POST_handler);
