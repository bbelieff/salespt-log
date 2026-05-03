/**
 * GET  /api/contract-payment        → ContractPayment[] (모든 row)
 * POST /api/contract-payment        → 새 row append (자동 연동: 계약일/업체명/수임비)
 *
 * 일정·계약 탭에서 계약 액션 시 POST 호출 (fan-out 트랜잭션의 일부).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addFromContract,
  loadContractPayments,
} from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const PostBody = z.object({
  계약일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  업체명: z.string().min(1, "업체명 필수"),
  수임비: z.number().nonnegative(),
});

export async function GET() {
  try {
    const email = getCurrentUserEmail();
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
    const parsed = PostBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = getCurrentUserEmail();
    const result = await addFromContract(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
