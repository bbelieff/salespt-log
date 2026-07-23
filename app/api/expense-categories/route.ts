import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUserEmail, getWritableUserEmail } from "@/auth/identity";
import { addExpenseCategory, getExpenseLedger } from "@/service/expense-ledger";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

const CreateBody = z.object({ name: z.string().trim().min(1).max(40) });
async function GET_handler() { try { const email = await getActiveUserEmail(); const view = await getExpenseLedger(email, { view: "all" }); return NextResponse.json({ categories: view.categories }); } catch (e) { return expenseError(e); } }
async function POST_handler(req: NextRequest) { try { const p = CreateBody.safeParse(await req.json().catch(() => ({}))); if (!p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const category = await addExpenseCategory(await getWritableUserEmail(), p.data.name); return NextResponse.json({ category }, { status: 201 }); } catch (e) { return expenseError(e); } }
export const GET = withApiTiming("expense_ledger_categories:GET", GET_handler);
export const POST = withApiTiming("expense_ledger_categories:POST", POST_handler);
