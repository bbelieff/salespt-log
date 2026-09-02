/**
 * POST /api/daily/move → 하루치 지표를 다른 날짜·채널로 옮긴다.
 *
 * 컨택관리 「잘못 적었어요」의 서버 쪽. 옮길 양은 **원본 현재값으로 깎여서** 적용되므로
 * 음수가 나올 수 없다. 미팅 행 자체(예약일·채널)는 호출부가 PATCH /api/meeting/:id 로
 * 따로 옮긴다 — 그래야 미팅 없는 「숫자만 옮기기」도 같은 엔드포인트를 쓴다.
 *
 * 받지 않는 것: **생산**(미팅과 짝이 아님), **미팅예약**(카드 수 파생, ADR-0010).
 * SSOT: docs/plans/active/contact-record-move.md
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Channel } from "@/types";
import { moveDailyMetrics } from "@/service";
import { getWritableUserEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

const Metrics = z.object({
  production: z.number().int().nonnegative(),
  inflow: z.number().int().nonnegative(),
  contactProgress: z.number().int().nonnegative(),
  meetingReservation: z.number().int().nonnegative(),
});

const Place = z.object({
  date: ISODate,
  channel: Channel,
  /** 화면이 들고 있는 값(저장 안 한 입력 포함). 없으면 서버가 그 날짜를 읽는다. */
  metrics: Metrics.optional(),
});

const Body = z.object({
  from: Place,
  to: Place,
  deltas: z.object({
    inflow: z.number().int().nonnegative().optional(),
    contactProgress: z.number().int().nonnegative().optional(),
  }),
});

async function POST_handler(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { from, to } = parsed.data;
    if (from.date === to.date && from.channel === to.channel) {
      return NextResponse.json(
        { error: "옮길 자리가 지금 자리와 같아요" },
        { status: 400 },
      );
    }
    const email = await getWritableUserEmail();
    const result = await moveDailyMetrics(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.startsWith("[no-sheet]")) {
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withApiTiming("api/daily/move:POST", POST_handler);
