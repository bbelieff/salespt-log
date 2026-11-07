"use client";
/**
 * 「＋ DB 추가」에 통화 녹음·받아쓴 글을 놓은 뒤(plan db-add-one-button, 목업 J3·K2) — 꼭 필요한 것만:
 * 고른 파일(이름·녹음한 때·길이) · 채널 4개 · [정리 시작]. 목록에 같은 번호가 있으면 채널을 묻지 않고 그 업체 통화로 올린다.
 * 이 폰에서 처음 보낼 때 외부 AI 고지(plan call-summary D6)를 한 번 보여 준다 — 문구는 「녹음 올리기」와 같다.
 */
import { useEffect, useState } from "react";
import { FileAudio, FileText } from "lucide-react";
import ChannelBadge from "@/components/ui/ChannelBadge";
import type { Row } from "./model";
import { checkRecording, isCallTextFile, readCallNotice, saveCallNotice } from "./call-client";
import { CALL_IMPORT_CHANNELS, callFilePhone, durationLabel, leadByPhone, recordedAt, recordedLabel, type CallImportChannel } from "./call-import";

export function CallImportStep({ file, rows, onPick, onStart, onCancel }: {
  file: File; rows: Row[]; onPick: () => void; onCancel: () => void;
  onStart: (channel: CallImportChannel | null, existingId: string | null) => Promise<void>;
}) {
  const [channel, setChannel] = useState<CallImportChannel | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [notice, setNotice] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const text = isCallTextFile(file.name);
  const fileError = checkRecording(file, "", null).fileError;
  const existing = leadByPhone(rows, callFilePhone(file.name));
  const when = recordedAt(file);

  // 녹음 길이 — 브라우저가 읽을 수 있으면 보여 주고, 못 읽으면 뺀다.
  useEffect(() => {
    setSeconds(null);
    if (text || typeof Audio === "undefined" || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(file), audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => setSeconds(audio.duration);
    audio.src = url;
    return () => { audio.onloadedmetadata = null; audio.src = ""; URL.revokeObjectURL(url); };
  }, [file, text]);

  async function start() {
    if (!readCallNotice()) { setNotice(true); return; }
    setNotice(false); setBusy(true); setError("");
    try { await onStart(existing ? null : channel, existing?.id ?? null); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const meta = [recordedLabel(when.ms), durationLabel(seconds), text ? "통화 내용" : "통화 녹음"].filter(Boolean).join(" · ");
  const ready = !fileError && (!!existing || !!channel);

  return <>
    <div className="ai-body ai-call-step">
      {notice ? <>
        <p className="ai-call-h">처음 한 번만 확인해 주세요</p>
        <ul className="dbs-call-notice">
          <li>녹음은 Google AI 로 보내 정리해요. AI 학습에는 쓰이지 않아요.</li>
          <li>녹음 파일은 정리 후 바로 지워요.</li>
          <li>통화 상대에게 녹음 사실을 알려 주세요.</li>
        </ul>
      </> : <>
        <div className={`ai-call-file${fileError ? " is-error" : ""}`}>
          {text ? <FileText size={18} aria-hidden="true" /> : <FileAudio size={18} aria-hidden="true" />}
          <span className="ai-call-file-name"><b>{file.name}</b><small className="num">{fileError || meta}</small></span>
          <button type="button" className="ai-call-change" disabled={busy} onClick={onPick}>바꾸기</button>
        </div>
        {!fileError && (existing
          ? <p className="ai-call-existing" role="status">목록의 <b>{existing.company || existing.owner || existing.phone}</b> 통화로 올려요</p>
          : <>
            <p className="ai-call-h" id="ai-call-channel">어디서 온 DB인가요?</p>
            <div className="ai-call-channels" role="radiogroup" aria-labelledby="ai-call-channel">
              {CALL_IMPORT_CHANNELS.map(c => <button key={c} type="button" role="radio" aria-checked={channel === c} disabled={busy} className={`ai-call-channel${channel === c ? " is-on" : ""}`} onClick={() => setChannel(c)}><ChannelBadge channel={c} /></button>)}
            </div>
          </>)}
      </>}
      {error && <p role="alert" className="ai-error">{error}</p>}
    </div>
    <footer className="ai-footer">
      <span />
      {notice
        ? <><button className="sheet-btn" disabled={busy} onClick={() => setNotice(false)}>취소</button>
          <button className="sheet-btn primary" disabled={busy} onClick={() => { saveCallNotice(); void start(); }}>{busy ? "올리는 중…" : "확인하고 올리기"}</button></>
        : <><button className="sheet-btn" disabled={busy} onClick={onCancel}>취소</button>
          <button className="sheet-btn primary" disabled={!ready || busy} onClick={() => void start()}>{busy ? "올리는 중…" : "정리 시작"}</button></>}
    </footer>
  </>;
}
