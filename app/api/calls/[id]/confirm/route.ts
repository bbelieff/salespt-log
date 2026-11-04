/**
 * 「통화 정리 확인」 [저장하기] — 업체정보·상담메모·컨택결과(+미팅 초안이 있으면 미팅카드)를 DB관리시트에 한 번에.
 * 두 번 보내도 한 번(이미 확정이면 {already:true}). 그사이 DB 가 다른 화면에서 바뀌었으면 409.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { confirmCall } from "@/service/call-confirm";
import { callResponse } from "../../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => callResponse(req, true, async (ctx) =>
  confirmCall(ctx, z.string().uuid().parse((await params).id), await req.json()));
