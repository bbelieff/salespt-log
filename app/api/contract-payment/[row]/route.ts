/**
 * PATCH  /api/contract-payment/:row  → 사용자 입력 영역(F~AA) update
 * DELETE /api/contract-payment/:row  → row 통째로 clear
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContractPayment } from "@/types";
import {
  patchContractPayment,
  removeContractPayment,
  removeContractPaymentWithCascade,
} from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const RowParam = z.coerce.number().int().min(3);

interface RouteContext {
  params: Promise<{ row: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { row } = await ctx.params;
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json(
        { error: "row 정수 필수 (≥3)" },
        { status: 400 },
      );
    }
    const body = await req.json();
    // body는 ContractPayment 형태. URL의 row를 권위로 사용.
    const merged = { ...body, row: rowParsed.data };
    const parsed = ContractPayment.safeParse(merged);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = await getCurrentUserEmail();
    await patchContractPayment(email, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const { row } = await ctx.params;
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json(
        { error: "row 정수 필수 (≥3)" },
        { status: 400 },
      );
    }
    const email = await getCurrentUserEmail();
    // 2026-05-17 [3]: ?cascade=meeting 이면 매칭 미팅 계약→예약 revert
    const cascade = req.nextUrl.searchParams.get("cascade") === "meeting";
    if (cascade) {
      const result = await removeContractPaymentWithCascade(
        email,
        rowParsed.data,
      );
      return NextResponse.json({ ok: true, ...result });
    }
    await removeContractPayment(email, rowParsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
