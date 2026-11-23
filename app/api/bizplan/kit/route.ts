/** 사업계획서 작성도구 — 공식 빌더·양식 정보(이름·판·수정일). 파일 내용은 [kind] 주소로 받는다. */
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { canUseBizplan, getBizplanKitInfo } from "@/service/bizplan-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401, headers });
  if (!(await canUseBizplan(email))) return NextResponse.json({ error: "경영일지 이용자만 쓸 수 있어요." }, { status: 403, headers });
  return NextResponse.json(await getBizplanKitInfo(email), { headers });
}
