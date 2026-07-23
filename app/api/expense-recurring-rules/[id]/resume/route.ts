import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resumeRecurringExpense } from "@/service/expense-ledger";
import { getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";
const Body = z.object({ resumedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
async function POST_handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const p = Body.safeParse(await req.json().catch(() => ({}))); if (!p.success || !p.data.resumedOn) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const { id } = await ctx.params; if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); return NextResponse.json({ rule: await resumeRecurringExpense(await getWritableUserEmail(), id, p.data.resumedOn) }); } catch (e) { return expenseError(e); } }
export const POST = withApiTiming("expense_ledger_recurring_resume:POST", POST_handler);
