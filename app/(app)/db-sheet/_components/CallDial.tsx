"use client";
/**
 * 📞 버튼 · 상태 칩 · 통화 앱 고르기(목업 v5 ①). 고른 앱은 이 폰에만 저장([항상 이 앱으로]), 앱 이름만 보여 준다(belie 2026-11-01).
 * 기본 전화 앱은 tel: 로 바로 건다. 익시오·에이닷·다른 녹음 앱은 번호를 복사하고 그 앱을 직접 열게 안내한다(웹에서 여는 주소 미확인).
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
  return <button type="button" className={label ? "dbs-button dbs-call-text" : "dbs-call-btn"} aria-label={`${row.company} 전화 걸기`} onClick={e => { e.stopPropagation(); onDial(); }}>
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
  const [app, setApp] = useState<CallAppId | "ask">(saved ?? "phone");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(true);

  async function go(chosen: CallAppId, keep: boolean) {
    setBusy(true); setError("");
    let ok = true;
    if (chosen !== "phone") ok = await navigator.clipboard.writeText(row.phone).then(() => true, () => false);
    try {
      const id = await startCall(row.id);
      if (keep) saveCallApp(chosen);
      onDialed({ id, leadId: row.id, at: Date.now() });
      if (chosen === "phone") { window.location.href = `tel:${phoneDigits(row.phone)}`; onClose(); return; }
      setCopied(ok);
      setStep({ kind: "copied", app: chosen, saved: keep });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  // 고정한 앱 — 📞 를 누른 바로 그 순간에 한 번 걸고 기록한다.
  const once = useRef(false);
  useEffect(() => { if (step.kind === "auto" && !once.current) { once.current = true; void go(step.app, true); } });

  if (step.kind === "auto") {
    return <SheetDialog title={`${row.company}에 전화 걸게요`} icon={<Phone size={20} />} onClose={() => { if (!busy) onClose(); }}>
      <div className="dbs-dialog-body">
        {error ? <p className="dbs-call-note is-error" role="alert">{error}</p> : <p className="dbs-call-note is-info" role="status">전화 건 기록을 남기는 중…</p>}
      </div>
      <footer className="dbs-dialog-foot"><button className="dbs-button" disabled={busy} onClick={onClose}>닫기</button></footer>
    </SheetDialog>;
  }

  if (step.kind === "copied") {
    const name = callAppName(step.app);
    return <SheetDialog title={`${row.company}에 ${euro(name)} 걸게요`} icon={<Phone size={20} />} onClose={onClose}>
      <div className="dbs-dialog-body">
        <p className="dbs-call-meta">{row.owner && `${row.owner} · `}<span className="num">{row.phone}</span></p>
        {busy ? <p className="dbs-call-note is-info" role="status">전화 건 기록을 남기는 중…</p>
          : error ? <p className="dbs-call-note is-error" role="alert">{error}</p>
          : <p className="dbs-call-note is-ok" role="status">{copied ? `번호를 복사했어요. ${eul(name)} 열어 붙여 넣고 통화하세요.` : `${eul(name)} 열어 위 번호로 통화하세요.`} 통화가 끝나고 돌아오면 녹음을 올릴 수 있어요.</p>}
        {step.saved && <p className="dbs-call-fixed">전화 버튼은 항상 {euro(name)} 걸어요 <button type="button" className="dbs-call-change" onClick={() => setStep({ kind: "pick", change: true })}>바꾸기</button></p>}
      </div>
      <footer className="dbs-dialog-foot"><button className="dbs-button primary" disabled={busy} onClick={onClose}>확인</button></footer>
    </SheetDialog>;
  }

  return <SheetDialog title={step.change ? "통화 앱" : "어느 앱으로 걸까요?"} icon={<Phone size={20} />} onClose={() => { if (!busy) onClose(); }}>
    <div className="dbs-dialog-body">
      <p className="dbs-call-meta">{row.company} · {row.owner && `${row.owner} `}<span className="num">{row.phone}</span></p>
      <div className="dbs-call-apps" role="radiogroup" aria-label="통화 앱">
        {CALL_APPS.map(a => <label key={a.id}><input type="radio" name="call-app" checked={app === a.id} onChange={() => setApp(a.id)} />{a.name}</label>)}
        {step.change && <label><input type="radio" name="call-app" checked={app === "ask"} onChange={() => setApp("ask")} />매번 묻기</label>}
      </div>
      {error && <p className="dbs-call-note is-error" role="alert">{error}</p>}
    </div>
    <footer className="dbs-dialog-foot">
      {step.change
        ? <button className="dbs-button primary" disabled={busy} onClick={() => { saveCallApp(app === "ask" ? null : app); if (app === "ask") setStep({ kind: "pick", change: false }); else void go(app, true); }}>저장하고 걸기</button>
        : <><button className="dbs-button" disabled={busy || app === "ask"} onClick={() => app !== "ask" && void go(app, false)}>이번만</button>
          <button className="dbs-button primary" disabled={busy || app === "ask"} onClick={() => app !== "ask" && void go(app, true)}>항상 이 앱으로</button></>}
    </footer>
  </SheetDialog>;
}
