/** POST /api/bug-reports — 로그인한 사람의 오류신고 한 건 접수(2026-10-25). */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionEmail } from "@/auth/identity";
import { BugReportLimit, submitBugReport } from "@/service/bug-reports";
import { BUG_REPORT_BODY_MAX } from "@/types/bug-report";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tooLarge = () => NextResponse.json({ error: "캡처가 너무 커요. 캡처를 빼거나 작게 해서 보내 주세요." }, { status: 413 });

/** 상한까지만 읽는다 — content-length 를 안 보내는 요청도 넘는 순간 끊는다. 넘으면 null. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function post(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  try {
    const text = await readCapped(req, BUG_REPORT_BODY_MAX);
    if (text === null) return tooLarge();
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { /* 형식 오류 → 아래 입력 검사가 400 */ }
    return NextResponse.json(await submitBugReport(email, body), { status: 201 });
  } catch (error) {
    if (error instanceof BugReportLimit) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof ZodError) return NextResponse.json({ error: "신고 내용을 확인해 주세요. 캡처가 너무 크면 빼고 보내 주세요." }, { status: 400 });
    return NextResponse.json({ error: "신고를 보내지 못했어요. 잠시 뒤 다시 시도하거나 카톡으로 알려 주세요." }, { status: 503 });
  }
}
export const POST = withApiTiming("api/bug-reports:POST", post);
