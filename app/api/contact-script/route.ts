/**
 * /api/contact-script — 로그인한 본인의 컨택 대본·문자양식.
 * GET: 고친 글(없으면 기본) · PUT {script, sms}: 저장 · DELETE: 기본 대본으로.
 * 대상은 늘 세션 이메일 — 다른 사람 대본은 읽거나 고칠 수 없다.
 */
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { getContactScript, resetContactScript, saveContactScript } from "@/service";
import { ContactScript } from "@/types";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

async function run(fn: (email: string) => Promise<unknown>) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await fn(email), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "대본을 불러오거나 저장하지 못했어요. 다시 시도해 주세요." }, { status: 503 });
  }
}

async function GET_handler() {
  return run(getContactScript);
}

async function PUT_handler(req: Request) {
  const parsed = ContactScript.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "대본이 너무 길거나 형식이 맞지 않아요." }, { status: 400 });
  return run((email) => saveContactScript(email, parsed.data));
}

async function DELETE_handler() {
  return run(resetContactScript);
}

export const GET = withApiTiming("api/contact-script:GET", GET_handler);
export const PUT = withApiTiming("api/contact-script:PUT", PUT_handler);
export const DELETE = withApiTiming("api/contact-script:DELETE", DELETE_handler);
