/**
 * POST /api/contract-payment/:row/terminate — 계약해지 (contract-termination).
 * 사유 필수 · 반환(없음/일부/전액)=반환액 원 · 숨김=soft delete(데이터·반환 차감 보존).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { terminateContract } from "@/service";
import { getWritableUserEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

const RowParam = z.coerce.number().int().min(3);
const Body = z.object({
  사유: z.string().min(1, "해지 사유를 입력해 주세요"),
  반환액: z.number().nonnegative().default(0),
  숨김: z.boolean().default(false),
});

interface RouteContext {
  params: Promise<{ row: string }>;
}

async function POST_handler(req: NextRequest, ctx: RouteContext) {
  try {
    const { row } = await ctx.params;
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json({ error: "row 정수 필수 (≥3)" }, { status: 400 });
    }
    const body = Body.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: body.error.message }, { status: 400 });
    }
    const email = await getWritableUserEmail();
    await terminateContract(email, { row: rowParsed.data, ...body.data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withApiTiming(
  "api/contract-payment/[row]/terminate:POST",
  POST_handler,
);
