// @vitest-environment jsdom

import * as React from "react";
import { act, createElement, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery, type UseMutationResult } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  expenseCategoryUsageKey,
  useDeleteCategory,
  useExpenseCategoryUsage,
  useReclassifyUnclassified,
  type DeleteExpenseCategoryResult,
  type ReclassifyExpenseCategoryBody,
  type ReclassifyExpenseCategoryResult,
} from "@/query/expense-ledger-hooks";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

type DeleteMutation = UseMutationResult<DeleteExpenseCategoryResult, Error, string>;
type ReclassMutation = UseMutationResult<ReclassifyExpenseCategoryResult, Error, ReclassifyExpenseCategoryBody>;

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let client: QueryClient;

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(createElement(QueryClientProvider, { client }, element)));
}

function MutationProbe({ kind, ready }: { kind: "delete" | "reclass"; ready: (mutation: DeleteMutation | ReclassMutation) => void }) {
  const deleteMutation = useDeleteCategory();
  const reclassMutation = useReclassifyUnclassified();
  useEffect(() => ready(kind === "delete" ? deleteMutation : reclassMutation), [deleteMutation, kind, ready, reclassMutation]);
  return null;
}

function UsageProbe({ categoryId }: { categoryId: string }) {
  const usage = useExpenseCategoryUsage(categoryId);
  return createElement("p", { role: "status" }, usage.data ? String(usage.data.usage.totalCount) : usage.isError ? "error" : "loading");
}

function CrossTabProbe({ ready, ledgerRead, usageRead }: { ready: (mutation: DeleteMutation) => void; ledgerRead: () => Promise<unknown>; usageRead: () => Promise<unknown> }) {
  useQuery({ queryKey: ["expense-ledger", "month", "2026-07"], queryFn: ledgerRead });
  useQuery({ queryKey: ["expense-category-usage", deleteResult.deletedCategoryId], queryFn: usageRead });
  const mutation = useDeleteCategory();
  useEffect(() => ready(mutation), [mutation, ready]);
  return null;
}

const deleteResult: DeleteExpenseCategoryResult = {
  ok: true,
  deletedCategoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  unclassifiedCategoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  movedEntryCount: 2,
  movedRuleCount: 1,
  movedOccurrenceCount: 3,
};

const reclassBody: ReclassifyExpenseCategoryBody = {
  operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  targetCategoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  refs: [
    { kind: "entry", id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    { kind: "recurringRule", id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
  ],
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R6 expense category lifecycle cache contract", () => {
  it("uses the frozen usage key and exact usage endpoint", async () => {
    const response = {
      category: { id: reclassBody.targetCategoryId, name: "운영비", isSystem: false, deletedAt: null },
      usage: { entryCount: 1, ruleCount: 2, occurrenceCount: 3, overrideOccurrenceCount: 1, totalCount: 6 },
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    render(createElement(UsageProbe, { categoryId: reclassBody.targetCategoryId }));
    await act(async () => { await vi.waitFor(() => expect(document.body.textContent).toContain("6")); });
    expect(expenseCategoryUsageKey(reclassBody.targetCategoryId)).toEqual(["expense-category-usage", reclassBody.targetCategoryId]);
    expect(fetch).toHaveBeenCalledWith(`/api/expense-categories/${reclassBody.targetCategoryId}/usage`, expect.any(Object));
  });

  it("DELETE sends no guessed body and invalidates exactly five prefixes after success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(deleteResult), { status: 200 }));
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    let mutation: DeleteMutation | undefined;
    render(createElement(MutationProbe, { kind: "delete", ready: (value) => { mutation = value as DeleteMutation; } }));
    await act(async () => { await mutation?.mutateAsync(deleteResult.deletedCategoryId); });
    expect(fetch).toHaveBeenCalledWith(`/api/expense-categories/${deleteResult.deletedCategoryId}`, expect.objectContaining({ method: "DELETE" }));
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(invalidate.mock.calls.map(([input]) => input?.queryKey)).toEqual([
      ["expense-ledger"],
      ["expense-categories"],
      ["expense-category-usage"],
      ["expense-recurring-rules"],
      ["dashboard"],
    ]);
  });

  it("DELETE failure preserves the safe literal and invalidates nothing", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "expense_category_system_immutable" }), { status: 409 }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let mutation: DeleteMutation | undefined;
    render(createElement(MutationProbe, { kind: "delete", ready: (value) => { mutation = value as DeleteMutation; } }));
    await expect(act(async () => { await mutation?.mutateAsync(deleteResult.deletedCategoryId); })).rejects.toThrow("expense_category_system_immutable");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("reclass sends operationId, target and typed refs verbatim then invalidates five prefixes", async () => {
    const result: ReclassifyExpenseCategoryResult = { ok: true, operationId: reclassBody.operationId, unclassifiedCategoryId: deleteResult.unclassifiedCategoryId, targetCategoryId: reclassBody.targetCategoryId, movedEntryCount: 1, movedRuleCount: 1, movedOccurrenceCount: 0 };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    let mutation: ReclassMutation | undefined;
    render(createElement(MutationProbe, { kind: "reclass", ready: (value) => { mutation = value as ReclassMutation; } }));
    await act(async () => { await mutation?.mutateAsync(reclassBody); });
    expect(fetch).toHaveBeenCalledWith("/api/expense-categories/unclassified/reclassify", expect.objectContaining({ method: "POST", body: JSON.stringify(reclassBody) }));
    expect(invalidate.mock.calls.map(([input]) => input?.queryKey)).toEqual([
      ["expense-ledger"],
      ["expense-categories"],
      ["expense-category-usage"],
      ["expense-recurring-rules"],
      ["dashboard"],
    ]);
  });

  it("refetches active ledger and usage scopes together after lifecycle success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(deleteResult), { status: 200 }));
    const ledgerRead = vi.fn().mockResolvedValue({ totalCost: 0 });
    const usageRead = vi.fn().mockResolvedValue({ usage: { totalCount: 0 } });
    let mutation: DeleteMutation | undefined;
    render(createElement(CrossTabProbe, { ready: (value) => { mutation = value; }, ledgerRead, usageRead }));
    await act(async () => { await vi.waitFor(() => { expect(ledgerRead).toHaveBeenCalledOnce(); expect(usageRead).toHaveBeenCalledOnce(); }); });
    await act(async () => { await mutation?.mutateAsync(deleteResult.deletedCategoryId); });
    await act(async () => { await vi.waitFor(() => { expect(ledgerRead).toHaveBeenCalledTimes(2); expect(usageRead).toHaveBeenCalledTimes(2); }); });
  });
});
