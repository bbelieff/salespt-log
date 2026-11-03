/** 통화 하나의 상태·정리 결과(확인 화면이 몇 초마다 부른다). AI 원답·녹음은 내보내지 않는다. */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCallStatus } from "@/service/call-summary";
import { callResponse } from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => callResponse(req, false, async (who) =>
  ({ call: await getCallStatus(who.email, z.string().uuid().parse((await params).id)) }));
