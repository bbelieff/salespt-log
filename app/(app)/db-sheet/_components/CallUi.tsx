"use client";
/**
 * DB관리시트에 붙는 통화 정리 앞단 묶음 — 페이지는 slot(모바일 카드)·bar(DB정보)·layer(대화상자·알림)만 꽂는다.
 * 꺼진 사람(GET /api/calls 404)에게는 아무것도 그리지 않는다.
 */
import { useState } from "react";
import { FileAudio, X } from "lucide-react";
import type { CallRecord } from "@/types/call";
import type { Row } from "./model";
import { CallButton, CallChip, CallDialDialog } from "./CallDial";
import { CallUploadDialog } from "./CallUploadDialog";
import { useCalls } from "./use-calls";
import { phoneDigits } from "./call-client";
import "../call.css";

/** 이어서 올릴 수 있는 통화 — 전화만 건(녹음 대기) 또는 정리 실패. */
const resumable = (c?: CallRecord) => c && (c.status === "dialed" || c.status === "failed") ? c : null;

export function useCallUi(rows: Row[]) {
  const company = (leadId: string) => rows.find(r => r.id === leadId)?.company || "이 업체";
  const calls = useCalls(company);
  const [dial, setDial] = useState<Row | null>(null);
  const [upload, setUpload] = useState<{ row: Row; call: CallRecord | null; asked: boolean } | null>(null);

  const returnedRow = calls.returned && rows.find(r => r.id === calls.returned!.leadId);
  const asking = !upload && !dial && returnedRow ? {
    row: returnedRow,
    call: calls.calls.find(c => c.id === calls.returned!.id && (c.status === "dialed" || c.status === "failed")) ?? null,
  } : null;

  // 번호 없는 줄도 같은 폭을 비워 둬 날짜·›가 다른 줄과 맞게.
  const slot = (r: Row) => ({ chip: <CallChip call={calls.latest.get(r.id)} />, button: phoneDigits(r.phone) ? <CallButton row={r} onDial={() => setDial(r)} /> : <span className="dbs-call-btn" aria-hidden="true" /> });
  const bar = (r: Row) => calls.enabled ? <div className="dbs-call-bar">
    <strong>통화</strong><CallChip call={calls.latest.get(r.id)} />
    <span className="dbs-call-actions">
      <CallButton row={r} label onDial={() => setDial(r)} />
      <button type="button" className="dbs-button dbs-call-text" onClick={() => setUpload({ row: r, call: resumable(calls.latest.get(r.id)), asked: false })}><FileAudio size={15} aria-hidden="true" />통화 녹음 올리기</button>
    </span>
  </div> : null;

  const layer = <>
    {dial && <CallDialDialog row={dial} onDialed={calls.dialed} onClose={() => setDial(null)} />}
    {upload && <CallUploadDialog row={upload.row} call={upload.call} asked={upload.asked} onUploaded={id => calls.uploaded(id, upload.row.id)} onClose={() => setUpload(null)} />}
    {asking && <CallUploadDialog row={asking.row} call={asking.call} asked onUploaded={id => calls.uploaded(id, asking.row.id)} onClose={calls.clearReturned} />}
    {calls.toast && <div className="sheet-toast dbs-call-toast" role="status"><span>{calls.toast}</span><button type="button" aria-label="알림 닫기" onClick={calls.clearToast}><X size={16} aria-hidden="true" /></button></div>}
  </>;
  return { enabled: calls.enabled, slot, bar, layer };
}
