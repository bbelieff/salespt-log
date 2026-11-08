/** 간편인증 요청 한 건 — 승인 확인·다시 보내기·취소·기록 삭제·DB 연결·업체정보 반영. */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { SimpleAuthAction } from "@/types/simple-auth";
import { actSimpleAuth } from "@/service/simple-auth";
import { withWho } from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  withWho(req, true, async (who) => {
    const id = z.string().uuid().parse((await params).id);
    return actSimpleAuth(who, id, SimpleAuthAction.parse(await req.json()));
  });
