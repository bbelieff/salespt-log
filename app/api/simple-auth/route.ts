/** 간편인증 서류 조회 — GET 보낸 인증 목록, POST 새로 보내기(간편인증) 또는 공동인증서로 가져오기. */
import type { NextRequest } from "next/server";
import { listSimpleAuth, simpleAuthReady, startSimpleAuth } from "@/service/simple-auth";
import { withWho } from "./response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => withWho(req, false, async (who) => ({ requests: await listSimpleAuth(who), ready: simpleAuthReady() }));

export const POST = (req: NextRequest) => withWho(req, true, async (who) => ({ request: await startSimpleAuth(who, await req.json()) }));
