import { NextResponse } from "next/server";
import { recruitmentAction, recruitmentWriteAllowed, RecruitmentError } from "@/service/trainer-recruitment";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(req: Request) {
  if (!recruitmentWriteAllowed(req)) return NextResponse.json({ error: "요청 출처를 확인해 주세요." }, { status: 403, headers });
  try {
    if (Number(req.headers.get("content-length")) > 2048) throw new RecruitmentError(400, "입력을 확인해 주세요.");
    const text = await req.text();
    if (text.length > 2048) throw new RecruitmentError(400, "입력을 확인해 주세요.");
    return NextResponse.json(await recruitmentAction(JSON.parse(text)), { headers });
  } catch (error) {
    const status = error instanceof RecruitmentError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return NextResponse.json({ error: error instanceof RecruitmentError ? error.message : "요청을 처리하지 못했습니다." }, { status, headers });
  }
}

export async function GET() {
  try {
    const { trainerStatus } = await import("@/service/trainer-status");
    const state = await trainerStatus();
    return NextResponse.json(state ?? { error: "로그인이 필요합니다." }, { status: state ? 200 : 401, headers });
  } catch {
    return NextResponse.json({ error: "신청 정보를 불러오지 못했습니다." }, { status:503, headers });
  }
}
