import { NextRequest, NextResponse } from "next/server";
import { CreateRecurringRuleBody } from "@/types";
import { addRecurringExpense, getRecurringExpenseRules } from "@/service/expense-ledger";
import { getActiveUserEmail, getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() { try { return NextResponse.json(await getRecurringExpenseRules(await getActiveUserEmail())); } catch (e) { return expenseError(e); } }
async function POST_handler(req: NextRequest) { try { const p = CreateRecurringRuleBody.safeParse(await req.json().catch(() => ({}))); if (!p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const rule = await addRecurringExpense(await getWritableUserEmail(), p.data); return NextResponse.json({ rule }, { status: 201 }); } catch (e) { return expenseError(e); } }
export const GET = withApiTiming("expense_ledger_recurring:GET", GET_handler);
export const POST = withApiTiming("expense_ledger_recurring:POST", POST_handler);
