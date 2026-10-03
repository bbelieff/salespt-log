/**
 * useAutosave — Scope A shared React binding for AutosaveQueue.
 *
 * Draft/saved state + validity gating + DirtyGuard-ready `dirty`/`flush`.
 * Target identity change creates a fresh queue (old pending cancelled, unsaved).
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AutosaveQueue,
  type AutosaveStatus,
  type AutosaveTarget,
} from "@/util/autosave-queue";

export type { AutosaveStatus };

interface UpdateOptions {
  /** Invalid input stays local (dirty for the leave-guard) and is never sent. */
  valid?: boolean;
  error?: string;
}

interface UseAutosaveOptions<T> {
  target: AutosaveTarget;
  initial: T;
  save: (arg: { target: AutosaveTarget; payload: T }) => Promise<unknown>;
  delayMs?: number;
  isEmpty?: (payload: T) => boolean;
  isEqual?: (a: T, b: T) => boolean;
}

const defaultEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export function useAutosave<T>(options: UseAutosaveOptions<T>) {
  const { target, save, delayMs, isEmpty, isEqual } = options;
  const equal = isEqual ?? defaultEqual;
  const saveRef = useRef(save);
  saveRef.current = save;

  const [draft, setDraftState] = useState<T>(options.initial);
  const [saved, setSavedState] = useState<T>(options.initial);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [prevAcked, setPrevAcked] = useState<T | null>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const targetRef = useRef(target);
  targetRef.current = target;

  // F4 late-ACK guard: last server-acked payload for stale-saved downgrade,
  // plus current equality for the downgrade check. Invalid refs live here
  // (before the queue factory) so onAck/onStatus see the current draft
  // validity when an old flight ACKs after a newer stage.
  const invalidRef = useRef(false);
  const invalidMsgRef = useRef("");
  const lastAckRef = useRef<T | null>(null);
  const equalRef = useRef(equal);
  equalRef.current = equal;

  // Latest factory — ensureQueue() below always builds with current props.
  const makeQueueRef = useRef<(t: AutosaveTarget) => AutosaveQueue<T>>(null as never);
  makeQueueRef.current = (t: AutosaveTarget) =>
    new AutosaveQueue<T>({
      target: { ...t },
      delayMs,
      isEmpty,
      isEqual: equal,
      save: (arg) => saveRef.current(arg),
      onAck: (payload) => {
        lastAckRef.current = payload;
        setPrevAcked(savedRef.current);
        setSavedState(payload);
        // F4: an old flight ACK must not clear a newer invalid draft error.
        // Explicit acknowledge() clears invalid BEFORE the queue call, so
        // the F3 transport-error resolution still clears (behavior kept).
        if (invalidRef.current) {
          setError(invalidMsgRef.current || "입력을 확인해 주세요.");
        } else {
          setError("");
        }
        setSavedAt(Date.now());
      },
      onStatus: (s) => {
        // F4: late ACK for an older payload must not report saved while
        // a newer draft is unsaved/invalid. Downgrade stale saved.
        if (s === "saved") {
          if (invalidRef.current) {
            setStatus("idle");
            return;
          }
          const acked = lastAckRef.current;
          if (acked !== null && !equalRef.current(draftRef.current, acked)) {
            setStatus("idle");
            return;
          }
        }
        setStatus(s);
      },
      onError: (message) => setError(message),
    });

  const queueRef = useRef<AutosaveQueue<T> | null>(null);
  /**
   * StrictMode (and any unmount/remount) runs the dispose cleanup, then reuses
   * the same refs. A disposed queue drops every edit silently, so rebuild on
   * next use with the current target and the last-saved baseline instead of
   * reusing the dead instance.
   */
  const ensureQueue = useCallback(() => {
    const current = queueRef.current;
    if (current !== null && !current.isDisposed) return current;
    const next = makeQueueRef.current(targetRef.current);
    next.sync(savedRef.current);
    queueRef.current = next;
    return next;
  }, []);
  if (queueRef.current === null) {
    queueRef.current = makeQueueRef.current(target);
    queueRef.current.sync(options.initial);
  }
  const queue = ensureQueue();

  // Identity switch (other week/day/record): fresh queue, old pending cancelled
  // without saving. Baseline adopts the new server snapshot — never a request.
  const targetKey = useMemo(() => JSON.stringify(target), [target]);
  const firstKey = useRef(targetKey);
  useEffect(() => {
    if (targetKey === firstKey.current) return;
    firstKey.current = targetKey;
    const next = new AutosaveQueue<T>({
      target: JSON.parse(targetKey) as AutosaveTarget,
      delayMs,
      isEmpty,
      isEqual: equal,
      save: (arg) => saveRef.current(arg),
      onAck: (payload) => {
        lastAckRef.current = payload;
        setPrevAcked(savedRef.current);
        setSavedState(payload);
        // F4: an old flight ACK must not clear a newer invalid draft error.
        // Explicit acknowledge() clears invalid BEFORE the queue call, so
        // the F3 transport-error resolution still clears (behavior kept).
        if (invalidRef.current) {
          setError(invalidMsgRef.current || "입력을 확인해 주세요.");
        } else {
          setError("");
        }
        setSavedAt(Date.now());
      },
      onStatus: (s) => {
        // F4: late ACK for an older payload must not report saved while
        // a newer draft is unsaved/invalid. Downgrade stale saved.
        if (s === "saved") {
          if (invalidRef.current) {
            setStatus("idle");
            return;
          }
          const acked = lastAckRef.current;
          if (acked !== null && !equalRef.current(draftRef.current, acked)) {
            setStatus("idle");
            return;
          }
        }
        setStatus(s);
      },
      onError: (message) => setError(message),
    });
    queueRef.current?.dispose();
    queueRef.current = next;
    next.sync(options.initial);
    invalidRef.current = false;
    invalidMsgRef.current = "";
    lastAckRef.current = null;
    setDraftState(options.initial);
    setSavedState(options.initial);
    setError("");
    setSavedAt(null);
    setPrevAcked(null);
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);
  useEffect(() => () => queueRef.current?.dispose(), []);

  const update = useCallback(
    (next: T, opts?: UpdateOptions) => {
      const valid = opts?.valid ?? true;
      setDraftState(next);
      if (!valid) {
        // Invalid latest input supersedes everything queued: cancel the older
        // debounce (a stale valid payload must never be sent for this draft)
        // and keep the draft local + dirty until the user fixes it.
        const message = opts?.error ?? "입력을 확인해 주세요.";
        invalidRef.current = true;
        invalidMsgRef.current = message;
        setError(message);
        ensureQueue().discardPending();
        return;
      }
      invalidRef.current = false;
      invalidMsgRef.current = "";
      setError("");
      ensureQueue().edit(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Draft-only staging for currency/date groups — schedules nothing, but
   * cancels any older debounced pending payload (queue.stage) so the group
   * edit in progress supersedes the intermediate keystroke debounce.
   * Validity is NOT inferred: plain stage(next) preserves any prior invalid
   * flag/error. Call commit(validate, msg) before flush(), or pass an
   * explicit validity flag here: stage(next, true) marks the staged draft
   * valid, stage(next, false, msg) marks it invalid (draft stays local).
   */
  const stage = useCallback(
    (next: T, valid?: boolean, errorMsg?: string) => {
      setDraftState(next);
      if (valid === false) {
        const message = errorMsg ?? "입력을 확인해 주세요.";
        invalidRef.current = true;
        invalidMsgRef.current = message;
        setError(message);
        ensureQueue().discardPending();
        return;
      }
      if (valid === true) {
        invalidRef.current = false;
        invalidMsgRef.current = "";
        setError("");
        ensureQueue().stage(next);
        return;
      }
      ensureQueue().stage(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Whole-group blur — enqueue the staged draft when valid. */
  const commit = useCallback(
    (valid = true, errorMsg?: string) => {
      if (!valid) {
        const message = errorMsg ?? "입력을 확인해 주세요.";
        invalidRef.current = true;
        invalidMsgRef.current = message;
        setError(message);
        ensureQueue().discardPending();
        return;
      }
      invalidRef.current = false;
      invalidMsgRef.current = "";
      setError("");
      ensureQueue().commit();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Programmatic refetch merge — overwrites the draft only when clean, so a
   * background refresh never clobbers unsent edits. Saved baseline always
   * moves; when dirty the queued write is preserved via rebase() (NOT sync(),
   * which would cancel the newer pending payload), and validation/error state
   * (invalid flags, error text, queue failed-save status) is preserved until
   * an explicit valid user edit or discard(). Clean refetch still resets.
   */
  const syncServer = useCallback(
    (server: T) => {
      const clean = equal(draftRef.current, savedRef.current);
      const q = ensureQueue();
      if (clean) {
        q.sync(server);
        q.clearError();
        invalidRef.current = false;
        invalidMsgRef.current = "";
        setSavedState(server);
        setDraftState(server);
        setError("");
        return;
      }
      // Dirty: preserve the user's unsent work AND its validation/error state.
      // A background refetch must never turn an invalid draft valid, nor clear
      // a failed-save status. Only the saved baseline moves (rebase preserves
      // timer/pending/staged and the queue error); draft, invalid flags, and
      // the error text stay until an explicit valid user edit or discard().
      q.rebase(server);
      setSavedState(server);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equal],
  );

  const retry = useCallback(
    () => ensureQueue().retry(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const flush = useCallback(
    async () => {
      // Invalid current draft blocks save-and-leave: reject instead of
      // resolving after sending a stale (or no) payload.
      if (invalidRef.current) {
        throw new Error(invalidMsgRef.current || "입력을 확인해 주세요.");
      }
      await ensureQueue().flush();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Explicit user discard (leave-without-save, revert button) — cancels any
   * queued write and resets the draft to the last-saved baseline. Caller
   * replacement: DirtyGuard discard callbacks must call this instead of
   * syncServer(savedSnapshot) — dirty syncServer now preserves pending writes
   * by design, so it no longer discards.
   */
  const discard = useCallback(
    () => {
      const q = ensureQueue();
      q.discardPending();
      q.clearError();
      invalidRef.current = false;
      invalidMsgRef.current = "";
      setDraftState(savedRef.current);
      setError("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * External ACK for an out-of-band overwrite (conflict PUT sent directly,
   * NOT through the queue). Moves the saved baseline to exactly the frozen
   * acknowledged payload and clears the resolved transport error, while the
   * current draft/staged work stays untouched for an explicit serialized
   * commit. Transport-invalid markings from a failed overwrite are cleared
   * (resolved); genuine validity is re-checked by the caller before commit.
   * Never use dirty syncServer as an acknowledgement — it preserves the
   * old error by design (F2 dirty-refetch guarantee).
   */
  const acknowledge = useCallback(
    (payload: T) => {
      // F3 explicit resolution clears BEFORE the queue ACK, so onAck/onStatus
      // see the resolved state and may report saved when nothing is newer.
      // Old flight ACKs keep invalid set and stay pending (F4).
      // Drop any stale transport-invalid marking so a later valid draft
      // can commit; the caller re-validates newer work before commit().
      invalidRef.current = false;
      invalidMsgRef.current = "";
      setError("");
      ensureQueue().acknowledge(payload);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Lightweight undo — compensating write of the pre-save snapshot. */
  const undo = useCallback(
    () => {
      setPrevAcked((prev) => {
        if (prev !== null) {
          invalidRef.current = false;
          invalidMsgRef.current = "";
          setError("");
          setDraftState(prev);
          ensureQueue().edit(prev);
        }
        return null;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dirty = useMemo(
    () => !equal(draft, saved) || queue.hasPending,
    [draft, saved, equal, queue, status],
  );

  return {
    draft,
    saved,
    // Queue status only — "saved" appears solely after a server ACK (run() or acknowledge()).
    // Invalid local edits stay `dirty` for the leave-guard with the error text.
    status,
    error,
    dirty,
    savedAt,
    canUndo: prevAcked !== null && equal(draft, saved),
    update,
    stage,
    commit,
    syncServer,
    retry,
    flush,
    discard,
    acknowledge,
    undo,
  };
}
