/**
 * POST /api/admin/set-user-sort-orders — admin only (PR C-1).
 *
 * 드래그 정렬 결과 일괄 반영 — 박스(같은 cohort+team) 내 카드 순서대로
 * 1..N 의 sortOrder 매핑.
 *
 * 요청 body:
 *   { orders: [{ email: string, sortOrder: number }] }
 *
 * 응답:
 *   { updated: number, skipped: number }
 *
 * 보안: admin only. trainer/trainee 호출은 403.
 * 검증: Zod — orders 배열, email/sortOrder 타입.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { setUserSortOrders } from "@/repo/users";

export const dynamic = "force-dynamic";

const Body = z.object({
  orders: z
    .array(
      z.object({
        email: z.string().email(),
        sortOrder: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.format() },
      { status: 400 },
    );
  }
  const result = await setUserSortOrders(parsed.data.orders);
  return NextResponse.json(result);
}
