/** GET /api/version — 지금 서버에서 돌고 있는 빌드 버전명(next.config 의 NEXT_PUBLIC_APP_VERSION). 새 버전 알림용, 개인정보 없음. */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ version: process.env.NEXT_PUBLIC_APP_VERSION ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
