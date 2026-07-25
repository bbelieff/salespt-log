"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateExpenseBody,
  CreateRecurringRuleBody,
  ExpenseCategory,
  ExpenseLedgerView,
  PatchRecurringRuleBody,
} from "@/types";

export type ExpenseViewMode = "month" | "all" | "category";

export const expenseLedgerKey = (view: ExpenseViewMode, month?: string, categoryId?: string) =>
  ["expense-ledger", view, month ?? null, categoryId ?? null] as const;
export const expenseCategoriesKey = () => ["expense-categories"] as const;
export const expenseCategoryUsageKey = (categoryId?: string) => ["expense-category-usage", ...(categoryId ? [categoryId] : [])] as const;
export const recurringRulesKey = () => ["expense-recurring-rules"] as const;

export type ExpenseCategoryR6 = ExpenseCategory & {
  isSystem: boolean;
  deletedAt: string | null;
};

export interface ExpenseCategoryUsage {
  category: Pick<ExpenseCategoryR6, "id" | "name" | "isSystem" | "deletedAt">;
  usage: {
    entryCount: number;
    ruleCount: number;
    occurrenceCount: number;
    overrideOccurrenceCount: number;
    totalCount: number;
  };
}

export interface DeleteExpenseCategoryResult {
  ok: true;
  deletedCategoryId: string;
  unclassifiedCategoryId: string;
  movedEntryCount: number;
  movedRuleCount: number;
  movedOccurrenceCount: number;
}

export type ExpenseReclassificationRef = {
  kind: "entry" | "recurringRule" | "recurringOccurrence";
  id: string;
};

export interface ReclassifyExpenseCategoryBody {
  operationId: string;
  targetCategoryId: string;
  refs: ExpenseReclassificationRef[];
}

export interface ReclassifyExpenseCategoryResult {
  ok: true;
  operationId: string;
  unclassifiedCategoryId: string;
  targetCategoryId: string;
  movedEntryCount: number;
  movedRuleCount: number;
  movedOccurrenceCount: number;
}

export interface ManagedRecurringRule {
  id: string;
  categoryId: string;
  categoryName: string;
  itemName: string;
  amountWon: number;
  status: "active" | "paused" | "archived";
  currentOccurrence: { occurrenceDate: string; occurrenceMonth: string; status: string } | null;
  nextOccurrence: { occurrenceDate: string; occurrenceMonth: string; status: string } | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : `HTTP ${res.status}`);
  return body as T;
}

export function useExpenseLedger(view: ExpenseViewMode, month: string, categoryId?: string) {
  const query = new URLSearchParams({ view });
  if (view === "month") query.set("month", month);
  if (view === "category" && categoryId) query.set("categoryId", categoryId);
  return useQuery({
    queryKey: expenseLedgerKey(view, view === "month" ? month : undefined, categoryId),
    queryFn: () => request<ExpenseLedgerView>(`/api/expenses?${query}`),
    enabled: view !== "category" || Boolean(categoryId),
    staleTime: 30_000,
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: expenseCategoriesKey(),
    queryFn: async () => (await request<{ categories: ExpenseCategoryR6[] }>("/api/expense-categories")).categories,
    staleTime: 30_000,
  });
}

export function useExpenseCategoryUsage(categoryId: string) {
  return useQuery({
    queryKey: expenseCategoryUsageKey(categoryId),
    queryFn: () => request<ExpenseCategoryUsage>(`/api/expense-categories/${categoryId}/usage`),
    enabled: Boolean(categoryId),
    staleTime: 30_000,
  });
}

export function useRecurringRules() {
  return useQuery({
    queryKey: recurringRulesKey(),
    queryFn: () => request<{ asOfDate: string; rules: ManagedRecurringRule[] }>("/api/expense-recurring-rules"),
    staleTime: 30_000,
  });
}

function useInvalidateLedger() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ["expense-ledger"] }),
    client.invalidateQueries({ queryKey: expenseCategoriesKey() }),
    client.invalidateQueries({ queryKey: expenseCategoryUsageKey() }),
    client.invalidateQueries({ queryKey: recurringRulesKey() }),
    client.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function useCreateExpense() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: (body: CreateExpenseBody) => request<{ expense: unknown }>("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: (name: string) => request<{ category: ExpenseCategoryR6 }>("/api/expense-categories", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });
}

export function usePatchCategory() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      request<{ category: ExpenseCategoryR6 }>(`/api/expense-categories/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: (id: string) => request<DeleteExpenseCategoryResult>(`/api/expense-categories/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useReclassifyUnclassified() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: (body: ReclassifyExpenseCategoryBody) => request<ReclassifyExpenseCategoryResult>("/api/expense-categories/unclassified/reclassify", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useCreateRecurringRule() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: (body: CreateRecurringRuleBody) => request<{ rule: { id: string } }>("/api/expense-recurring-rules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function usePatchRecurringRule() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchRecurringRuleBody }) =>
      request(`/api/expense-recurring-rules/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurringRule() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: true }>(`/api/expense-recurring-rules/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRecurringRuleAction(action: "pause" | "resume" | "skip") {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => {
      const body = action === "pause" ? { pausedOn: value } : action === "resume" ? { resumedOn: value } : { occurrenceMonth: value };
      return request(`/api/expense-recurring-rules/${id}/${action}`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: invalidate,
  });
}
