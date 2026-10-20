"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { AutosaveStatus } from "@/components/autosave/useAutosave";

const query = "(max-width: 767px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
type Notice = { kind: "saving" | "saved"; phase: "visible" | "leaving" } | null;

interface Props {
  ownerId: string;
  status: AutosaveStatus;
  savedAt: number | null;
  dirty: boolean;
  ciSaving: boolean;
  ciDirty: boolean;
  ciError: string | null;
  resetEpoch: number;
  canUndo: boolean;
  onUndo: () => void;
}

export function isPaymentFeedbackTarget(target: EventTarget | null, ownerId: string) {
  return target instanceof Element && target.closest("[data-payment-feedback-dock]")?.getAttribute("data-payment-feedback-owner") === ownerId;
}

export function shouldCommitPaymentBlur(scope: HTMLElement, next: EventTarget | null, ownerId: string) {
  return !isPaymentFeedbackTarget(next, ownerId) && !(next instanceof Node && scope.contains(next));
}

/** Payment-only presentation. No transport, queue, focus or storage ownership. */
export default function PaymentMobileSaveFeedback(props: Props) {
  const compact = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const anchor = useRef<HTMLSpanElement>(null);
  const [scopeVisible, setScopeVisible] = useState(false);
  const enabled = compact && scopeVisible;
  const [notice, setNotice] = useState<Notice>(null);
  const current = useRef<Notice>(null);
  const generation = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ackWaiting = useRef(false);
  const previous = useRef({ enabled: false, savedAt: props.savedAt, ciSaving: props.ciSaving, resetEpoch: props.resetEpoch, ownerId: props.ownerId });
  const publish = useCallback((next: Notice) => { current.current = next; setNotice(next); }, []);
  const cancel = useCallback(() => {
    generation.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const later = useCallback((delay: number, action: () => void) => {
    const owner = generation.current;
    timers.current.push(setTimeout(() => { if (owner === generation.current) action(); }, delay));
  }, []);

  // A portal must not outlive a hidden selected detail or a company switch.
  useEffect(() => {
    if (!compact) { setScopeVisible(false); return; }
    const refresh = () => setScopeVisible(Boolean(anchor.current?.parentElement && !anchor.current.parentElement.closest("[hidden]")));
    refresh();
    const observer = new MutationObserver(refresh);
    for (let node = anchor.current?.parentElement; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ["hidden"] });
    }
    return () => observer.disconnect();
  }, [compact]);
  useEffect(() => () => cancel(), [cancel]);

  const { status, savedAt, dirty, ciSaving, ciDirty, ciError, resetEpoch, ownerId } = props;
  useEffect(() => {
    const before = previous.current;
    const newAck = savedAt !== null && savedAt !== before.savedAt;
    // CI saving ends only after drain success or explicit reset. resetEpoch
    // distinguishes discard; errors/dirty drafts never announce success.
    const ciAck = before.ciSaving && !ciSaving && !ciError && !ciDirty;
    previous.current = { enabled, savedAt, ciSaving, resetEpoch, ownerId };
    const reset = !before.enabled || before.resetEpoch !== resetEpoch || before.ownerId !== ownerId;
    if (!enabled || reset) {
      cancel(); publish(null); ackWaiting.current = false;
      if (!enabled) return;
    }
    if (!reset && (newAck || ciAck)) ackWaiting.current = true;
    if (status === "error" || ciError) {
      cancel(); publish(null); ackWaiting.current = false; return;
    }
    if (status === "pending" || ciSaving) {
      if (newAck && dirty) ackWaiting.current = false;
      cancel();
      if (current.current) publish({ kind: "saving", phase: "visible" });
      else later(180, () => publish({ kind: "saving", phase: "visible" }));
      return;
    }
    if (dirty || ciDirty) {
      cancel(); publish(null); ackWaiting.current = false; return;
    }
    if (ackWaiting.current) {
      ackWaiting.current = false;
      cancel(); publish({ kind: "saved", phase: "visible" });
      later(1000, () => {
        publish({ kind: "saved", phase: "leaving" });
        later(160, () => publish(null));
      });
    } else if (current.current?.kind === "saving") {
      cancel(); publish(null); // cancellation without an ACK is not success.
    }
  }, [enabled, status, savedAt, dirty, ciSaving, ciDirty, ciError, resetEpoch, ownerId, cancel, later, publish]);

  const busy = status === "pending" || ciSaving || dirty || ciDirty || status === "error" || Boolean(ciError);
  return <>
    <span hidden ref={anchor} data-payment-feedback-anchor />
    {enabled && createPortal(<div className="payment-mobile-feedback-dock payment-mobile-tools" data-payment-feedback-dock data-payment-feedback-owner={ownerId}>
      <span aria-live="polite" aria-atomic="true">
        {notice && <span className="payment-mobile-save-notice" data-payment-save-toast data-kind={notice.kind} data-phase={notice.phase} aria-hidden={notice.phase === "leaving" ? true : undefined}>
          {notice.kind === "saved" && <span className="payment-save-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4 10-10" /></svg></span>}
          <span>{notice.kind === "saving" ? "저장중" : "저장완료"}</span>
        </span>}
      </span>
      {props.canUndo && <button type="button" data-payment-feedback-undo disabled={busy} onMouseDown={(event) => event.preventDefault()} onClick={props.onUndo} className="h-11 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 shadow-sm disabled:opacity-50" aria-label="계약 입력 되돌리기">되돌리기</button>}
    </div>, document.body)}
  </>;
}
