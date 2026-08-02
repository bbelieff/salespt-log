import { NextRequest, NextResponse } from "next/server";
import { getActiveUserEmail } from "@/auth/identity";
import { getExpenseCategoryUsageForUser } from "@/service/expense-ledger";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    return NextResponse.json(await getExpenseCategoryUsageForUser(await getActiveUserEmail(), id));
  } catch (e) { return expenseError(e); }
}
export const GET = withApiTiming("expense_ledger_category_usage:GET", GET_handler);
