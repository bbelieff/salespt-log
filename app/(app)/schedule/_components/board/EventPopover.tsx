"use client";
/**
 * 일반 일정 만들기 — 시간 칸을 누르면 그 시각(30분 단위), 종일 줄을 누르면 종일 일정.
 * 캘린더 탭 일반 일정과 같은 기록(type 「일반」, 계약 없음)으로 저장 — 통계·아레나에는 들어가지 않는다.
 * shortcut: 기간 일정(시작~종료일)은 투두에 끝나는 날 칸이 없어 아직 하루짜리만 — 칸을 더하는 별도 작업에서 확장.
 */
import { useState } from "react";
import TimeSelectPair from "@/components/ui/TimeSelectPair";
import { newTodoOperationId, useCreateTodo } from "@/query/todos-hooks";
import { dayLabelKO, parseISO } from "../../_lib/week";
import BoardPopover from "./BoardPopover";

const INPUT = "h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none";

export default function EventPopover({ date, time, anchor, onClose, onSaved, chooseTime = false }: {
  /** chooseTime = 한 달 보드 「+ 일정」: 종일로 열고 「시각 정하기」로 바꿀 수 있다. */
  date: string; time: string | null; anchor: DOMRect | null; onClose: () => void; onSaved: (msg: string) => void; chooseTime?: boolean;
}) {
  const create = useCreateTodo();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(time ?? "");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [timed, setTimed] = useState(time !== null);
  const allDay = !timed;

  const save = async () => {
    if (!title.trim()) return setError("제목을 적어 주세요.");
    setError("");
    try {
      await create.mutateAsync({
        contractRef: "", institutionRef: "", 업체명: "", type: "일반", 분류: "기타", 제목: title.trim(),
        예정일자: date, 예정시각: allDay ? "" : start || "09:00", 장소: "", 상세: memo.trim(), showOnCalendar: true, operationId: newTodoOperationId(),
      });
      onSaved(`✓ ${allDay ? "종일 " : ""}일정 「${title.trim()}」 만들었어요`);
      onClose();
    } catch (e) {
      setError(`만들지 못했어요: ${(e as Error).message}`);
    }
  };

  const d = parseISO(date);
  return (
    <BoardPopover anchor={anchor} onClose={onClose} label={allDay ? "종일 일정 만들기" : "일반 일정 만들기"} title={<>
      <h3 className="text-lg font-black tracking-tight text-slate-900">{allDay ? "종일 일정 만들기" : "일반 일정 만들기"}</h3>
      <p className="mt-0.5 text-xs tabular-nums text-slate-500">{d.getMonth() + 1}/{d.getDate()} ({dayLabelKO(d)})</p>
    </>}>
      <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="grid gap-1 text-xs font-bold text-slate-600">제목
          <input autoFocus value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="예: 점심 약속, 병원" className={INPUT} />
        </label>
        {chooseTime && (
          <div role="group" aria-label="종일 또는 시각" className="grid grid-cols-2 gap-1.5">
            {[false, true].map((on) => (
              <button key={String(on)} type="button" aria-pressed={timed === on} onClick={() => { setTimed(on); if (on && !start) setStart("09:00"); }}
                className="h-9 rounded-xl border border-slate-300 bg-white text-px-13 font-bold text-slate-600 aria-pressed:border-teal-600 aria-pressed:bg-teal-50 aria-pressed:text-slate-900">{on ? "시각 정하기" : "종일"}</button>
            ))}
          </div>
        )}
        {!allDay && (
          <div className="grid gap-1 text-xs font-bold text-slate-600">시작 시각
            <TimeSelectPair value={start} onChange={setStart} hourMin={7} hourMax={21} ariaLabel="일정 시작 시각" />
          </div>
        )}
        <label className="grid gap-1 text-xs font-bold text-slate-600">장소·메모
          <input value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} placeholder="선택" className={INPUT} />
        </label>
        {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={create.isPending} className="wb-btn h-11 rounded-xl bg-violet-700 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">
          {create.isPending ? "만드는 중…" : "일정 만들기"}
        </button>
      </form>
    </BoardPopover>
  );
}
