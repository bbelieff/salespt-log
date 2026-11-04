"use client";
/**
 * 「통화 정리 확인」(plan call-summary PR-5b, 목업 통화확인_목업.html). [저장하기] 전에는 아무것도 저장하지 않는다.
 * 폰 = 요약 → 미팅 → 컨택결과 → 업체정보 한 줄, PC(1024px~) = 왼쪽 요약·미팅·결과 / 오른쪽 업체정보.
 * 저장은 POST /api/calls/[id]/confirm 한 번 — DB관리시트 저장·컨택 기록·(켰으면) 미팅카드.
 * 글자는 50대 기준 최소(belie 2026-11-04): 같은 말 반복·내부 용어(STEP)·「빈칸 채움」 꼬리표·같은 값 줄을 뺀다. 부품·용어는 DB정보와 같게.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { CallRecord } from "@/types/call";
import { DB_SHEET_RESULTS, dbSheetResultLabel, type DbSheetLead } from "@/types/db-sheet";
import { buildCiRows, confirmBlocker, confirmBody, missingQuestions, noteDraft, timeOptions, type CiRow, type ConfirmState, type DbSheetResult } from "./call-confirm-model";
import { confirmCall, hhmm } from "./call-client";

const QUESTIONS = ["대표 여부·법인/개인·상호", "업종", "창업연월", "연 매출", "올해 매출", "사업자 대출", "개인 대출", "4대보험", "수출·배달·키오스크", "특허·인증", "신용점수", "필요 자금"];
const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);
const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(iso));

export function CallConfirmScreen({ lead, call, onSaved, onClose }: { lead: DbSheetLead; call: CallRecord; onSaved: () => void; onClose: () => void }) {
  const x = call.extraction!;
  const built = useMemo(() => buildCiRows(call, x, lead.contact.ci), [call, x, lead.contact.ci]);
  const [s, setS] = useState<ConfirmState>(() => ({
    revision: lead.revision, date: kstDate(call.calledAt), result: x.meeting ? "컨택진행" : "",
    note: noteDraft(lead.contact.note, x.memo), rows: built.rows, baseYear: built.baseYear, hasBaseYear: !!Number(lead.contact.ci.매출기준연도),
    meetingOn: !!x.meeting, meeting: x.meeting ?? { meetingDate: "", time: "", place: "", reservationNote: "" }, lead: x.lead,
  }));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { top.current?.focus(); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  const setRow = (key: string, patch: Partial<CiRow>) => setS(v => ({ ...v, rows: v.rows.map(r => r.key === key ? { ...r, ...patch } : r) }));
  const setMeeting = (patch: Partial<ConfirmState["meeting"]>) => setS(v => ({ ...v, meeting: { ...v.meeting, ...patch } }));
  const picked = s.rows.filter(r => r.checked && r.status !== "same").length;
  const blocker = confirmBlocker(s);
  const missing = missingQuestions(x.answered);

  async function save() {
    setBusy(true); setError("");
    try { await confirmCall(call.id, confirmBody(s)); onSaved(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  // 지금 값과 같은 칸은 넣을 게 없어 보여 주지 않는다.
  const groups = (["대표자", "기업정보", "재무", "추가 칸"] as const).map(g => [g, s.rows.filter(r => r.group === g && r.status !== "same")] as const).filter(([, rs]) => rs.length);

  return <div className="dbs-cc" role="dialog" aria-modal="true" aria-labelledby="dbs-cc-title">
    <header className="dbs-cc-top"><div className="dbs-cc-top-in" ref={top} tabIndex={-1}>
      <button type="button" className="dbs-cc-back" aria-label="닫기" disabled={busy} onClick={onClose}><ChevronLeft size={20} aria-hidden="true" /></button>
      <h1 id="dbs-cc-title">통화 정리 확인</h1>
    </div></header>

    <main className="dbs-cc-main">
      <div className="dbs-cc-col">
        <section className="dbs-cc-panel" aria-labelledby="dbs-cc-lead">
          <div className="dbs-cc-lead"><strong id="dbs-cc-lead">{lead.company || x.lead.company || "업체명 없음"}</strong>{lead.owner && <span>{lead.owner} 대표</span>}</div>
          <p className="dbs-cc-facts num">{dayLabel(call.calledAt)} {hhmm(call.calledAt)} 통화</p>
          {missing.length > 0 && <p className="dbs-cc-miss"><b>못 물어본 것</b> {missing.map(n => QUESTIONS[n - 1]).join(", ")}</p>}
          {x.summary.length > 0 && <ul className="dbs-cc-summary">{x.summary.map(t => <li key={t}>{t}</li>)}</ul>}
          <label className="dbs-cc-field">상담메모
            <textarea className="sheet-input" rows={5} value={s.note} onChange={e => setS(v => ({ ...v, note: e.target.value }))} /></label>
          {call.transcript && <details className="dbs-cc-raw"><summary>통화 원문 보기</summary><p>{call.transcript}</p></details>}
        </section>

        <section className="dbs-cc-panel" aria-labelledby="dbs-cc-meet">
          <div className="dbs-cc-panel-h"><h2 id="dbs-cc-meet">미팅</h2>
            <label className="dbs-cc-switch"><input type="checkbox" checked={s.meetingOn} onChange={e => setS(v => ({ ...v, meetingOn: e.target.checked }))} />미팅 카드 만들기</label></div>
          {s.meetingOn ? <div className="dbs-cc-stack">
            {x.evidence.meeting && <p className="dbs-cc-said">“{x.evidence.meeting}”</p>}
            {x.meeting && !x.meeting.meetingDate && <p className="dbs-call-note is-warn">들은 날짜가 달력과 안 맞아요. 날짜를 골라 주세요.</p>}
            <div className="dbs-cc-two">
              <label className="dbs-cc-field">날짜<input type="date" className="sheet-input num" value={s.meeting.meetingDate} onChange={e => setMeeting({ meetingDate: e.target.value })} /></label>
              <label className="dbs-cc-field">시간<select className="sheet-input num" value={s.meeting.time} onChange={e => setMeeting({ time: e.target.value })}><option value="">고르기</option>{timeOptions(s.meeting.time).map(t => <option key={t}>{t}</option>)}</select></label>
            </div>
            <label className="dbs-cc-field">장소<input className="sheet-input" value={s.meeting.place} onChange={e => setMeeting({ place: e.target.value })} /></label>
            <label className="dbs-cc-field">예약비고<textarea className="sheet-input" rows={2} maxLength={500} value={s.meeting.reservationNote} onChange={e => setMeeting({ reservationNote: e.target.value })} /></label>
          </div> : <p className="dbs-cc-empty">{x.meeting ? "미팅을 잡지 않아요." : "미팅 약속 없음"}</p>}
        </section>

        {/* 미팅 카드를 만들면 결과는 미팅예약으로 정해지므로 묻지 않는다. 고르는 방식은 DB정보 「컨택결과」 드롭다운과 같다. */}
        {!s.meetingOn && <section className="dbs-cc-panel" aria-labelledby="dbs-cc-result">
          <h2 id="dbs-cc-result" className="dbs-cc-h2">컨택결과</h2>
          <select className="sheet-input" aria-label="컨택결과" value={s.result} onChange={e => setS(v => ({ ...v, result: e.target.value as DbSheetResult }))}>
            <option value="">고르기</option>{DB_SHEET_RESULTS.filter(r => r !== "미컨택" && r !== "컨택진행").map(r => <option key={r} value={r}>{dbSheetResultLabel(r)}</option>)}</select>
        </section>}
      </div>

      <section className="dbs-cc-panel dbs-cc-ci" aria-labelledby="dbs-cc-ci">
        <div className="dbs-cc-panel-h"><h2 id="dbs-cc-ci">업체정보</h2><span className="num">{picked}칸 넣기</span></div>
        {built.dropped.length > 0 && <p className="dbs-call-note is-warn">{built.dropped.join("·")}년 매출은 칸이 없어 넣지 않아요.</p>}
        {groups.length === 0 && <p className="dbs-cc-empty">새로 넣을 업체정보 없음</p>}
        {groups.map(([g, rs]) => <div key={g} className="dbs-cc-group"><h3>{g}{g === "재무" && <small> · 백만원</small>}</h3>
          {rs.map(r => <div key={r.key} className={`dbs-cc-row is-${r.status}${r.checked ? " is-on" : ""}`}>
            <input type="checkbox" aria-label={`${r.label} 넣기`} checked={r.checked && r.status !== "same"} disabled={r.status === "same"} onChange={e => setRow(r.key, { checked: e.target.checked })} />
            <div>
              <div className="dbs-cc-label"><span>{r.label}</span>{r.sensitive && <span className="dbs-cc-tag is-priv">민감</span>}</div>
              {r.value.length > 40 || r.value.includes("\n")
                ? <textarea className="sheet-input" rows={2} aria-label={r.label} value={r.value} disabled={r.status === "same"} onChange={e => setRow(r.key, { value: e.target.value, checked: true })} />
                : <input className="sheet-input num" aria-label={r.label} value={r.value} disabled={r.status === "same"} onChange={e => setRow(r.key, { value: e.target.value, checked: true })} />}
              {r.status === "keep" && <small className="dbs-cc-cur">지금: {r.current}</small>}
              {r.evidence && <small className="dbs-cc-src">“{r.evidence}”</small>}
            </div>
          </div>)}
        </div>)}
      </section>
    </main>

    <footer className="dbs-cc-foot"><div className="dbs-cc-foot-in">
      <p role="status">{error ? <span className="dbs-cc-err">{error}</span> : blocker ? <span className="dbs-cc-block">{blocker}</span> : null}</p>
      <button type="button" className="dbs-button" disabled={busy} onClick={onClose}>나중에</button>
      <button type="button" className="dbs-button primary" disabled={busy || !!blocker} onClick={() => void save()}>{busy ? "저장 중…" : "저장하기"}</button>
    </div></footer>
  </div>;
}
