"use client";
/**
 * 주간 보드 미팅 창의 본문 — 시안 v44(docs/design/prototypes/schedule-week-board.html) 구성 그대로:
 * 「업체정보 | 길찾기」 → 결과 4칸(계약·완료·변경·취소) → 고른 결과의 입력칸 → 보라 저장 버튼.
 * 결과가 이미 난 미팅은 요약 상자 + 「결과 고치기」·「되돌리기」. 저장 함수는 목록 화면 미팅 카드와 같은 것을 받는다.
 * 계약일은 따로 받지 않는다 — 앱 규칙이 「계약일 = 미팅 날짜」(lib/service/contract-meeting-link.ts).
 */
import { useId, useState } from "react";
import { CompanyInfo, type Meeting } from "@/types";
import { useDirtyEntry } from "@/components/DirtyGuard";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CarryoverBadge from "@/components/CarryoverBadge";
import DateInputCustom from "@/components/ui/DateInputCustom";
import MoneyInput from "@/components/ui/MoneyInput";
import { formatWon } from "@/lib/format/money";
import { todayKST } from "@/util/week";
import { dayLabelKO, parseISO } from "../../_lib/week";
import AddMeetingForm from "../AddMeetingForm";
import BasicEditDetails from "../BasicEditDetails";
import BoardCompanyRoute from "./BoardCompanyRoute";

type Act = "con" | "done" | "chg" | "can";
const ACTS: [Act, string][] = [["con", "계약"], ["done", "완료"], ["chg", "변경"], ["can", "취소"]];
const DONE_WORD = { 계약: "계약으로 종료", 완료: "완료로 종료", 변경: "일정 변경됨", 취소: "취소로 종료" } as const;
const TIMES = Array.from({ length: 60 }, (_, i) => `${String(7 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const dateKO = (iso: string) => `${iso} (${dayLabelKO(parseISO(iso))})`;

export default function BoardMeetingPop({ meeting: m, pending, onPatch, onReschedule, onRevert, onAddMeeting, onDelete, hasFollowUp, onReviveCase }: {
  meeting: Meeting; pending: boolean;
  onPatch: (partial: Partial<Omit<Meeting, "id">>, opts?: { quiet?: boolean }) => Promise<void> | void;
  onReschedule: (newDate: string, newTime: string, reason: string) => void;
  onRevert: () => void; onAddMeeting: (newDate: string, newTime: string) => void; onDelete: () => void;
  hasFollowUp: boolean; onReviveCase: () => void;
}) {
  const st = m.상태;
  const [act, setAct] = useState<Act | null>(null);
  const [edit, setEdit] = useState(false); // 계약 결과 고치기
  const [basic, setBasic] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [ciDraft, setCiDraft] = useState<CompanyInfo | undefined>(m.업체정보);
  const [ciTouched, setCiTouched] = useState(false);
  const [ciEdit, setCiEdit] = useState(false);
  const [fee, setFee] = useState(m.수임비 > 0 ? m.수임비 : 0);
  const [terms, setTerms] = useState(m.계약조건);
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState(m.미팅날짜);
  const [newTime, setNewTime] = useState(m.미팅시간);
  const [warn, setWarn] = useState("");

  const withCi = (p: Partial<Omit<Meeting, "id">>) => (ciTouched ? { ...p, 업체정보: ciDraft } : p);
  const settle = () => { setAct(null); setEdit(false); setCiTouched(false); setReason(""); setWarn(""); };
  // 사유는 회차별로 쌓는다 — 목록 화면 미팅 카드와 같은 규칙.
  const stack = (next: string) => {
    const t = next.trim(), prev = (m.미팅사유 ?? "").trim();
    return !t ? prev : !prev ? t : `${prev}\n${prev.split("\n").length + 1}회차: ${t}`;
  };
  const dropOk = () => st !== "계약" || window.confirm(`상태를 바꾸면 실무/수납의 계약 1건(${formatWon(m.수임비)})이 함께 지워져요.\n계속할까요?`);

  const submit = (): boolean => {
    if (act === "con") {
      if (!Number.isFinite(fee) || fee <= 0) { setWarn("수임비를 원 단위로 적어 주세요 (0보다 큰 숫자)"); return false; }
      onPatch(withCi({ 상태: "계약", 계약여부: true, 수임비: fee, 계약조건: terms.trim() }));
    } else if (act === "done" || act === "can") {
      if (!dropOk()) return false;
      onPatch(withCi({ 상태: act === "done" ? "완료" : "취소", 계약여부: false, 미팅사유: stack(reason) }));
    } else if (act === "chg") {
      if (!newDate || !newTime) { setWarn("새 날짜와 시각을 모두 골라 주세요"); return false; }
      if (newDate < todayKST()) { setWarn("지난 날짜로는 옮길 수 없어요"); return false; }
      if (newDate === m.미팅날짜 && newTime === m.미팅시간) { setWarn("지금과 같은 일정이에요"); return false; }
      onReschedule(newDate, newTime, reason.trim());
    } else return false;
    settle();
    return true;
  };

  useDirtyEntry(useId(), act !== null || ciTouched, async () => {
    if (act) { if (!submit()) throw new Error("입력을 확인해주세요 — 폼을 완성하면 저장돼요"); return; }
    onPatch({ 업체정보: ciDraft });
    setCiTouched(false);
  }, settle, `${m.업체명} · ${st}`);

  // 길찾기에서 직접 적은 주소를 업체정보 소재지로 저장 — 열려 있던 입력칸은 닫아 옛 값으로 덮어쓰지 않게 한다.
  const saveAddress = (addr: string) => {
    const next = CompanyInfo.parse({ ...ciDraft, 소재지: addr });
    setCiDraft(next); setCiEdit(false); setCiTouched(false);
    onPatch({ 업체정보: next });
  };
  const pick = (a: Act) => { setWarn(""); setReason(""); setAct((cur) => (cur === a ? null : a)); };
  const choosing = st === "예약" || (st === "계약" && edit);
  const tone = st === "계약" ? "con" : st === "완료" ? "done" : st === "변경" ? "chg" : "can";
  const rows: [string, string][] = st === "계약" ? [["수임비", m.수임비 > 0 ? formatWon(m.수임비) : ""], ["계약일", dateKO(m.미팅날짜)], ["메모", m.계약조건]]
    : st === "완료" ? [["미팅 결과", m.미팅사유]] : st === "변경" ? [["변경 사유", m.미팅사유]] : [["취소 사유", m.미팅사유]];
  const revert = () => {
    const label = st === "계약" ? "계약 → 예약 (수임비·조건이 비워지고, 실무/수납의 계약도 함께 지워져요)"
      : st === "변경" ? "변경 → 예약 (변경으로 생긴 새 미팅이 지워져요)" : `${st} → 예약 (적어 둔 사유가 비워져요)`;
    if (window.confirm(`미팅 결과를 되돌릴까요?\n\n${label}`)) { onRevert(); settle(); }
  };

  return (
    <div>
      <CarryoverBadge 구분={m.구분} variant="note" />
      <BoardCompanyRoute meetingId={m.id} place={m.장소} info={ciDraft} editing={ciEdit} onEdit={() => setCiEdit((v) => !v)} onSaveAddress={saveAddress} />
      {ciEdit && (
        <div className="mt-2">
          <CompanyInfoEditor key={m.id} value={m.업체정보} busy={pending} txtCompanyName={m.업체명} identityKey={m.id} vaultTarget={{ meetingId: m.id }} hideSave
            onChange={(ci) => { setCiDraft(ci); setCiTouched(true); }} onSave={(ci) => onPatch({ 업체정보: ci })} />
        </div>
      )}

      {!choosing && (
        <>
          <div className="wb-dsum">
            <div className="wb-dsum-h">
              <span className={`wb-dsum-ico wb-st-${tone}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d={st === "변경" ? "M12 7v5l3 2" : st === "취소" ? "M18 6L6 18M6 6l12 12" : "M5 12l5 5 9-10"} />
                </svg>
              </span>
              <b>{DONE_WORD[st as keyof typeof DONE_WORD]}</b>
            </div>
            <dl className="wb-qds wb-dsum-ds">
              {rows.map(([k, v]) => (
                <div key={k} className="contents"><dt>{k}</dt><dd className="whitespace-pre-wrap">{v?.trim() || <span className="wb-qnone">기록 없음</span>}</dd></div>
              ))}
            </dl>
          </div>
          <div className="wb-links">
            {st === "계약" && <button type="button" disabled={pending} onClick={() => { setEdit(true); setAct("con"); }}>결과 고치기</button>}
            <button type="button" disabled={pending} onClick={revert}>{st === "변경" ? "일정 변경 되돌리기" : "예약으로 되돌리기"}</button>
            {st !== "변경" && !hasFollowUp && !addOpen && <button type="button" disabled={pending} onClick={() => setAddOpen(true)}>추가 미팅 잡기</button>}
            {st !== "변경" && hasFollowUp && <button type="button" disabled={pending} onClick={onReviveCase}>추가 미팅에서 진행 중 · 되살리기</button>}
          </div>
          {addOpen && (
            <div className="mt-2">
              <AddMeetingForm vendor={m.업체명.replace(/^\(변경\)\s*/, "")} defaultDate={todayKST()} minDate={m.미팅날짜} pending={pending}
                onConfirm={(d, t) => { onAddMeeting(d, t); setAddOpen(false); }} onCancel={() => setAddOpen(false)} />
            </div>
          )}
        </>
      )}

      {choosing && (
        <>
          <div className="wb-acts" role="group" aria-label="결과 선택">
            {ACTS.map(([k, l]) => (
              <button key={k} type="button" className={`wb-act wb-st-${k}`} aria-pressed={act === k} disabled={st === "계약" && k === "chg"} onClick={() => pick(k)}>{l}</button>
            ))}
          </div>
          {act && (
            <form className="wb-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              {act === "con" && (
                <>
                  <div className="wb-row2">
                    <label>수임비<MoneyInput value={fee} onChange={setFee} placeholder="3,300,000" aria-label="수임비" className="wb-in" /></label>
                    <label>계약일<input className="wb-in" readOnly value={dateKO(m.미팅날짜)} title="계약일은 미팅 날짜로 기록돼요" /></label>
                  </div>
                  <label>메모<textarea className="wb-in" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="계약 조건·특이사항" /></label>
                </>
              )}
              {act === "done" && (
                <label>미팅 결과<textarea className="wb-in" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="무엇을 이야기했고, 왜 계약이 안 됐나요?" /></label>
              )}
              {act === "chg" && (
                <>
                  <div className="wb-row2">
                    <div className="wb-fld">새 날짜<DateInputCustom value={newDate} min={todayKST()} onChange={setNewDate} ariaLabel="새 날짜" compact className="wb-date" /></div>
                    <label>새 시각
                      <select className="wb-in" value={newTime} onChange={(e) => setNewTime(e.target.value)}>
                        {(TIMES.includes(newTime) ? TIMES : [newTime, ...TIMES]).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </div>
                  <label>변경 사유<input className="wb-in" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 대표 일정 변경" /></label>
                </>
              )}
              {act === "can" && (
                <label>취소 사유<input className="wb-in" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 노쇼, 대표 거절" /></label>
              )}
              {warn && <p role="alert" className="wb-warn">{warn}</p>}
              <button type="submit" className="wb-save" disabled={pending}>
                {pending ? "저장하는 중…" : act === "con" ? "계약으로 저장" : act === "done" ? "완료로 저장" : act === "chg" ? "새 일정으로 옮기기" : "취소로 저장"}
              </button>
            </form>
          )}
          <div className="wb-links">
            {st === "예약" && <button type="button" aria-expanded={basic} onClick={() => setBasic((v) => !v)}>{basic ? "일정·업체명 입력칸 닫기" : "일정·업체명 고치기"}</button>}
            {st === "계약" && <button type="button" onClick={settle}>고치기 그만두기</button>}
          </div>
          {st === "예약" && basic && (
            <div className="mt-2">
              <BasicEditDetails targetKey={m.id} pending={pending} onDelete={onDelete}
                initial={{ 미팅날짜: m.미팅날짜, 미팅시간: m.미팅시간, 업체명: m.업체명, 장소: m.장소, 예약비고: m.예약비고 }}
                onSave={(partial) => { const r = onPatch(withCi(partial), { quiet: true }); setCiTouched(false); return r; }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
