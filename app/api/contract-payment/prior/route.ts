/**
 * POST /api/contract-payment/prior — 이전(아레나 시작 전) 계약업체 직접 등록.
 * 미팅 출발이 아닌 직접 append + 구분=이월 강제(실무·수납 관리용). body = ContractPayment.
 * 본인(수강생) 호출 — 자기 시트. (arena-start-revenue-split §A)
 */
import { NextRequest, NextResponse } from "next/server";
import { ContractPayment } from "@/types";
import { addPriorContract } from "@/service";
import {
  getWritableUserEmail,
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

// 학생 컨텍스트 오류와 기존 쓰기 권한 결정은 각각 보존한다.
function studentContextFailure(error: unknown) {
  return error instanceof StudentViewContextError
    ? NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      )
    : null;
}

async function POST_handler(req: NextRequest) {
  try {
    const { email } = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "student_write_target_mismatch", code: "student_write_target_mismatch" },
        { status: 403 },
      );
    }
    const body = await req.json();
    const parsed = ContractPayment.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    // 직접 등록은 자동연동(04 미팅)이 없으므로 계약일·업체명 필수.
    if (!parsed.data.계약일.trim() || !parsed.data.업체명.trim()) {
      return NextResponse.json(
        { error: "계약일·업체명을 입력해주세요." },
        { status: 400 },
      );
    }
    const result = await addPriorContract(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const denied = studentContextFailure(e);
    if (denied) return denied;
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/contract-payment/prior:POST", POST_handler);
