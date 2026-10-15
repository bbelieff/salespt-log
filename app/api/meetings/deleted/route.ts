import { NextResponse } from "next/server";
import { getWritableUserEmail,requireStudentViewContext,StudentViewContextError } from "@/auth/identity";
import { deletedMeetings } from "@/service/meeting-archive";
export async function GET(){try{const view=await requireStudentViewContext();const canRestore=(await getWritableUserEmail()).toLowerCase()===view.email.toLowerCase();return NextResponse.json({meetings:await deletedMeetings(view.email,view.sheetOverride),canRestore},{headers:{"Cache-Control":"no-store"}});}catch(error){return NextResponse.json({error:"삭제한 미팅을 불러오지 못했어요."},{status:error instanceof StudentViewContextError?error.status:500});}}
