/**
 * GET   /api/contract-payment   → ContractPayment[] (모든 row)
 * POST  /api/contract-payment   → 새 row append (자동 연동: 계약일/업체명/수임비)
 * PATCH /api/contract-payment   → 매칭 row(계약일+업체명)의 E열(수임비) sync update.
 *                                 매칭 row 없으면 { synced: false } 반환 (신규 row 생성 X).
 *
 * 일정·계약 탭에서 계약 액션 시:
 *  - 예약 → 계약 (신규):       POST  (row 생성)
 *  - 계약 → 계약 (수임비 수정): PATCH (기존 row의 E열만 sync)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addFromContract,
  loadContractPayments,
  syncContractFee,
} from "@/service";
import { getWritableUserEmail } from "@/auth/identity";

const ContractFeeBody = z.object({
  계약일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  업체명: z.string().min(1, "업체명 필수"),
  수임비: z.number().nonnegative(),
});

export async function GET() {
  try {
    const email = await getWritableUserEmail();
    const rows = await loadContractPayments(email);
    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ContractFeeBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = await getWritableUserEmail();
    const result = await addFromContract(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ContractFeeBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = await getWritableUserEmail();
    const result = await syncContractFee(email, parsed.data);
    if (!result) {
      return NextResponse.json({ ok: true, synced: false });
    }
    return NextResponse.json({ ok: true, synced: true, row: result.row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
