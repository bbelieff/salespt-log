/**
 * GET  /api/company-info?계약일=YYYY-MM-DD&업체명=… → 06 에서 업체정보 read
 * POST /api/company-info { 계약일, 업체명, 업체정보 } → 04 원본 + 06 동기화 저장
 * (payment 계약 카드용 — consultation-log §3-1)
 */
import { NextRequest, NextResponse } from "next/server";
import { CompanyInfo } from "@/types";
import {
  loadCompanyInfoByContract,
  saveCompanyInfoByContract,
} from "@/service/contract-payment";
import {
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

function studentContextFailure(error: unknown) {
  return error instanceof StudentViewContextError
    ? NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      )
    : null;
}

async function GET_handler(req: NextRequest) {
  try {
    const { email } = await requireStudentViewContext();
    const sp = req.nextUrl.searchParams;
    const 계약일 = String(sp.get("계약일") ?? "").trim();
    const 업체명 = String(sp.get("업체명") ?? "").trim();
    if (!계약일 || !업체명) {
      return NextResponse.json({ error: "계약일·업체명 필수" }, { status: 400 });
    }
    const 업체정보 = await loadCompanyInfoByContract(email, { 계약일, 업체명 });
    return NextResponse.json({ 업체정보 });
  } catch (e) {
    const denied = studentContextFailure(e);
    if (denied) return denied;
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function POST_handler(req: NextRequest) {
  try {
    // getWritableUserEmail보다 엄격한 학생-view 권한을 매 요청 다시 검증한다.
    const { email } = await requireStudentViewContext();
    const body = await req.json();
    const 계약일 = String(body?.계약일 ?? "").trim();
    const 업체명 = String(body?.업체명 ?? "").trim();
    const parsed = CompanyInfo.safeParse(body?.업체정보 ?? {});
    if (!계약일 || !업체명 || !parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const result = await saveCompanyInfoByContract(email, {
      계약일,
      업체명,
      업체정보: parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const denied = studentContextFailure(e);
    if (denied) return denied;
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/company-info:GET", GET_handler);
export const POST = withApiTiming("api/company-info:POST", POST_handler);
