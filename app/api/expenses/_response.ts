import { NextResponse } from "next/server";

/** 오류 원문(품목/계정/DB 정보)을 클라이언트에 내보내지 않는 비용 원장 전용 매퍼. */
export function expenseError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "expense_ledger_failed";
  const unauthenticated = code.startsWith("[auth]");
  const BAD_REQUEST = new Set(["invalid_request", "invalid_query", "expense_invalid_period", "expense_invalid_resume_date", "expense_invalid_effective_month"]);
  const NOT_FOUND = new Set(["expense_scope_not_found", "expense_category_not_found", "expense_target_category_not_found", "expense_entry_not_found", "expense_rule_not_found", "expense_occurrence_not_found", "expense_pause_not_found", "expense_reclassification_ref_not_found"]);
  const CONFLICT = new Set(["expense_category_duplicate", "expense_category_system_immutable", "expense_category_deleted", "expense_reclassification_overlap", "expense_reclassification_source_mismatch", "expense_idempotency_conflict", "expense_category_concurrent_change"]);
  const unavailable = code === "expense_ledger_unavailable" || code === "expense_schema_not_ready";
  const status = unauthenticated ? 401 : BAD_REQUEST.has(code) ? 400 : NOT_FOUND.has(code) ? 404 : CONFLICT.has(code) ? 409 : unavailable ? 503 : 500;
  const safe = unauthenticated ? "unauthenticated" : unavailable ? "expense_ledger_unavailable" : status === 500 ? "expense_ledger_failed" : code;
  return NextResponse.json({ error: safe }, { status });
}
