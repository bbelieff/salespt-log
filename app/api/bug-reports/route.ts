/** POST /api/bug-reports — 로그인한 사람의 오류신고 한 건 접수(2026-10-25). */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionEmail } from "@/auth/identity";
import { BugReportLimit, submitBugReport } from "@/service/bug-reports";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function post(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    return NextResponse.json(await submitBugReport(email, body), { status: 201 });
  } catch (error) {
    if (error instanceof BugReportLimit) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof ZodError) return NextResponse.json({ error: "신고 내용을 확인해 주세요. 캡처가 너무 크면 빼고 보내 주세요." }, { status: 400 });
    return NextResponse.json({ error: "신고를 보내지 못했어요. 잠시 뒤 다시 시도하거나 카톡으로 알려 주세요." }, { status: 503 });
  }
}
export const POST = withApiTiming("api/bug-reports:POST", post);
