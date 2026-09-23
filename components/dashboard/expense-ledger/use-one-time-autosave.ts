/**
 * Scope B — 일회성 비용 자동 기록 머신 (ExpenseLedgerDialog 전용).
 *
 * 의도적으로 완성된 입력(카테고리 + 항목 + 1원 이상 + 정합한 날짜)이
 * whole-group 블러·Enter/제출로 들어오면 1회 생성한다. 타이핑 중
 * pure-debounce 자동 생성은 없다. 첫 렌더·하이드레이션·기본값·
 * 미완성으로는 절대 생성하지 않는다(touched + valid 게이트).
 * 반복 규칙은 다루지 않는다(명시적 유지).
 *
 * 경계 내 안전장치: 초안 ID(서버 멱등키), 단일 비행, 동일 서명 진행 중
 * 병합(블러·Enter 레이스 1회), 성공 서명 재전송 차단, 실패 시 값 유지 +
 * 수동 재시도만(자동 재시도 없음, 실패해도 키 유지). ACK 뒤에 새 입력이
 * 있으면 입력을 유지하고 같은 키로 다음 커밋이 원본을 PATCH한다.
 * 초안은 메모리 보관(영속 아님).
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { createSaveCoalescer } from "@/util/save-coalesce";
import { createRevisionGuard, newDraftId } from "@/app/(app)/db/_lib/db-autosave";
import { oneTimeExpenseCheck } from "./expense-autosave";
import { expenseConflictIdOf } from "@/query/expense-ledger-hooks";
import type { CreateExpenseBody } from "@/types/expense-ledger";

export type OneTimeSaveState = "idle" | "pending" | "error";

interface ExpenseDraftFields {
  categoryId: string;
  itemName: string;
  amountWon: number;
  start: string;
  end: string;
  range: boolean;
}

function draftSig(d: ExpenseDraftFields): string {
  return JSON.stringify([
    d.categoryId,
    d.itemName.trim(),
    d.amountWon,
    d.start,
    d.range ? d.end : "",
    d.range,
  ]);
}

interface Options {
  kind: "one_time" | "recurring";
  categoryId: string;
  itemName: string;
  amountWon: number;
  start: string;
  end: string;
  range: boolean;
  /** Stable draft key is passed through — server replays instead of duplicating. */
  createExpense: (body: CreateExpenseBody, key: string) => Promise<unknown>;
  onCreated: () => void;
  /**
   * Optional converge path: on same-key/different-payload 409 the server
   * returns the FIRST commit's entry id — PATCH it instead of appending.
   * Parent wires usePatchExpense. Absent ⇒ inputs stay editable (no append).
   */
  patchExpense?: (id: string, body: CreateExpenseBody) => Promise<unknown>;
}

export function useOneTimeExpenseAutosave(options: Options) {
  const [status, setStatus] = useState<OneTimeSaveState>("idle");
  const [error, setError] = useState("");

  const latestRef = useRef(options);
  latestRef.current = options;
  const touchedRef = useRef(false);
  const pendingRef = useRef<{ sig: string; promise: Promise<void> } | null>(null);
  const createdSigRef = useRef<string | null>(null);
  /** Entry id of the last ACKed create (or 409 original) — same-row draft. */
  const createdIdRef = useRef<string | null>(null);
  const queueRef = useRef<{ trigger: (run: () => Promise<void>) => Promise<void> } | null>(null);
  if (!queueRef.current) queueRef.current = createSaveCoalescer<void>();
  const guardRef = useRef<ReturnType<typeof createRevisionGuard> | null>(null);
  if (!guardRef.current) guardRef.current = createRevisionGuard();
  const draftIdRef = useRef<string | null>(null);
  if (!draftIdRef.current) draftIdRef.current = newDraftId();

  const markTouched = useCallback(() => {
    touchedRef.current = true;
    // 새 사용자 입력 — 이전 성공 서명을 해제해야 의도적 동일 입력도 기록된다.
    // 타이핑은 스테이징일 뿐, 생성은 whole-group 커밋(flushOnce)만 한다.
    createdSigRef.current = null;
  }, []);

  const resetTouch = useCallback(() => {
    touchedRef.current = false;
    pendingRef.current = null;
    createdSigRef.current = null;
    createdIdRef.current = null;
    draftIdRef.current = newDraftId();
    setStatus("idle");
    setError("");
  }, []);

  const flushOnce = useCallback((): Promise<void> => {
    const o = latestRef.current;
    if (o.kind !== "one_time" || !touchedRef.current) return Promise.resolve();
    const draft = {
      categoryId: o.categoryId,
      itemName: o.itemName,
      amountWon: o.amountWon,
      start: o.start,
      end: o.end,
      range: o.range,
    };
    const check = oneTimeExpenseCheck(draft);
    if (check.status !== "valid") {
      return Promise.reject(new Error(check.reason ?? "입력을 완성해 주세요."));
    }
    const sig = draftSig(draft);
    if (sig === createdSigRef.current) return Promise.resolve();
    if (pendingRef.current?.sig === sig) return pendingRef.current.promise;
    const queue = queueRef.current!;
    const guard = guardRef.current!;
    const seq = guard.begin();
    setStatus("pending");
    setError("");
    const body: CreateExpenseBody = {
      categoryId: draft.categoryId,
      itemName: draft.itemName.trim(),
      amountWon: draft.amountWon,
      periodStart: draft.start,
      ...(draft.range ? { periodEnd: draft.end } : {}),
    };
    const key = draftIdRef.current ?? newDraftId();
    const promise = queue
      .trigger(async () => {
        // Known-ACK fast path: this key already created its entry (ACKed,
        // or 409-converged). PATCH that entry directly with the newest
        // intent — never a needless POST that 409s first. The 409 recovery
        // below stays for the uncertain lost-ACK case (no known id) only.
        const knownId = createdIdRef.current;
        const directPatch = latestRef.current.patchExpense;
        if (knownId !== null && directPatch) {
          await directPatch(knownId, body);
          return;
        }
        try {
          const res = await latestRef.current.createExpense(body, key);
          const id = (res as { expense?: { id?: unknown } } | null | undefined)?.expense?.id;
          if (typeof id === "string") createdIdRef.current = id;
        } catch (e) {
          // Same key + edited payload: the server kept the FIRST entry and
          // returned its id. PATCH it — never a second row. Without a
          // patchExpense wire-up, rethrow and preserve inputs.
          const conflictId = expenseConflictIdOf(e);
          const patch = latestRef.current.patchExpense;
          if (conflictId === null || !patch) throw e;
          await patch(conflictId, body);
          createdIdRef.current = conflictId;
        }
      })
      .then(() => {
        if (!guard.isCurrent(seq)) return;
        createdSigRef.current = sig;
        // Stale-ACK guard: compare the live draft against the frozen commit.
        // When the user typed after the freeze without another flush, keep
        // the inputs with the SAME key and the committed entry attached
        // (createdIdRef untouched) — the next deliberate commit then 409s on
        // the same key and PATCHes that entry instead of creating again.
        const o = latestRef.current;
        const liveSig = draftSig({
          categoryId: o.categoryId,
          itemName: o.itemName,
          amountWon: o.amountWon,
          start: o.start,
          end: o.end,
          range: o.range,
        });
        if (liveSig !== sig) {
          setStatus("idle");
          return;
        }
        createdIdRef.current = null;
        draftIdRef.current = newDraftId();
        setStatus("idle");
        latestRef.current.onCreated();
      })
      .catch((e) => {
        if (!guard.isCurrent(seq)) throw e;
        setStatus("error");
        if (expenseConflictIdOf(e) !== null) {
          setError("이미 기록된 내용과 달라요. 입력은 그대로 있어요.");
        } else {
          const m = e instanceof Error ? e.message : "";
          setError(m && !/HTTP \d+/.test(m) ? m : "비용을 기록하지 못했습니다. 입력은 그대로 있어요.");
        }
        throw e;
      });
    pendingRef.current = { sig, promise };
    const clear = () => {
      if (pendingRef.current?.promise === promise) pendingRef.current = null;
    };
    promise.then(clear, clear);
    return promise;
  }, []);

  // No debounce auto-create: typing (markTouched) only stages. Creation
  // happens on a deliberate whole-group commit — blur/Enter/submit calls
  // flushOnce, guarded by touched + valid inside it.

  return { status, error, markTouched, resetTouch, flushOnce };
}
