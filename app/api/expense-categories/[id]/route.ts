import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWritableUserEmail } from "@/auth/identity";
import { deleteExpenseCategoryForUser, editExpenseCategory } from "@/service/expense-ledger";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

const Patch = z.object({ name: z.string().trim().min(1).max(40) }).strict();
async function PATCH_handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const p = Patch.safeParse(await req.json().catch(() => ({}))); const { id } = await ctx.params; if (!id || !p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const category = await editExpenseCategory(await getWritableUserEmail(), id, p.data); return NextResponse.json({ category }); } catch (e) { return expenseError(e); } }
async function DELETE_handler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const { id } = await ctx.params; if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); return NextResponse.json(await deleteExpenseCategoryForUser(await getWritableUserEmail(), id)); } catch (e) { return expenseError(e); } }
export const PATCH = withApiTiming("expense_ledger_category:PATCH", PATCH_handler);
export const DELETE = withApiTiming("expense_ledger_category:DELETE", DELETE_handler);
