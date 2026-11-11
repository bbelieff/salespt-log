/**
 * /api/first-steps — 로그인한 본인의 첫걸음 기억(숨김·다시 보지 않기·끝냄)과 끝낸 단계.
 * GET: { state } (저장한 적 없으면 state=null) · PUT { memory, done }: 저장.
 * 대상은 늘 세션 이메일. 표가 아직 없으면 503 — 화면은 브라우저 기억으로 계속 동작한다.
 */
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { getFirstSteps, saveFirstSteps } from "@/service";
import { FirstStepsState } from "@/types";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

async function run(fn: (email: string) => Promise<unknown>) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json({ state: await fn(email) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

async function GET_handler() {
  return run(getFirstSteps);
}

async function PUT_handler(req: Request) {
  const parsed = FirstStepsState.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return run((email) => saveFirstSteps(email, parsed.data));
}

export const GET = withApiTiming("api/first-steps:GET", GET_handler);
export const PUT = withApiTiming("api/first-steps:PUT", PUT_handler);
