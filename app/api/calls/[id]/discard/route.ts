/** 저장하지 않고 닫기 — 남은 녹음도 지운다. 처리 중·확정된 통화는 못 닫는다. */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { discardCall } from "@/service/call-summary";
import { callResponse } from "../../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => callResponse(req, true, async (who) => {
  await discardCall(who.email, z.string().uuid().parse((await params).id));
});
