import { NextResponse } from "next/server";
import { changeRoleView } from "@/service/role-view";
import { recruitmentWriteAllowed, RecruitmentError } from "@/service/trainer-recruitment";
export async function POST(req: Request) {
  const headers = {"Cache-Control":"private, no-store"};
  if (!recruitmentWriteAllowed(req)) return NextResponse.json({error:"요청 출처를 확인해 주세요."},{status:403,headers});
  try {
    const text = await req.text();
    if (text.length > 1024) throw new RecruitmentError(400,"입력을 확인해 주세요.");
    return NextResponse.json(await changeRoleView(JSON.parse(text)),{headers});
  } catch(error) {
    return NextResponse.json({error:error instanceof RecruitmentError ? error.message : "화면을 전환하지 못했습니다."},{status:error instanceof RecruitmentError ? error.status : error instanceof SyntaxError ? 400 : 503,headers});
  }
}
