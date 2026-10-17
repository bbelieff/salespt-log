/**
 * GET /api/export → 로그인한 사용자 본인 기록 xlsx 다운로드 (BBE-71, R7-#22).
 *
 * 인증 = fail-closed 수강생 보기 context. 본인·담당 수강생·arena 자기보기의
 * 해석된 CRM 대상만 내보내고, 무효하거나 선택되지 않은 대상은 저장소 조회 전 거부한다.
 */
import { NextResponse } from "next/server";
import {
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import {
  buildExportWorkbookData,
  exportFileName,
  serializeExportWorkbook,
} from "@/service/export-xlsx";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  try {
    const { email } = await requireStudentViewContext();
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
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.startsWith("[auth]")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/export:GET", GET_handler);
