/**
 * Scope B — 신규 DB 행 추가 자동저장 머신 (DbChannelWorkspace 전용).
 *
 * +Add 로 열린 인라인 초안은 valid(의도적 완성 입력)일 때만 생성된다:
 * whole-group 블러/Enter 플러시만 생성한다 — 타이핑 중 pure-debounce
 * 자동 생성은 없다(사용자가 아직 입력 중인 초안을 서버에 만들지 않음).
 * 기본값·하이드레이션·미완성으로는 생성하지 않는다. 단일 비행 +
 * 동일 바이트 1회 병합 + 리비전 가드. 실패 시 폼·초안 유지 + 수동
 * 재시도(자동 재시도 없음). ACK 뒤에 새 입력이 있으면 폼을 유지하고
 * 같은 키로 다음 커밋이 원본 행을 PATCH한다(재생성 없음).
 * 초안은 메모리 보관(영속 아님). 생성 성공 토스트·안내는 호출자가 소유.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import type { ChannelKey, ChannelMeta } from "./channels";
import {
  createRevisionGuard,
  dbCreateCheck,
  newDraftId,
  payloadSignature,
} from "./db-autosave";
import { rowFormDirty } from "./dirty";
import { createSaveCoalescer } from "@/util/save-coalesce";
import { dbConflictRowOf } from "@/query/db-hooks";

export type AddRowStatus = "idle" | "pending" | "error";

interface Options {
  activeCh: ChannelKey;
  ch: ChannelMeta;
  guardedNav: (action: () => void) => void;
  /** Stable draft key is passed through — server replays instead of duplicating. */
  createRow: (data: Record<string, unknown>, key: string) => Promise<unknown>;
  onCreated: (frozen: Record<string, unknown>) => void;
  /**
   * Optional converge path: on same-key/different-payload 409 the server
   * returns the FIRST commit's row — PATCH it with the latest intent instead
   * of appending a second row. Parent wires the existing row-save (handleSave).
   * Absent ⇒ the draft stays open with edits preserved (no append, no loss).
   */
  patchRow?: (row: number, data: Record<string, unknown>) => Promise<unknown>;
}

export function useAddRowAutosave({ activeCh, ch, guardedNav, createRow, onCreated, patchRow }: Options) {
  const [addOpen, setAddOpen] = useState(true);
  const [addInitial, setAddInitial] = useState<Record<string, unknown>>({});
  const [addDirty, setAddDirty] = useState(false);
  const [addStatus, setAddStatus] = useState<AddRowStatus>("idle");
  const [addError, setAddError] = useState("");
  const [addHint, setAddHint] = useState<string | null>(null);

  const payloadRef = useRef<Record<string, unknown> | null>(null);
  const baseRef = useRef<Record<string, unknown> | null>(null);
  const parkedRef = useRef<Record<string, unknown> | null>(null);
  const dirtyRef = useRef(false);
  const openRef = useRef(true);
  openRef.current = addOpen;
  const draftIdRef = useRef<string | null>(null);
  if (!draftIdRef.current) draftIdRef.current = newDraftId();
  const queueRef = useRef<{ trigger: (run: () => Promise<void>) => Promise<void> } | null>(null);
  if (!queueRef.current) queueRef.current = createSaveCoalescer<void>();
  const guardRef = useRef<ReturnType<typeof createRevisionGuard> | null>(null);
  if (!guardRef.current) guardRef.current = createRevisionGuard();
  const createdSigRef = useRef<string | null>(null);
  const pendingRef = useRef<{ sig: string; promise: Promise<void> } | null>(null);
  const createRowRef = useRef(createRow);
  createRowRef.current = createRow;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const patchRowRef = useRef(patchRow);
  patchRowRef.current = patchRow;
  /** Physical row of the last ACKed create (or 409 original) — same-row draft. */
  const createdRowRef = useRef<number | null>(null);

  const markDirty = (d: boolean) => {
    dirtyRef.current = d;
    setAddDirty(d);
  };

  const flushAdd = useCallback((): Promise<void> => {
    const payload = payloadRef.current;
    const base = baseRef.current;
    if (!openRef.current || !payload || !base) return Promise.resolve();
    if (!rowFormDirty(ch.fields, base, payload)) {
      markDirty(false);
      setAddHint(null);
      return Promise.resolve();
    }
    const check = dbCreateCheck(activeCh, payload);
    if (check.status !== "valid") {
      setAddHint(check.reasons[0] ?? null);
      return Promise.reject(new Error(check.reasons[0] ?? "입력을 완성해 주세요."));
    }
    const sig = payloadSignature(payload);
    if (sig === createdSigRef.current) {
      markDirty(false);
      return Promise.resolve();
    }
    // 동일 서명이 이미 진행 중이면(블러·디바운스·Enter 레이스) 같은 promise 에 합류.
    if (pendingRef.current?.sig === sig) return pendingRef.current.promise;
    const frozen = { ...payload };
    const queue = queueRef.current!;
    const guard = guardRef.current!;
    const seq = guard.begin();
    const key = draftIdRef.current ?? newDraftId();
    setAddStatus("pending");
    setAddError("");
    const promise = queue
      .trigger(async () => {
        // Known-ACK fast path: this key already created its row (ACKed, or
        // 409-converged). PATCH that row directly with the newest intent —
        // never a needless POST that 409s first. The 409 recovery below
        // stays for the uncertain lost-ACK case (no known row) only.
        const knownRow = createdRowRef.current;
        const directPatch = patchRowRef.current;
        if (knownRow !== null && directPatch) {
          await directPatch(knownRow, frozen);
          return;
        }
        try {
          const res = await createRowRef.current(frozen, key);
          const row = (res as { row?: unknown } | null | undefined)?.row;
          if (typeof row === "number") createdRowRef.current = row;
        } catch (e) {
          // Same key + edited payload: the server kept the FIRST commit and
          // returned its row. PATCH it with this flush's intent — never a
          // second row. Without a patchRow wire-up, rethrow and preserve.
          const conflictRow = dbConflictRowOf(e);
          const patch = patchRowRef.current;
          if (conflictRow === null || !patch) throw e;
          await patch(conflictRow, frozen);
          createdRowRef.current = conflictRow;
        }
      })
      .then(() => {
        if (!guard.isCurrent(seq)) return;
        createdSigRef.current = sig;
        // Stale-ACK guard: the user may have typed after this commit was
        // frozen without triggering another flush. Compare the live payload
        // against the frozen commit — when it changed, keep the form open on
        // the latest values with the SAME key and the committed row attached
        // (createdRowRef untouched). The next deliberate commit (blur/Enter)
        // then 409s on the same key and PATCHes that row — never a create.
        const live = payloadRef.current;
        if (live && payloadSignature(live) !== sig) {
          markDirty(true);
          setAddStatus("idle");
          setAddHint(null);
          return;
        }
        payloadRef.current = null;
        baseRef.current = null;
        parkedRef.current = null;
        createdRowRef.current = null;
        draftIdRef.current = newDraftId();
        markDirty(false);
        setAddStatus("idle");
        setAddHint(null);
        setAddOpen(false);
        setAddInitial({});
        onCreatedRef.current(frozen);
      })
      .catch((e) => {
        if (!guard.isCurrent(seq)) throw e;
        setAddStatus("error");
        if (dbConflictRowOf(e) !== null) {
          setAddError("이미 저장된 내용과 달라요. 입력은 그대로 있어요.");
        } else {
          const m = e instanceof Error ? e.message : "";
          setAddError(m && !/HTTP \d+/.test(m) ? m : "추가에 실패했어요. 입력은 그대로 있어요.");
        }
        throw e;
      });
    pendingRef.current = { sig, promise };
    const clearPending = () => {
      if (pendingRef.current?.promise === promise) pendingRef.current = null;
    };
    promise.then(clearPending, clearPending);
    return promise;
  }, [activeCh, ch]);

  const saveAddAndSettle = useCallback(async () => {
    await flushAdd();
    await queueRef.current!.trigger(() => Promise.resolve());
    if (dirtyRef.current) throw new Error("저장되지 않은 추가 입력이 있어요.");
  }, [flushAdd]);

  const parkAddDraft = useCallback(() => {
    const payload = payloadRef.current;
    const base = baseRef.current;
    parkedRef.current =
      payload && base && rowFormDirty(ch.fields, base, payload) ? { ...payload } : null;
  }, [ch]);

  const discardAddDraft = useCallback(() => {
    parkedRef.current = null;
    payloadRef.current = null;
    baseRef.current = null;
    createdRowRef.current = null;
    draftIdRef.current = newDraftId();
    markDirty(false);
    setAddStatus("idle");
    setAddError("");
    setAddHint(null);
    setAddOpen(false);
    setAddInitial({});
  }, []);

  const openAdd = useCallback(() => {
    setAddInitial(parkedRef.current ?? {});
    setAddOpen(true);
  }, []);

  const closeAddForm = useCallback(() => {
    guardedNav(() => {
      parkAddDraft();
      setAddOpen(false);
    });
  }, [guardedNav, parkAddDraft]);

  /** 행 펼침 등 외부 전환 시 초안 파크 + 폼 닫기(가드 통과 후 호출). */
  const dismissAdd = useCallback(() => {
    parkAddDraft();
    setAddOpen(false);
  }, [parkAddDraft]);

  const requestCloseAdd = useCallback(() => {
    void flushAdd().then(closeAddForm).catch(closeAddForm);
  }, [flushAdd, closeAddForm]);

  const handleAddPayload = useCallback(
    (p: Record<string, unknown>) => {
      payloadRef.current = p;
      if (!baseRef.current) {
        // 첫 payload = 기준선(기본값·하이드레이션으로 생성하지 않음).
        baseRef.current = { ...p };
        // 새 초안 세션 — 이전 성공 서명을 해제해야 의도적 동일 입력도 생성된다.
        createdSigRef.current = null;
        return;
      }
      const d = rowFormDirty(ch.fields, baseRef.current, p);
      markDirty(d);
      if (d) {
        const check = dbCreateCheck(activeCh, p);
        setAddHint(check.status === "valid" ? null : (check.reasons[0] ?? null));
        if (check.status === "valid") setAddStatus("idle");
        // No auto-create here: creation happens only on a deliberate
        // whole-group commit (blur/Enter → flushAdd). Typing only stages.
      } else {
        setAddHint(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCh, ch],
  );

  return {
    addOpen,
    addInitial,
    addDirty,
    addStatus,
    addError,
    addHint,
    openAdd,
    dismissAdd,
    handleAddPayload,
    flushAdd,
    requestCloseAdd,
    parkAddDraft,
    saveAddAndSettle,
    discardAddDraft,
  };
}
