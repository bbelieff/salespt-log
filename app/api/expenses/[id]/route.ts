import { NextRequest, NextResponse } from "next/server";
import { PatchExpenseBody } from "@/types";
import { editExpense, removeExpense } from "@/service/expense-ledger";
import { getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "../_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function PATCH_handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const p = PatchExpenseBody.safeParse(await req.json().catch(() => ({}))); const { id } = await ctx.params; if (!id || !p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const expense = await editExpense(await getWritableUserEmail(), id, p.data); return NextResponse.json({ expense }); } catch (e) { return expenseError(e); } }
async function DELETE_handler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const { id } = await ctx.params; if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); await removeExpense(await getWritableUserEmail(), id); return NextResponse.json({ ok: true }); } catch (e) { return expenseError(e); } }
export const PATCH = withApiTiming("expense_ledger_entry:PATCH", PATCH_handler);
export const DELETE = withApiTiming("expense_ledger_entry:DELETE", DELETE_handler);
