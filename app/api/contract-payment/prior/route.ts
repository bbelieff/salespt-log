/**
 * POST /api/contract-payment/prior — 이전(아레나 시작 전) 계약업체 직접 등록.
 * 미팅 출발이 아닌 직접 append + 구분=이월 강제(실무·수납 관리용). body = ContractPayment.
 * 본인(수강생) 호출 — 자기 시트. (arena-start-revenue-split §A)
 */
import { NextRequest, NextResponse } from "next/server";
import { ContractPayment } from "@/types";
import { addPriorContract } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

export async function POST(req: NextRequest) {
  try {
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
    const email = await getCurrentUserEmail();
    const result = await addPriorContract(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
