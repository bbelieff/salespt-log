/**
 * GET /api/export → 로그인한 사용자 본인 기록 xlsx 다운로드 (BBE-71, R7-#22).
 *
 * 인증 = getCurrentUserEmail()(dashboard route 와 동일 패턴) — 세션의 실제 사용자만,
 * 파라미터로 타 사용자 이메일을 넘길 방법 자체가 없다(URL 에 이메일 없음).
 */
import { NextResponse } from "next/server";
import { getCurrentUserEmail } from "@/auth/stub";
import {
  buildExportWorkbookData,
  exportFileName,
  serializeExportWorkbook,
} from "@/service/export-xlsx";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  try {
    const email = await getCurrentUserEmail();
    const data = await buildExportWorkbookData(email);
    const buf = serializeExportWorkbook(data);
    const fileName = exportFileName();
    const enc = encodeURIComponent(fileName);
    // Buffer<ArrayBufferLike> 는 BodyInit(Uint8Array<ArrayBuffer>) 과 타입이 안 맞는다 — 복사해 맞춘다.
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // RFC 5987 filename* — 한글 파일명 안전(company-info/export route 와 동일 관례).
        "Content-Disposition": `attachment; filename="${enc}"; filename*=UTF-8''${enc}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.startsWith("[auth]")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/export:GET", GET_handler);
