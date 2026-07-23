import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pauseRecurringExpense } from "@/service/expense-ledger";
import { getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";
const Body = z.object({ pausedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
async function POST_handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const p = Body.safeParse(await req.json().catch(() => ({}))); const { id } = await ctx.params; if (!id || !p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); return NextResponse.json({ rule: await pauseRecurringExpense(await getWritableUserEmail(), id, p.data.pausedOn) }); } catch (e) { return expenseError(e); } }
export const POST = withApiTiming("expense_ledger_recurring_pause:POST", POST_handler);
