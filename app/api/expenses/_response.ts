import { NextResponse } from "next/server";

/** 오류 원문(품목/계정/DB 정보)을 클라이언트에 내보내지 않는 비용 원장 전용 매퍼. */
export function expenseError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "expense_ledger_failed";
  const status = code === "expense_category_duplicate" ? 409
    : code.endsWith("_not_found") || code === "expense_scope_not_found" ? 404
      : code === "expense_ledger_unavailable" ? 503
        : code === "expense_invalid_period" ? 400 : 500;
  const safe = status === 500 ? "expense_ledger_failed" : code;
  return NextResponse.json({ error: safe }, { status });
}
