"use client";
/**
 * DB관리시트에 붙는 통화 정리 앞단 묶음 — 페이지는 slot(모바일 카드)·bar(DB정보)·layer(대화상자·알림)만 꽂는다.
 * 꺼진 사람(GET /api/calls 404)에게는 아무것도 그리지 않는다.
 */
import { useRef, useState } from "react";
import { ClipboardCheck, FileAudio, ScrollText, X } from "lucide-react";
import type { CallRecord } from "@/types/call";
import type { DbSheetLead } from "@/types/db-sheet";
import { CallConfirmScreen } from "./CallConfirmScreen";
import type { Row } from "./model";
import { CallButton, CallChip, CallDialDialog } from "./CallDial";
import { CallScriptSheet } from "./CallScriptSheet";
import { CallUploadDialog } from "./CallUploadDialog";
import { useCalls } from "./use-calls";
import { phoneDigits } from "./call-client";
import { useCallFocus } from "@/components/announcements/call-focus";
import "../call.css";

/** 이어서 올릴 수 있는 통화 — 전화만 건(녹음 필요) 또는 정리 실패. */
const resumable = (c?: CallRecord) => c && (c.status === "dialed" || c.status === "failed") ? c : null;

/** rows = DB관리시트 원본(revision·contact.ci 포함). onSaved = 확정 뒤 목록 다시 읽기. */
export function useCallUi(rows: DbSheetLead[], onSaved: () => void | Promise<void>) {
  const company = (leadId: string) => rows.find(r => r.id === leadId)?.company || "이 업체";
  const calls = useCalls(company);
  const [dial, setDial] = useState<Row | null>(null);
  const [upload, setUpload] = useState<{ row: Row; call: CallRecord | null; asked: boolean } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  // 📜 대본 창(2026-11-07 belie 모바일 기획 2판). 📞 로 실제로 건 뒤 거는 창이 닫히면 대본이 열려 있게 —
  // 전화 앱에서 돌아오면 대본이 먼저 보인다. 「번호를 복사했어요」 안내는 가리지 않는다(닫힐 때 연다).
  const [script, setScript] = useState<Row | null>(null);
  const dialedRow = useRef<Row | null>(null);
  const closeDial = () => { const r = dialedRow.current; dialedRow.current = null; setDial(null); if (r) setScript(r); };
  const review = (leadId: string) => { const c = calls.latest.get(leadId); return c?.status === "review" && c.extraction ? c : null; };
  const confirming = confirm ? { lead: rows.find(r => r.id === confirm), call: review(confirm) } : null;

  const returnedRow = calls.returned && rows.find(r => r.id === calls.returned!.leadId);
  // 대본을 보는 동안은 「방금 통화하셨나요?」를 미룬다 — 대본을 닫으면 묻는다.
  const asking = !upload && !dial && !script && returnedRow ? {
    row: returnedRow,
    call: calls.calls.find(c => c.id === calls.returned!.id && (c.status === "dialed" || c.status === "failed")) ?? null,
  } : null;

  // 번호 없는 줄도 같은 폭을 비워 둬 날짜·›가 다른 줄과 맞게.
  const slot = (r: Row) => ({ chip: <CallChip call={calls.latest.get(r.id)} />, button: phoneDigits(r.phone) ? <CallButton row={r} onDial={() => setDial(r)} /> : <span className="dbs-call-btn" aria-hidden="true" /> });
  const bar = (r: Row) => calls.enabled ? <div className="dbs-call-bar">
    <strong>통화</strong><CallChip call={calls.latest.get(r.id)} />
    <span className="dbs-call-actions">
      {review(r.id) && <button type="button" className="dbs-button primary" onClick={() => setConfirm(r.id)}><ClipboardCheck size={16} aria-hidden="true" />확인하기</button>}
      <CallButton row={r} label onDial={() => setDial(r)} />
      <button type="button" className="dbs-button dbs-call-text" onClick={() => setUpload({ row: r, call: resumable(calls.latest.get(r.id)), asked: false })}><FileAudio size={16} aria-hidden="true" />녹음 올리기</button>
    </span>
    <button type="button" className="dbs-button dbs-call-script" onClick={() => setScript(r)}><ScrollText size={16} aria-hidden="true" />대본 보기</button>
  </div> : null;

  // 「정리 기다리는 통화 N건」(2026-11-07 belie 모바일 기획 2판 ③) — 최근 7일, 내가 할 일이 남은 통화
  // (녹음 필요·정리 실패·확인 필요). 0건이면 줄이 없다. 누르면 그 업체만 걸러 보고, 다시 누르면 전체.
  const pending = rows.filter(r => { const s = calls.latest.get(r.id)?.status; return s === "dialed" || s === "failed" || s === "review"; }).map(r => r.id);
  const strip = (on: boolean, toggle: () => void) => calls.enabled && (pending.length > 0 || on) ? <button type="button" className={`dbs-pending-strip${on ? " is-on" : ""}`} aria-pressed={on} onClick={toggle}>
    <FileAudio size={16} aria-hidden="true" /><span>정리 기다리는 통화 <b className="num">{pending.length}</b>건</span><em>{on ? "전체 보기" : "모아 보기 ›"}</em>
  </button> : null;

  // 통화 창이 하나라도 열려 있으면 새소식 팝업을 미룬다(2026-11-07 PR4).
  useCallFocus(!!(dial || upload || asking || confirming || script));

  const layer = <>
    {dial && <CallDialDialog row={dial} onDialed={p => { dialedRow.current = dial; calls.dialed(p); }} onClose={closeDial} />}
    {script && <CallScriptSheet company={script.company || "이 업체"} onClose={() => setScript(null)} />}
    {upload && <CallUploadDialog row={upload.row} call={upload.call} asked={upload.asked} onUploaded={id => calls.uploaded(id, upload.row.id)} onClose={() => setUpload(null)} />}
    {asking && <CallUploadDialog row={asking.row} call={asking.call} asked onUploaded={id => calls.uploaded(id, asking.row.id)} onClose={calls.clearReturned} />}
    {confirming?.lead && confirming.call && <CallConfirmScreen lead={confirming.lead} call={confirming.call} onClose={() => setConfirm(null)} onSaved={async () => {
      const company = confirming.lead!.company || "이 업체";
      setConfirm(null); await onSaved(); await calls.refresh(); calls.say(`${company} 저장했어요.`);
    }} />}
    {calls.toast && <div className="sheet-toast dbs-call-toast" role="status"><span>{calls.toast.text}</span>
      {calls.toast.open && <button type="button" onClick={() => { setConfirm(calls.toast!.open!); calls.clearToast(); }}>확인하기</button>}
      <button type="button" aria-label="알림 닫기" onClick={calls.clearToast}><X size={16} aria-hidden="true" /></button></div>}
  </>;
  return { enabled: calls.enabled, slot, bar, layer, pending, strip };
}
