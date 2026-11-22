"use client";
/**
 * 실무/수납 상세 제목 옆 ✎ — 업체명을 그 자리에서 바로 고친다(제목 아래로 작은 입력 창이 펼쳐짐)(2026-11-22 belie: 「실무수납에서도 업체명을 자유롭게」).
 * 저장은 「📑 계약정보」의 수정 칸과 같은 경로(연결 미팅 id 로 장부·미팅·업체정보 이름을 함께 옮김).
 * 이름 앞에 일정 변경 표시 「(변경)」이 남아 있으면 한 번에 떼는 버튼을 보여 준다(옛 계약 정리용).
 */
import { useEffect, useRef, useState } from "react";
import type { ContractPayment } from "@/types";
import { useEditContractLinkedFields } from "@/query/contract-payment-hooks";
import { hasRescheduleMark, stripRescheduleMark } from "@/util/reschedule-mark";

function Pencil() {
  return (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
  );
}

export default function CompanyNameEdit({ cp }: { cp: ContractPayment }) {
  const edit = useEditContractLinkedFields({ silent: true });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cp.업체명);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setValue(cp.업체명); }, [cp.업체명, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const save = async (raw: string) => {
    const next = raw.trim();
    if (!next) { setError("업체명을 적어 주세요"); return; }
    if (next === cp.업체명) { setEditing(false); setError(""); return; }
    setError("");
    try {
      const res = await edit.mutateAsync({
        meetingId: cp.linkedMeetingId || undefined,
        old: { 계약일: cp.계약일, 업체명: cp.업체명 },
        next: { 업체명: next },
      });
      if (res.failures.length) { setError(`일부만 바뀌었어요: ${res.failures.join(", ")}`); return; }
      setEditing(false);
    } catch {
      setError("바꾸지 못했어요. 잠시 후 다시 눌러 주세요");
    }
  };

  if (editing) {
    return (
      <form aria-label="업체명 고치기" className="absolute left-0 top-full z-30 mt-1 flex w-80 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" onSubmit={(e) => { e.preventDefault(); void save(value); }}>
        <input
          ref={inputRef}
          id={`company-name-${cp.row}`}
          aria-label="업체명"
          value={value}
          disabled={edit.isPending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setEditing(false); setError(""); } }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
        />
        <button type="submit" disabled={edit.isPending} className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50">{edit.isPending ? "저장중.." : "저장"}</button>
        <button type="button" disabled={edit.isPending} onClick={() => { setEditing(false); setError(""); }} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">취소</button>
        {error && <p role="alert" className="w-full text-xs font-medium text-red-600">{error}</p>}
      </form>
    );
  }

  const marked = hasRescheduleMark(cp.업체명);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => setEditing(true)} aria-label={`${cp.업체명} 업체명 고치기`} title="업체명 고치기" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70 hover:text-slate-800"><Pencil /></button>
      {marked && (
        <button type="button" disabled={edit.isPending} onClick={() => void save(stripRescheduleMark(cp.업체명))} className="h-7 shrink-0 rounded-full border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">
          {edit.isPending ? "바꾸는중.." : "「(변경)」 떼기"}
        </button>
      )}
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
