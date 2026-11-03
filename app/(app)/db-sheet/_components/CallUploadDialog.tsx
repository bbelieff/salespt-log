"use client";
/**
 * 녹음 올리기(목업 v5 ③④). 업체는 📞 를 누른 줄(또는 연 DB정보)로 이미 정해져 있고, 파일은 「그 통화가 맞나」만 본다:
 * 파일 이름의 번호 = 📞 번호가 1차, 저장 시각이 📞 시각과 30분 넘게 어긋나면 2차로 한 번 묻는다.
 * 📞 없이 건 통화는 녹음 저장 시각을 통화 시각으로 쓴다(「다음 주 화요일」의 기준).
 */
import { useRef, useState } from "react";
import { FileAudio } from "lucide-react";
import type { CallRecord } from "@/types/call";
import SheetDialog from "./SheetDialog";
import type { Row } from "./model";
import { CALL_AUDIO_ACCEPT, checkRecording, hhmm, isIos, startCall, uploadCallAudio, uploadCallText } from "./call-client";

const WEEK_MS = 7 * 86_400_000;
const size = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;

/** call = 이어서 올릴 통화(전화 걸음·정리 실패). 없으면 새 통화로 기록한다. asked = 📞 뒤 돌아와서 연 경우. */
export function CallUploadDialog({ row, call, asked, onUploaded, onClose }: {
  row: Row; call: CallRecord | null; asked: boolean; onUploaded: (id: string) => void; onClose: () => void;
}) {
  const ios = typeof navigator !== "undefined" && isIos(navigator.userAgent);
  const [tab, setTab] = useState<"audio" | "text">("audio");
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialedAt = call ? Date.parse(call.calledAt) : null;
  const check = file && checkRecording(file, row.phone, dialedAt);

  async function send() {
    setBusy(true); setError("");
    try {
      let id = call?.id;
      if (!id) {
        const at = tab === "audio" && file && Date.now() - file.lastModified < WEEK_MS ? new Date(Math.min(file.lastModified, Date.now())).toISOString() : undefined;
        id = await startCall(row.id, at);
      }
      if (tab === "audio" && file) await uploadCallAudio(id, file); else await uploadCallText(id, text);
      onUploaded(id);
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const title = asked ? `방금 ${row.company}와 통화하셨나요?` : `${row.company} 통화 녹음 올리기`;
  const meta = [call ? `전화 건 시각 ${hhmm(call.calledAt)}` : "", [row.owner, row.phone].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const pick = <input ref={input} type="file" accept={`${CALL_AUDIO_ACCEPT},audio/*`} hidden onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); e.target.value = ""; }} />;

  let body: React.ReactNode, foot: React.ReactNode;
  if (tab === "text") {
    body = <>
      <ol className="dbs-call-steps"><li><span><b>익시오</b> › 방금 통화 › 통화 내용 글자 › 전체 복사</span></li></ol>
      <textarea className="sheet-input dbs-call-paste" aria-label="통화 내용 붙여 넣기" placeholder="여기에 붙여 넣기" value={text} onChange={e => setText(e.target.value)} />
      <p className="dbs-call-note is-info">글자만 보내므로 녹음은 폰 밖으로 나가지 않아요.</p>
    </>;
    foot = <button className="dbs-button primary" disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? "보내는 중…" : "이 글자로 정리하기"}</button>;
  } else if (!file) {
    body = ios
      ? <ol className="dbs-call-steps"><li><span><b>익시오</b> › 방금 통화 › 공유 › <b>「파일에 저장」</b><small>처음 한 번만 저장 위치를 정하면 다음부터 같은 곳</small></span></li><li><span>여기로 돌아와 <b>[녹음 파일 고르기]</b> › 「찾아보기」 › 저장한 녹음</span></li></ol>
      : <ol className="dbs-call-steps"><li><span>아래 <b>[녹음 파일 고르기]</b><small>파일 선택 창이 열려요</small></span></li><li><span><b>내 파일 › Recordings › Call</b> 맨 위 파일<small>갤럭시 기본 통화녹음이 저장되는 곳</small></span></li></ol>;
    foot = <>{asked && <button className="dbs-button" disabled={busy} onClick={onClose}>나중에 올릴게요</button>}<button className="dbs-button primary" onClick={() => input.current?.click()}>녹음 파일 고르기</button></>;
  } else {
    const c = check!;
    body = <>
      <div className="dbs-call-file"><FileAudio size={20} aria-hidden="true" /><div><strong>{file.name}</strong><small className="num">{size(file.size)}</small></div></div>
      {c.fileError ? <p className="dbs-call-note is-error" role="alert">{c.fileError}</p>
        : c.warn === "phone" ? <p className="dbs-call-note is-warn" role="status">이 녹음은 <b className="num">{c.namePhone}</b> 통화예요. 전화는 {row.company} <b className="num">{row.phone}</b>로 걸었어요. 다른 통화 녹음 아닌가요?</p>
        : c.warn === "time" ? <p className="dbs-call-note is-warn" role="status">녹음 시각이 전화 건 시각과 {c.minutesOff}분 차이 나요. 다른 통화 녹음 아닌가요?</p>
        : <p className="dbs-call-note is-ok" role="status">{c.phoneMatch ? <>번호 <span className="num">{c.namePhone}</span> 일치 — {row.company}와 한 통화예요.</> : `${row.company} 통화 녹음으로 올려요.`}</p>}
      {!c.fileError && <p className="dbs-call-note is-info">녹음은 정리를 위해 Google AI 로 보내고, 정리가 끝나면 바로 지워요.</p>}
    </>;
    foot = <><button className="dbs-button" disabled={busy} onClick={() => input.current?.click()}>다른 파일 고르기</button>
      <button className="dbs-button primary" disabled={busy || !!c.fileError} onClick={() => void send()}>{busy ? "올리는 중…" : c.warn ? "이 녹음이 맞아요" : "정리 시작"}</button></>;
  }

  return <SheetDialog title={title} icon={<FileAudio size={20} />} onClose={() => { if (!busy) onClose(); }}>
    <div className="dbs-dialog-body">
      {meta && <p className="dbs-call-meta num">{meta}</p>}
      {ios && !file && <div className="dbs-call-tabs" role="tablist" aria-label="올릴 방법">
        <button type="button" role="tab" aria-selected={tab === "audio"} onClick={() => setTab("audio")}>녹음 파일</button>
        <button type="button" role="tab" aria-selected={tab === "text"} onClick={() => setTab("text")}>글자 붙여 넣기</button>
      </div>}
      {body}
      {error && <p className="dbs-call-note is-error" role="alert">{error}</p>}
      {pick}
    </div>
    <footer className="dbs-dialog-foot">{foot}</footer>
  </SheetDialog>;
}
