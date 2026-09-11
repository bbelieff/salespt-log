import { NextResponse } from "next/server";
import { trainerAdminRequest } from "@/service/trainer-admin-request";
import { RecruitmentError } from "@/service/trainer-recruitment";
export async function POST(req: Request) {
  try { return NextResponse.json(await trainerAdminRequest(req,"department")); }
  catch (error) {
    return NextResponse.json({error: error instanceof RecruitmentError ? error.message : "요청을 처리하지 못했습니다."},
      { status: error instanceof RecruitmentError ? error.status : error instanceof SyntaxError ? 400 : 503 });
  }
}
