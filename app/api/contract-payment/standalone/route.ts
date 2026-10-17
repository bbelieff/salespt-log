/**
 * POST /api/contract-payment/standalone — 「영업기록 없이 업체추가」(payment-standalone-company).
 * 실무/수납에서 04 미팅 없이 계약 업체를 만든다. 이월을 강제하지 않는다(매출 귀속은 계약일로
 * isCarryoverContract 가 가른다). body = { 계약일, 업체명, 수임비, requestKey(uuid) }.
 * requestKey 는 폼을 열 때 한 번 만들어 재시도에도 같게 보낸다 → 같은 행 upsert(중복 0).
 * 권한 = prior와 동일(학생 컨텍스트와 getWritableUserEmail의 대상 일치).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addStandaloneContract } from "@/service";
import {
  getWritableUserEmail,
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

const StandaloneContractBody = z.object({
  계약일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "계약일을 다시 골라 주세요."),
  업체명: z.string().trim().min(1, "업체명을 입력해주세요.").max(100, "업체명은 100자까지 적을 수 있어요."),
  수임비: z.number().int().min(0),
  requestKey: z.string().uuid(),
});

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
    const parsed = StandaloneContractBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid_input" },
        { status: 400 },
      );
    }
    const result = await addStandaloneContract(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/contract-payment/standalone:POST", POST_handler);
