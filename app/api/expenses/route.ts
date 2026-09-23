import { NextRequest, NextResponse } from "next/server";
import { CreateExpenseBody, ExpenseQuery } from "@/types";
import { addExpense, getExpenseLedger } from "@/service/expense-ledger";
import { getActiveUserEmail, getWritableUserEmail } from "@/auth/identity";
import { expenseError } from "./_response";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { normalizeIdempotencyKey } from "@/repo/db/idempotency-keys";

async function GET_handler(req: NextRequest) { try { const p = ExpenseQuery.safeParse({ view: req.nextUrl.searchParams.get("view") ?? undefined, month: req.nextUrl.searchParams.get("month") ?? undefined, categoryId: req.nextUrl.searchParams.get("categoryId") ?? undefined }); if (!p.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 }); return NextResponse.json(await getExpenseLedger(await getActiveUserEmail(), p.data)); } catch (e) { return expenseError(e); } }
async function POST_handler(req: NextRequest) {
  try {
    // Operation identity travels in the header (zod strips unknown body keys
    // by design — a body-carried key would be silently dropped).
    let key: string | null = null;
    try {
      key = normalizeIdempotencyKey(req.headers.get("idempotency-key"));
    } catch {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const p = CreateExpenseBody.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { entry, created } = await addExpense(await getWritableUserEmail(), p.data, key);
    return NextResponse.json({ expense: entry, replayed: !created }, { status: created ? 201 : 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "expense_idempotency_conflict") {
      // Same-scope conflict carries our own row id for client PATCH; a
      // cross-scope collision carries nothing (no other student data leaks).
      const id = (e as Error & { entryId?: unknown }).entryId;
      return NextResponse.json(
        typeof id === "string" && id ? { error: e.message, id } : { error: e.message },
        { status: 409 },
      );
    }
    return expenseError(e);
  }
}
export const GET = withApiTiming("expense_ledger:GET", GET_handler);
export const POST = withApiTiming("expense_ledger:POST", POST_handler);
