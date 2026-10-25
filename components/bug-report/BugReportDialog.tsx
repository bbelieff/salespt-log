"use client";
/**
 * 오류신고 창 (2026-10-25 belie 승인 목업 bug-report·bug-report-annotate).
 * 캡처(가림 처리됨) 미리보기 → 누르면 그림판 · 어떤 문제(필수 1개) · 설명(선택, Ctrl+V 로 직접 캡처 붙여넣기) · 보내기.
 * 함께 보내는 것: 보던 화면 주소·제목·화면 크기·브라우저·최근 오류·화면 재생 링크. 보낸 뒤 「접수했어요」.
 */
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import posthog from "posthog-js";
import { X } from "lucide-react";
import { BUG_REPORT_CATEGORIES, type BugReportInput } from "@/types/bug-report";
import AnnotateCanvas from "./AnnotateCanvas";
import { shrinkImage } from "./capture";
import { recentErrors, scrubText } from "./error-log";
import "./bug-report.css";

type Category = BugReportInput["category"];
type Phase = "form" | "annotate" | "sending" | "done";

function replayUrl(): string {
  try {
    return (posthog as unknown as { __loaded?: boolean }).__loaded ? posthog.get_session_replay_url({ withTimestamp: true, timestampLookBack: 30 }) : "";
  } catch {
    return "";
  }
}

export function buildContext(marks: number): BugReportInput["context"] {
  return {
    path: (location.pathname + location.search).slice(0, 500),
    title: document.title.slice(0, 200),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent.slice(0, 400),
    replayUrl: replayUrl().slice(0, 600),
    errors: recentErrors().map(scrubText),
    marks,
  };
}

export default function BugReportDialog({ capture, status, onClose }: { capture: string; status: "capturing" | "ready" | "failed"; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [image, setImage] = useState(capture);
  const [marks, setMarks] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { if (capture) setImage(capture); }, [capture]); // 찍기가 끝나면 미리보기에 넣는다

  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && phase !== "annotate") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [phase, onClose]);

  const paste = async (e: ClipboardEvent) => {
    const file = [...e.clipboardData.items].find(i => i.type.startsWith("image/"))?.getAsFile();
    if (!file) return;
    e.preventDefault();
    try { setImage(await shrinkImage(file)); setMarks(0); setError(""); } catch { setError("붙여 넣은 그림을 읽지 못했어요."); }
  };
  const send = async () => {
    if (!category) { setError("어떤 문제인지 하나 골라 주세요."); return; }
    setPhase("sending"); setError("");
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, text, image, context: buildContext(marks) } satisfies BugReportInput),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "신고를 보내지 못했어요.");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "신고를 보내지 못했어요.");
      setPhase("form");
    }
  };

  return createPortal(<div className="br-backdrop" data-bug-report-exclude onPointerDown={e => { if (e.target === e.currentTarget && phase !== "annotate") onClose(); }}>
    <div ref={dialog} className="br-dialog" data-wide={phase === "annotate"} role="dialog" aria-modal="true" aria-labelledby="br-title" tabIndex={-1}>
      <div className="br-head">
        <h2 id="br-title">🐞 오류신고</h2>
        <button type="button" className="br-close" onClick={onClose} aria-label="오류신고 닫기"><X size={17} aria-hidden /></button>
      </div>
      {phase === "done" ? <div className="br-done" role="status">
        <span aria-hidden>✓</span><strong>접수했어요</strong><p>고치면 새소식으로 알려 드릴게요.</p>
        <button type="button" className="br-primary" onClick={onClose}>닫기</button>
      </div> : phase === "annotate" && image ? <AnnotateCanvas src={image} onCancel={() => setPhase("form")} onDone={(img, n) => { setImage(img); setMarks(m => m + n); setPhase("form"); }} /> : <div className="br-body" onPaste={paste}>
        {image ? <div className="br-thumb">
          <button type="button" onClick={() => setPhase("annotate")} aria-label="캡처를 크게 열어 표시하기"><img src={image} alt="신고에 붙일 화면 캡처" /></button>
          <div className="br-thumb-bar"><span>{marks ? `표시 ${marks}개` : "눌러서 문제 자리를 표시해 주세요"}</span>
            <span><button type="button" onClick={() => setPhase("annotate")}>표시하기</button> · <button type="button" onClick={() => { setImage(""); setMarks(0); }}>빼기</button></span></div>
        </div> : status === "capturing" ? <p className="br-nocap" role="status" aria-busy="true">화면을 찍는 중이에요…</p>
          : <p className="br-nocap">{status === "failed" ? "화면을 찍지 못했어요. " : ""}직접 찍은 캡처가 있으면 아래 칸에 붙여 넣어(Ctrl+V) 주세요.</p>}
        <p className="br-lbl" id="br-cat">어떤 문제인가요?</p>
        <div className="br-chips" role="radiogroup" aria-labelledby="br-cat">
          {BUG_REPORT_CATEGORIES.map(c => <button key={c} type="button" role="radio" aria-checked={category === c} className="br-chip" onClick={() => { setCategory(c); setError(""); }}>{c}</button>)}
        </div>
        <label className="br-lbl" htmlFor="br-text">무엇을 하다가 그랬나요? (선택)</label>
        <textarea id="br-text" value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="예) 계약 저장을 눌렀는데 그대로예요. 표시만 해도 충분해요." />
        <p className="br-note">보던 화면 주소·기기 정보·최근 오류가 함께 가요. 전화번호·이름은 가려서 보내요.</p>
        {error && <p className="br-error" role="alert">{error}</p>}
        <button type="button" className="br-primary br-send" onClick={send} disabled={phase === "sending" || status === "capturing"}>{phase === "sending" ? "보내는 중…" : "보내기"}</button>
      </div>}
    </div>
  </div>, document.body);
}
