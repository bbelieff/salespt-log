"use client";
/**
 * 따로 잡은 미팅 연결(2026-10-23 belie) — STEP 2 에서 직접 잡아 이 DB 와 안 이어진 미팅을 같은 업체로 잇는다.
 * 후보 = 업체명이 같거나 비슷한 미팅. 연결은 표시만 더하고 미팅 날짜·결과·실적은 바꾸지 않는다. 「연결 풀기」로 되돌린다.
 */
import { useEffect, useState } from "react";
import type { Row } from "./model";

type Candidate = { id: string; company: string; reservedOn: string; meetingDate: string; state: string };
const md = (d: string) => (d ? d.slice(5).replace("-", "/") : "—");

export function MeetingLinkPanel({ row, onLink }: { row: Pick<Row, "id" | "meetingId" | "linkedExisting">; onLink: (meetingId: string | null) => Promise<unknown> }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (row.meetingId) { setCandidates(null); return; }
    let live = true;
    fetch(`/api/db-sheet/meeting-candidates?lead=${encodeURIComponent(row.id)}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { candidates: [] }))
      .then((j: { candidates?: Candidate[] }) => { if (live) setCandidates(j.candidates ?? []); })
      .catch(() => { if (live) setCandidates([]); });
    return () => { live = false; };
  }, [row.id, row.meetingId]);
  async function run(id: string | null) {
    setBusy(id ?? "unlink"); setError("");
    try { await onLink(id); } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요. 다시 시도해 주세요."); } finally { setBusy(""); }
  }
  if (row.meetingId && row.linkedExisting) return <section className="db-meeting-link is-linked" aria-label="미팅 연결">
    <span><strong>STEP 2 미팅과 연결됨</strong> · 미팅 날짜·결과는 일정·계약에서 관리해요</span>
    <button type="button" className="sheet-btn" disabled={!!busy} onClick={() => void run(null)}>연결 풀기</button>
    {error && <small role="alert" className="sheet-error">{error}</small>}
  </section>;
  if (row.meetingId || !candidates?.length) return null;
  return <section className="db-meeting-link" aria-label="미팅 연결">
    <p><strong>따로 잡은 미팅이 있어요</strong> · 같은 업체면 연결하세요. 연결하면 지연 알림이 풀리고, 미팅 날짜·결과는 그대로예요.</p>
    <ul>{candidates.map(c => <li key={c.id}>
      <span><b>{c.company}</b><small>미팅 {md(c.meetingDate)} · 예약 {md(c.reservedOn)} · {c.state}</small></span>
      <button type="button" className="sheet-btn" disabled={!!busy} onClick={() => void run(c.id)}>{busy === c.id ? "연결 중…" : "연결"}</button>
    </li>)}</ul>
    {error && <small role="alert" className="sheet-error">{error}</small>}
  </section>;
}
