"use client";
/**
 * 📞 버튼 · 상태 칩 · 통화 앱 고르기(목업 v5 ①). 앱을 누르면 바로 건다 — 「다음에도 이 앱으로」(기본 켬)면 이 폰에 저장.
 * 앱 이름만 보여 준다(belie 2026-11-01). 기본 전화 앱은 tel: 로 바로, 익시오·에이닷·다른 녹음 앱은 번호를 복사하고
 * 그 앱을 직접 열게 안내한다(웹에서 여는 주소 미확인). 글자는 50대 기준 최소(belie 2026-11-04).
 */
import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import type { CallRecord } from "@/types/call";
import SheetDialog from "./SheetDialog";
import type { Row } from "./model";
import { CALL_APPS, callAppName, callChip, eul, euro, phoneDigits, readCallApp, saveCallApp, startCall, type CallAppId } from "./call-client";
import type { DialedCall } from "./use-calls";

export function CallChip({ call }: { call?: CallRecord }) {
  const chip = call && callChip(call.status);
  return chip ? <span className={`dbs-call-chip is-${chip.tone}`}>{chip.label}</span> : null;
}

export function CallButton({ row, onDial, label = false }: { row: Row; onDial: () => void; label?: boolean }) {
  if (!phoneDigits(row.phone)) return null;
  return <button type="button" className={label ? "dbs-button dbs-call-dial" : "dbs-call-btn"} aria-label={`${row.company} 전화 걸기`} onClick={e => { e.stopPropagation(); onDial(); }}>
    <Phone size={label ? 15 : 20} strokeWidth={1.9} aria-hidden="true" />{label && "전화 걸기"}
  </button>;
}

type Step = { kind: "auto"; app: CallAppId } | { kind: "pick"; change: boolean } | { kind: "copied"; app: CallAppId; saved: boolean };

/**
 * 📞 누른 뒤. 고정한 앱이 있으면 바로 건다(기본 전화는 대화상자 없이 전화 화면으로).
 * 복사는 누른 순간에만 되는 브라우저가 있어 서버 기록보다 먼저 한다.
 */
export function CallDialDialog({ row, onDialed, onClose }: { row: Row; onDialed: (p: DialedCall) => void; onClose: () => void }) {
  const saved = readCallApp();
  const [step, setStep] = useState<Step>(() => saved ? { kind: "auto", app: saved } : { kind: "pick", change: false });
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(true);

  async function go(chosen: CallAppId, remember: boolean) {
    setBusy(true); setError("");
    let ok = true;
    if (chosen !== "phone") ok = await navigator.clipboard.writeText(row.phone).then(() => true, () => false);
    try {
      const id = await startCall(row.id);
      if (remember) saveCallApp(chosen);
      onDialed({ id, leadId: row.id, at: Date.now() });
      if (chosen === "phone") { window.location.href = `tel:${phoneDigits(row.phone)}`; onClose(); return; }
      setCopied(ok);
      setStep({ kind: "copied", app: chosen, saved: remember });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  // 고정한 앱 — 📞 를 누른 바로 그 순간에 한 번 걸고 기록한다.
  const once = useRef(false);
  useEffect(() => { if (step.kind === "auto" && !once.current) { once.current = true; void go(step.app, true); } });

  if (step.kind === "auto") {
    return <SheetDialog title={`${row.company}에 전화 거는 중`} icon={<Phone size={20} />} onClose={() => { if (!busy) onClose(); }}>
      <div className="dbs-dialog-body">
        {error ? <p className="dbs-call-note is-error" role="alert">{error}</p> : <p className="dbs-muted" role="status">잠시만요…</p>}
      </div>
      {error && <footer className="dbs-dialog-foot"><button className="dbs-button" onClick={onClose}>닫기</button></footer>}
    </SheetDialog>;
  }

  if (step.kind === "copied") {
    const name = callAppName(step.app);
    return <SheetDialog title={copied ? "번호를 복사했어요" : `${euro(name)} 걸어 주세요`} icon={<Phone size={20} />} onClose={onClose}>
      <div className="dbs-dialog-body">
        {busy ? <p className="dbs-muted" role="status">잠시만요…</p>
          : error ? <p className="dbs-call-note is-error" role="alert">{error}</p>
          : <>
            <p className="dbs-call-number num">{row.phone}</p>
            <p className="dbs-call-lead" role="status">{copied ? `${eul(name)} 열고 붙여 넣어 거세요.` : `${eul(name)} 열고 이 번호로 거세요.`}</p>
          </>}
        {step.saved && <p className="dbs-call-fixed">늘 {euro(name)} 걸어요 <button type="button" className="dbs-call-change" onClick={() => setStep({ kind: "pick", change: true })}>바꾸기</button></p>}
      </div>
      <footer className="dbs-dialog-foot"><button className="dbs-button primary" disabled={busy} onClick={onClose}>알겠어요</button></footer>
    </SheetDialog>;
  }

  // 앱을 누르면 바로 건다. 바꾸기 화면에는 「매번 묻기」가 하나 더 있다.
  return <SheetDialog title={step.change ? "전화 걸 앱 바꾸기" : "어느 앱으로 걸까요?"} icon={<Phone size={20} />} onClose={() => { if (!busy) onClose(); }}>
    <div className="dbs-dialog-body">
      <p className="dbs-call-meta">{row.company} <span className="num">{row.phone}</span></p>
      <div className="dbs-call-apps" role="group" aria-label="통화 앱">
        {CALL_APPS.map(a => <button key={a.id} type="button" className="dbs-choice-link" disabled={busy} onClick={() => void go(a.id, step.change || keep)}><strong>{a.name}</strong><Phone size={16} aria-hidden="true" /></button>)}
        {step.change && <button type="button" className="dbs-choice-link" disabled={busy} onClick={() => { saveCallApp(null); setStep({ kind: "pick", change: false }); }}><strong>매번 묻기</strong></button>}
      </div>
      {!step.change && <label className="dbs-check"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} /><strong>다음에도 이 앱으로</strong></label>}
      {error && <p className="dbs-call-note is-error" role="alert">{error}</p>}
    </div>
  </SheetDialog>;
}
