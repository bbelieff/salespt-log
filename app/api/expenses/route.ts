import { NextRequest, NextResponse } from "next/server";
import { CreateExpenseBody, ExpenseQuery } from "@/types";
import { addExpense, getExpenseLedger } from "@/service/expense-ledger";
import { getActiveUserEmail, getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "./_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler(req: NextRequest) { try { const p = ExpenseQuery.safeParse({ view: req.nextUrl.searchParams.get("view") ?? undefined, month: req.nextUrl.searchParams.get("month") ?? undefined, categoryId: req.nextUrl.searchParams.get("categoryId") ?? undefined }); if (!p.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 }); return NextResponse.json(await getExpenseLedger(await getActiveUserEmail(), p.data)); } catch (e) { return expenseError(e); } }
async function POST_handler(req: NextRequest) { try { const p = CreateExpenseBody.safeParse(await req.json().catch(() => ({}))); if (!p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const expense = await addExpense(await getWritableUserEmail(), p.data); return NextResponse.json({ expense }, { status: 201 }); } catch (e) { return expenseError(e); } }
export const GET = withApiTiming("expense_ledger:GET", GET_handler);
export const POST = withApiTiming("expense_ledger:POST", POST_handler);
