import { NextRequest, NextResponse } from "next/server";
import { PatchRecurringRuleBody } from "@/types";
import { editRecurringExpense, removeRecurringExpense } from "@/service/expense-ledger";
import { getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function PATCH_handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const p = PatchRecurringRuleBody.safeParse(await req.json().catch(() => ({}))); const { id } = await ctx.params; if (!id || !p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const rule = await editRecurringExpense(await getWritableUserEmail(), id, p.data); return NextResponse.json({ rule: rule ?? null }); } catch (e) { return expenseError(e); } }
export const PATCH = withApiTiming("expense_ledger_recurring:PATCH", PATCH_handler);

async function DELETE_handler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) { try { const { id } = await ctx.params; if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); await removeRecurringExpense(await getWritableUserEmail(), id); return NextResponse.json({ ok: true }); } catch (e) { return expenseError(e); } }
export const DELETE = withApiTiming("expense_ledger_recurring:DELETE", DELETE_handler);
