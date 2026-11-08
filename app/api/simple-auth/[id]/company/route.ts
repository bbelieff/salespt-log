/** 연결한 DB 의 지금 업체정보 — 「업체정보에 반영」 비교표의 「지금 값」. */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { currentCompanyInfo } from "@/service/simple-auth";
import { withWho } from "../../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  withWho(req, false, async (who) => {
    const id = z.string().uuid().parse((await params).id);
    const biz = z.string().min(1).max(20).parse(req.nextUrl.searchParams.get("biz"));
    return currentCompanyInfo(who, id, biz);
  });
