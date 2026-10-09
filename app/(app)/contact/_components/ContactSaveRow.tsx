/**
 * ContactSaveRow — 컨택관리 숫자 저장 줄(belie 2026-10-09 — 저장 버튼 되살림).
 *
 * 자동 저장(0.8초 뒤)은 그대로 두고, 눈에 보이는 [저장] 버튼을 함께 둔다. 저장 안 된 숫자가 있으면
 * 버튼이 빨갛게 바뀐다. 이진호 수강생 지난주 기록이 서버에 한 건도 도착하지 않은 일(2026-10-09 확인)
 * — 앱을 닫거나 다른 앱으로 넘어갈 때 보내기 전 숫자가 사라질 수 있었다 — 을 막으려고
 * useFlushOnHide 로 화면이 가려지는 순간 남은 숫자를 바로 보낸다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import type { AutosaveStatus as Status } from "@/components/autosave/useAutosave";

/** 화면이 가려질 때(다른 앱·탭으로 넘어감, 앱 닫기, 새로고침) 아직 안 보낸 저장을 바로 보낸다. */
export function useFlushOnHide(flush: () => Promise<void>, dirty: boolean) {
  const ref = useRef({ flush, dirty });
  ref.current = { flush, dirty };
  useEffect(() => {
    const send = () => {
      if (ref.current.dirty) void ref.current.flush().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
    };
  }, []);
}

interface Props {
  status: Status;
  error?: string;
  savedAt?: number | null;
  dirty: boolean;
  onSave: () => Promise<void>;
  onRetry: () => void;
}

export default function ContactSaveRow({ status, error, savedAt, dirty, onSave, onRetry }: Props) {
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const save = async () => {
    setBusy(true);
    setFail("");
    try {
      await onSave();
    } catch (e) {
      setFail(e instanceof Error ? e.message : "저장하지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {dirty ? "저장 안 된 숫자가 있어요" : "숫자는 자동으로 저장돼요"}
        </span>
        <div className="flex items-center gap-2">
          <AutosaveStatus status={status} error={error} savedAt={savedAt} onRetry={onRetry} />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={`h-8 shrink-0 rounded-lg px-3 text-xs font-bold disabled:opacity-60 ${
              dirty ? "bg-brand-red text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {busy ? "저장 중…" : dirty ? "💾 저장" : "저장됨 ✓"}
          </button>
        </div>
      </div>
      {fail && <p role="alert" className="mt-1 text-xs text-red-600">{fail}</p>}
    </div>
  );
}
