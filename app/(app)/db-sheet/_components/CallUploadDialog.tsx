"use client";
/**
 * 녹음 올리기(목업 v5 ③④). 업체는 📞 를 누른 줄(또는 연 DB정보)로 이미 정해져 있고, 파일은 「그 통화가 맞나」만 본다:
 * 파일 이름의 번호 = 📞 번호가 1차, 저장 시각이 📞 시각과 30분 넘게 어긋나면 2차로 한 번 묻는다.
 * 📞 없이 건 통화는 녹음 저장 시각을 통화 시각으로 쓴다(「다음 주 화요일」의 기준).
 * 이 폰에서 처음 보낼 때 외부 AI 고지(D6)를 한 번 보여 준다. 글자는 50대 기준 최소(belie 2026-11-04).
 * 받아쓴 통화 내용 파일(.txt·.pdf)도 같은 자리에서 고른다 — 글만 뽑아 글자 경로로 보낸다(belie 2026-11-05).
 * 「내 파일 › Recordings › Call」은 갤럭시 기본 전화 앱의 녹음 자리 — 익시오·에이닷은 녹음을 앱 안에 두므로 아이폰처럼 앱에서 저장하게 안내한다.
 */
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileAudio, FileText } from "lucide-react";
import type { CallRecord } from "@/types/call";
import SheetDialog from "./SheetDialog";
import type { Row } from "./model";
import { CALL_AUDIO_ACCEPT, callAppName, checkRecording, isCallTextFile, isIos, readCallApp, readCallNotice, readCallTextFile, saveCallNotice, startCall, uploadCallAudio, uploadCallText } from "./call-client";

const WEEK_MS = 7 * 86_400_000;
const size = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;

/** call = 이어서 올릴 통화(전화 걸음·정리 실패). 없으면 새 통화로 기록한다. asked = 📞 뒤 돌아와서 연 경우. */
export function CallUploadDialog({ row, call, asked, onUploaded, onClose }: {
  row: Row; call: CallRecord | null; asked: boolean; onUploaded: (id: string) => void; onClose: () => void;
}) {
  const ios = typeof navigator !== "undefined" && isIos(navigator.userAgent);
  const saved = readCallApp();
  const inApp = saved === "ixio" || saved === "adot";
  const app = inApp ? callAppName(saved) : "녹음 앱";
  const [tab, setTab] = useState<"audio" | "text">("audio");
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialedAt = call ? Date.parse(call.calledAt) : null;
  const check = file && checkRecording(file, row.phone, dialedAt);

  async function send() {
    if (!readCallNotice()) { setNotice(true); return; }
    setNotice(false); setBusy(true); setError("");
    try {
      let id = call?.id;
      if (!id) {
        const at = tab === "audio" && file && Date.now() - file.lastModified < WEEK_MS ? new Date(Math.min(file.lastModified, Date.now())).toISOString() : undefined;
        id = await startCall(row.id, at);
      }
      if (tab === "audio" && file) await (isCallTextFile(file.name) ? uploadCallText(id, await readCallTextFile(file)) : uploadCallAudio(id, file));
      else await uploadCallText(id, text);
      onUploaded(id);
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const title = notice ? "처음 한 번만 확인해 주세요" : asked ? `방금 ${row.company}와 통화하셨나요?` : `${row.company} 녹음 올리기`;
  const pick = <input ref={input} type="file" accept={`${CALL_AUDIO_ACCEPT},audio/*`} hidden onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); e.target.value = ""; }} />;
  const later = asked && <button className="dbs-button" disabled={busy} onClick={onClose}>나중에</button>;

  let body: React.ReactNode, foot: React.ReactNode;
  if (notice) {
    // 첫 업로드 고지(plan call-summary D6) — 이 폰에서 한 번. Google 쪽 처리는 Gemini API 약관(유료 서비스) 그대로.
    body = <>
      <ul className="dbs-call-notice">
        <li>녹음은 Google AI 로 보내 정리해요. AI 학습에는 쓰이지 않아요.</li>
        <li>녹음 파일은 정리 후 바로 지워요.</li>
        <li>통화 상대에게 녹음 사실을 알려 주세요.</li>
      </ul>
      <details className="dbs-call-more"><summary className="dbs-text-button">자세히</summary>
        <p className="dbs-muted">Google 은 유료 서비스로 받은 내용을 학습에 쓰지 않는다고 약관에 밝히고 있어요. 다만 부정 사용을 막으려고 일정 기간 기록하고, 처리는 해외에서 될 수 있어요. 통화 원문 글과 정리 결과는 통화 기록으로 남고, 확인하고 저장한 내용만 DB정보에 들어가요. 자택 주소·주민등록번호는 정리하지 않아요.</p>
      </details>
    </>;
    foot = <><button className="dbs-button" onClick={() => setNotice(false)}>취소</button>
      <button className="dbs-button primary" onClick={() => { saveCallNotice(); void send(); }}>확인하고 올리기</button></>;
  } else if (tab === "text") {
    body = <textarea className="sheet-input dbs-call-paste" aria-label="받아쓴 통화 내용" placeholder={`${app}에서 받아쓴 통화 내용을 복사해 붙여 넣으세요`} value={text} onChange={e => setText(e.target.value)} />;
    foot = <><button className="dbs-button" disabled={busy} onClick={() => setTab("audio")}>녹음으로 올리기</button>
      <button className="dbs-button primary" disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? "올리는 중…" : "올리기"}</button></>;
  } else if (!file) {
    body = <>
      <p className="dbs-call-lead">{ios ? <>{app}에서 녹음이나 통화 내용(.txt·.pdf)을 <b>「파일에 저장」</b>한 뒤 골라 주세요.</>
        : inApp ? <>{app}에서 녹음이나 통화 내용(.txt·.pdf)을 <b>폰에 저장</b>한 뒤 골라 주세요.</>
        : <>녹음은 <b>내 파일 › Recordings › Call</b> 맨 위에 있어요. 통화 내용(.txt·.pdf)도 돼요.</>}</p>
      {(ios || inApp) && <button type="button" className="dbs-text-button" onClick={() => setTab("text")}>녹음 대신 받아쓴 글 붙여 넣기</button>}
      {/* 안드로이드 Chrome 은 녹음 파일 고르기 전에 「오디오 녹음 허용?」을 묻는다(코드로 못 없앰, 실기기 2026-11-05) — 거절해도 고르기는 열린다. */}
      {!ios && <p className="dbs-muted">녹음 허용을 물으면 「허용 안 함」도 괜찮아요.</p>}
    </>;
    foot = <>{later}<button className="dbs-button primary" onClick={() => input.current?.click()}>파일 고르기</button></>;
  } else {
    const c = check!;
    const ok = !c.fileError && !c.warn;
    body = <>
      <div className={`dbs-file dbs-call-file is-${c.fileError ? "error" : c.warn ? "warn" : "ok"}`}>
        {c.fileError || c.warn ? <AlertTriangle size={20} aria-hidden="true" /> : ok && c.phoneMatch ? <CheckCircle2 size={20} aria-hidden="true" /> : isCallTextFile(file.name) ? <FileText size={20} aria-hidden="true" /> : <FileAudio size={20} aria-hidden="true" />}
        <span>
          <strong role="status">{c.fileError || (c.warn === "phone" ? "번호가 달라요" : c.warn === "time" ? `통화 시각과 ${c.minutesOff}분 차이 나요` : c.phoneMatch ? `${row.company} 통화가 맞아요` : `${row.company} 통화로 올려요`)}</strong>
          {c.warn === "phone"
            ? <small className="num">녹음 {c.namePhone} · 업체 {row.phone}</small>
            : <small className="num">{file.name} · {size(file.size)}</small>}
        </span>
      </div>
    </>;
    foot = <><button className="dbs-button" disabled={busy} onClick={() => input.current?.click()}>다른 파일</button>
      {!c.fileError && <button className="dbs-button primary" disabled={busy} onClick={() => void send()}>{busy ? "올리는 중…" : c.warn ? "그래도 올리기" : "올리기"}</button>}</>;
  }

  return <SheetDialog title={title} icon={<FileAudio size={20} />} onClose={() => { if (!busy) onClose(); }}>
    <div className="dbs-dialog-body">
      {body}
      {error && <p className="dbs-call-note is-error" role="alert">{error}</p>}
      {pick}
    </div>
    <footer className="dbs-dialog-foot">{foot}</footer>
  </SheetDialog>;
}
