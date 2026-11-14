"use client";
/**
 * 일반 일정 보기 창 — 이름·때·메모와 「이 일정 지우기」. 일반 일정은 다른 탭에 안 보여서 여기서 지운다(기존 캘린더와 같은 삭제 경로).
 * 수정은 아직 없다(범위 밖) — 지우고 다시 만든다.
 */
import { useState } from "react";
import type { Todo } from "@/types";
import { useRemoveTodo } from "@/query/todos-hooks";
import { dayLabelKO, parseISO } from "../../../schedule/_lib/week";
import BoardPopover from "../../../schedule/_components/board/BoardPopover";

export default function EventViewPopover({ todo: t, anchor, onClose, onSaved, onBack }: { todo: Todo; anchor: DOMRect | null; onClose: () => void; onSaved: (msg: string) => void; onBack?: () => void }) {
  const remove = useRemoveTodo();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const d = parseISO(t.예정일자);
  const del = () => {
    setFailed(false);
    remove.mutate({ contractRef: t.contractRef, id: t.id }, { onSuccess: () => { onSaved(`✓ 「${t.제목}」 일정을 지웠어요`); onClose(); }, onError: () => setFailed(true) });
  };
  return (
    <BoardPopover glass anchor={anchor} onClose={onClose} onBack={onBack} label={`${t.제목} 일정`} title={<>
      <h3 className="wb-pop-h">{t.제목}</h3>
      <p className="wb-pop-meta">{d.getMonth() + 1}/{d.getDate()} ({dayLabelKO(d)}) {t.예정시각 || "종일"}{t.업체명 ? ` · ${t.업체명}` : ""}</p>
      <div className="wb-pmeta"><span><i className="bg-teal-600" />일반 일정 · 점수에 안 들어가요</span></div>
    </>}>
      {t.상세 && <p className="wb-dsum whitespace-pre-wrap break-words text-px-13 text-slate-700">{t.상세}</p>}
      {asking ? (
        <div className="wb-form">
          <p className="text-px-13 leading-relaxed text-slate-700">이 일정을 지울까요? 구글 캘린더에 담아 둔 일정도 함께 사라져요.</p>
          {failed && <p role="alert" className="wb-warn">지우지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
          <div className="wb-row2">
            <button type="button" autoFocus disabled={remove.isPending} onClick={() => setAsking(false)} className="h-[38px] rounded-[11px] border border-slate-300 bg-white text-px-13 font-bold text-slate-700 disabled:opacity-50">취소</button>
            <button type="button" disabled={remove.isPending} onClick={del} className="h-[38px] rounded-[11px] bg-red-600 text-px-13 font-extrabold text-white hover:bg-red-700 disabled:opacity-50">{remove.isPending ? "지우는 중…" : "지우기"}</button>
          </div>
        </div>
      ) : (
        <div className="wb-links"><button type="button" onClick={() => setAsking(true)}>이 일정 지우기</button></div>
      )}
    </BoardPopover>
  );
}
