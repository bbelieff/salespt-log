"use client";
/**
 * 부재 기록(2026-10-23 belie) — 전화를 건 날짜·시각(08~21시)을 쌓아 다음 통화 시간대를 바꿔 볼 수 있게 한다.
 * 컨택결과·STEP 2 실적은 바꾸지 않는다(결과는 위 컨택결과에서). 미팅이 연결된 업체에는 보이지 않는다.
 */
import { useState } from "react";
import { DB_SHEET_CALL_HOURS, dbSheetAbsenceHint, type DbSheetAbsence } from "@/types/db-sheet";
import { todayKST } from "@/util/week";
import type { Row } from "./model";

const SHOWN = 6;
const nowHour = () => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date()));
  return Math.min(21, Math.max(8, Number.isFinite(h) ? h : 10));
};

export function AbsenceLog({ row, onAbsence }: { row: Pick<Row, "id" | "meetingId" | "absences">; onAbsence: (entry: DbSheetAbsence, remove?: boolean) => Promise<unknown> }) {
  const [date, setDate] = useState(() => todayKST());
  const [hour, setHour] = useState(nowHour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [all, setAll] = useState(false);
  if (row.meetingId) return null;
  const list = row.absences ?? [];
  const tried = new Set(list.map(a => a.hour));
  const shown = [...list].reverse().slice(0, all ? list.length : SHOWN);
  async function run(entry: DbSheetAbsence, remove = false) {
    setBusy(true); setError("");
    try { await onAbsence(entry, remove); } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요. 다시 시도해 주세요."); } finally { setBusy(false); }
  }
  return <section className="db-absence" aria-label="부재 기록">
    <div className="db-absence-head"><strong>부재 기록</strong>{list.length > 0 && <span>{list.length}번</span>}</div>
    {list.length > 0 && <ol className="db-absence-list">
      {shown.map(a => <li key={`${a.date}-${a.hour}`}>
        <span>{a.date.slice(5).replace("-", "/")}</span><span>{String(a.hour).padStart(2, "0")}시</span><span className="db-absence-tag">부재</span>
        <button type="button" className="db-absence-x" aria-label={`${a.date} ${a.hour}시 부재 기록 지우기`} disabled={busy} onClick={() => void run(a, true)}>×</button>
      </li>)}
      {list.length > SHOWN && <li><button type="button" className="sheet-text-btn" onClick={() => setAll(!all)}>{all ? "접기" : `전체 ${list.length}번 보기`}</button></li>}
    </ol>}
    <div className="db-absence-add">
      <input type="date" className="sheet-input" aria-label="통화한 날짜" value={date} max={todayKST()} onChange={e => setDate(e.target.value)} />
      <select className="sheet-input" aria-label="통화한 시각" value={hour} onChange={e => setHour(Number(e.target.value))}>
        {DB_SHEET_CALL_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}시</option>)}
      </select>
      <button type="button" className="sheet-btn" disabled={busy || !date} onClick={() => void run({ date, hour })}>부재 기록</button>
    </div>
    {list.length > 0 && <>
      <div className="db-absence-hours" aria-hidden="true">{DB_SHEET_CALL_HOURS.map(h => <i key={h} className={tried.has(h) ? "is-tried" : ""} title={`${h}시`} />)}</div>
      <div className="db-absence-scale" aria-hidden="true"><span>08시</span><span>부재 걸었던 시간</span><span>21시</span></div>
      <p className="db-absence-hint">{dbSheetAbsenceHint(list)}</p>
    </>}
    {error && <small role="alert" className="sheet-error">{error}</small>}
  </section>;
}
