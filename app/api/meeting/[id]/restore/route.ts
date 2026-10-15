import { NextRequest, NextResponse } from "next/server";
import { getWritableUserEmail,requireStudentViewContext,StudentViewContextError } from "@/auth/identity";
import { restoreDeletedMeeting } from "@/service/meeting-archive";
export async function POST(_request:NextRequest,ctx:{params:Promise<{id:string}>}) {
 try {const view=await requireStudentViewContext();if((await getWritableUserEmail()).toLowerCase()!==view.email.toLowerCase())return NextResponse.json({error:"조회 중인 계정에 저장할 권한이 없어요."},{status:403});
 const origin=_request.headers.get("origin");if(_request.headers.get("sec-fetch-site")==="cross-site"||(origin&&origin!==new URL(process.env.AUTH_URL||process.env.NEXTAUTH_URL||_request.nextUrl.origin).origin))return NextResponse.json({error:"다른 사이트의 요청은 허용하지 않아요."},{status:403});
 const {id}=await ctx.params;if(!id)return NextResponse.json({error:"미팅을 선택해 주세요."},{status:400});const meeting=await restoreDeletedMeeting(view.email,id,view.sheetOverride);return NextResponse.json({ok:true,meeting});}
 catch(error){const code=error instanceof Error?error.message:"";const status=error instanceof StudentViewContextError?error.status:code==="MEETING_ARCHIVE_NOT_FOUND"?404:["MEETING_ARCHIVE_COMPLEX","MEETING_ARCHIVE_PURGED"].includes(code)?409:code==="MEETING_ARCHIVE_UNAVAILABLE"?409:500;return NextResponse.json({error:status===404?"미팅을 찾을 수 없어요.":code==="MEETING_ARCHIVE_PURGED"?"영구삭제한 DB의 미팅은 복원할 수 없어요.":code==="MEETING_ARCHIVE_COMPLEX"?"계약·연결된 미팅 이력이 있어 개별 복원할 수 없어요.":"미팅을 복원하지 못했어요. 잠시 후 다시 시도해 주세요."},{status});}
}
