/**
 * POST /api/contract-payment/edit-linked
 *   계약 핵심필드(업체명·계약일·수임료) 편집 + 미팅 id 기반 02↔04↔06 양방향 연동.
 *   응답 failures = 실패한 시트명 배열(반쪽 동기화 침묵 금지 — 클라가 토스트로 안내).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { editContractLinkedFields } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const Body = z.object({
  meetingId: z.string().optional(),
  old: z.object({ 계약일: z.string(), 업체명: z.string() }),
  next: z.object({
    계약일: z.string().optional(),
    업체명: z.string().optional(),
    수임비: z.number().nonnegative().optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getCurrentUserEmail();
    const { failures } = await editContractLinkedFields(email, parsed.data);
    return NextResponse.json({ ok: failures.length === 0, failures });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
