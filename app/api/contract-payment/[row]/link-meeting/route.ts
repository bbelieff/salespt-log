/**
 * /api/contract-payment/[row]/link-meeting — 「영업기록 없이 추가」 업체를 영업기록 미팅에 연결.
 *   GET  ?meetingId=  → 비교 자료(두 쪽 값 + 마지막 저장 시각) — 화면이 최근 쪽을 기본으로 고른다.
 *   POST { meetingId, 업체명, 수임비, 업체정보 } → 연결(02 행 재사용 — 새 행 없음).
 * 쓰기는 학생 컨텍스트와 getWritableUserEmail의 대상 일치를 모두 요구한다.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContractLinkError, linkMeetingToContract, previewMeetingLink } from "@/service";
import {
  getWritableUserEmail,
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

const RowParam = z.coerce.number().int().min(3);
const LinkBody = z.object({
  meetingId: z.string().min(1),
  업체명: z.string().trim().min(1).max(100),
  수임비: z.number().int().min(0),
  업체정보: z.record(z.string(), z.unknown()).default({}),
});

interface RouteContext {
  params: Promise<{ row: string }>;
}

function fail(e: unknown) {
  if (e instanceof StudentViewContextError) {
    return NextResponse.json(
      { error: e.code, code: e.code },
      { status: e.status },
    );
  }
  if (e instanceof ContractLinkError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : "unknown";
  return NextResponse.json({ error: msg }, { status: 500 });
}

async function GET_handler(req: NextRequest, ctx: RouteContext) {
  try {
    const { email } = await requireStudentViewContext();
    const row = RowParam.safeParse((await ctx.params).row);
    const meetingId = req.nextUrl.searchParams.get("meetingId") ?? "";
    if (!row.success || !meetingId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return NextResponse.json(await previewMeetingLink(email, row.data, meetingId));
  } catch (e) {
    return fail(e);
  }
}

async function POST_handler(req: NextRequest, ctx: RouteContext) {
  try {
    const { email } = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "student_write_target_mismatch", code: "student_write_target_mismatch" },
        { status: 403 },
      );
    }
    const row = RowParam.safeParse((await ctx.params).row);
    const body = LinkBody.safeParse(await req.json().catch(() => null));
    if (!row.success || !body.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const result = await linkMeetingToContract(email, { row: row.data, ...body.data });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}

export const GET = withApiTiming("api/contract-payment/[row]/link-meeting:GET", GET_handler);
export const POST = withApiTiming("api/contract-payment/[row]/link-meeting:POST", POST_handler);
