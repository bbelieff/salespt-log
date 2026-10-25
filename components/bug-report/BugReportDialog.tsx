"use client";
/**
 * 오류신고 창 (2026-10-25 belie 승인 목업 bug-report·bug-report-annotate, 같은 날 「실제 화면 그대로」 결정).
 * 그림: PC = 방금 찍은 실제 탭(가림 처리됨) · 휴대폰·거절 = 「화면 캡처하러 가기」(창을 잠시 숨김) 뒤 「사진 붙이기」 또는 Ctrl+V.
 * 미리보기를 누르면 그림판 · 어떤 문제(필수 1개) · 설명(선택) · 보내기 → 「접수했어요」.
 * 함께 보내는 것: 그림 출처(실제 탭/직접 올림)·보던 화면 주소·제목·화면 크기·브라우저·최근 오류·화면 재생 링크.
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
type Source = BugReportInput["context"]["captureMethod"];
type Phase = "form" | "annotate" | "away" | "sending" | "done";

function replayUrl(): string {
  try {
    return (posthog as unknown as { __loaded?: boolean }).__loaded ? posthog.get_session_replay_url({ withTimestamp: true, timestampLookBack: 30 }) : "";
  } catch {
    return "";
  }
}

export function buildContext(marks: number, captureMethod: Source): BugReportInput["context"] {
  return {
    path: (location.pathname + location.search).slice(0, 500),
    title: document.title.slice(0, 200),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent.slice(0, 400),
    replayUrl: replayUrl().slice(0, 600),
    errors: recentErrors().map(scrubText),
    captureMethod,
    marks,
  };
}

export default function BugReportDialog({ capture, onClose }: { capture: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [image, setImage] = useState(capture);
  const [source, setSource] = useState<Source>(capture ? "tab" : "none");
  const [marks, setMarks] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "away") return;
    dialog.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && phase !== "annotate") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [phase, onClose]);

  const attach = async (blob: Blob | null | undefined) => {
    if (!blob) return;
    try { setImage(await shrinkImage(blob)); setSource("upload"); setMarks(0); setError(""); } catch { setError("사진을 읽지 못했어요. 다른 사진으로 해 주세요."); }
  };
  const paste = (e: ClipboardEvent) => {
    const blob = [...e.clipboardData.items].find(i => i.type.startsWith("image/"))?.getAsFile();
    if (!blob) return;
    e.preventDefault();
    void attach(blob);
  };
  const send = async () => {
    if (!category) { setError("어떤 문제인지 하나 골라 주세요."); return; }
    setPhase("sending"); setError("");
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, text, image, context: buildContext(marks, image ? source : "none") } satisfies BugReportInput),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "신고를 보내지 못했어요.");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "신고를 보내지 못했어요.");
      setPhase("form");
    }
  };

  // 휴대폰에서 직접 캡처하러 간 동안: 창을 숨기고 돌아오기 버튼만 남긴다(적은 내용은 그대로).
  if (phase === "away") return createPortal(<button type="button" className="br-return" onClick={() => setPhase("form")}>📷 캡처했어요 · 신고로 돌아가기</button>, document.body);

  return createPortal(<div className="br-backdrop" onPointerDown={e => { if (e.target === e.currentTarget && phase !== "annotate") onClose(); }}>
    <div ref={dialog} className="br-dialog" data-wide={phase === "annotate"} role="dialog" aria-modal="true" aria-labelledby="br-title" tabIndex={-1}>
      <div className="br-head">
        <h2 id="br-title">🐞 오류신고</h2>
        <button type="button" className="br-close" onClick={onClose} aria-label="오류신고 닫기"><X size={17} aria-hidden /></button>
      </div>
      {phase === "done" ? <div className="br-done" role="status">
        <span aria-hidden>✓</span><strong>접수했어요</strong><p>고치면 새소식으로 알려 드릴게요.</p>
        <button type="button" className="br-primary" onClick={onClose}>닫기</button>
      </div> : phase === "annotate" && image ? <AnnotateCanvas src={image} onCancel={() => setPhase("form")} onDone={(img, n) => { setImage(img); setMarks(m => m + n); setPhase("form"); }} /> : <div className="br-body" onPaste={paste}>
        <input ref={file} type="file" accept="image/*" hidden onChange={e => { void attach(e.target.files?.[0]); e.target.value = ""; }} />
        {image ? <div className="br-thumb">
          <button type="button" onClick={() => setPhase("annotate")} aria-label="사진을 크게 열어 표시하기"><img src={image} alt="신고에 붙일 화면" /></button>
          <div className="br-thumb-bar"><span>{marks ? `표시 ${marks}개` : source === "tab" ? "실제 화면 · 눌러서 문제 자리를 표시해 주세요" : "눌러서 문제 자리를 표시해 주세요"}</span>
            <span><button type="button" onClick={() => setPhase("annotate")}>표시하기</button> · <button type="button" onClick={() => file.current?.click()}>바꾸기</button> · <button type="button" onClick={() => { setImage(""); setSource("none"); setMarks(0); }}>빼기</button></span></div>
        </div> : <div className="br-nocap">
          <p>문제가 보이는 화면 사진을 붙이면 더 빨리 고칠 수 있어요(사진 없이 보내도 돼요).</p>
          <div className="br-nocap-actions">
            <button type="button" className="br-tool" onClick={() => setPhase("away")}>📷 화면 캡처하러 가기</button>
            <button type="button" className="br-tool" onClick={() => file.current?.click()}>🖼 사진 붙이기</button>
          </div>
          <p className="br-nocap-hint">휴대폰: 「캡처하러 가기」 → 전원+볼륨 아래로 캡처 → 「돌아가기」 → 「사진 붙이기」. PC: 캡처 후 이 창에서 Ctrl+V.</p>
        </div>}
        <p className="br-lbl" id="br-cat">어떤 문제인가요?</p>
        <div className="br-chips" role="radiogroup" aria-labelledby="br-cat">
          {BUG_REPORT_CATEGORIES.map(c => <button key={c} type="button" role="radio" aria-checked={category === c} className="br-chip" onClick={() => { setCategory(c); setError(""); }}>{c}</button>)}
        </div>
        <label className="br-lbl" htmlFor="br-text">무엇을 하다가 그랬나요? (선택)</label>
        <textarea id="br-text" value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="예) 계약 저장을 눌렀는데 그대로예요. 표시만 해도 충분해요." />
        <p className="br-note">{source === "upload" && image
          ? "올린 사진에 전화번호·이름이 보이면 사진을 눌러 「■ 가리기」로 덮어 주세요."
          : "보던 화면 주소·기기 정보·최근 오류가 함께 가요. 자동으로 찍은 화면은 전화번호·이름을 가려서 보내요."}</p>
        {error && <p className="br-error" role="alert">{error}</p>}
        <button type="button" className="br-primary br-send" onClick={send} disabled={phase === "sending"}>{phase === "sending" ? "보내는 중…" : "보내기"}</button>
      </div>}
    </div>
  </div>, document.body);
}
