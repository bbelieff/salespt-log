/**
 * TodoSection — 진행 슬롯 내 ToDo 목록 + 추가 버튼 (Scope 2).
 * (계약 × 기관) 단위. institutionRef = 슬롯 진행기관 (비어있으면 추가 비활성).
 * 시각 정본: docs/design/prototypes/practice-payment-mockup.html
 */
"use client";

import { useState } from "react";
import type { Todo, TodoType } from "@/types";
import { usePatchTodo, useRemoveTodo } from "@/query/todos-hooks";
import { useFocusScroll } from "@/lib/hooks/useFocusScroll";
import TodoFormModal from "./TodoFormModal";

const TYPE_BADGE: Record<TodoType, string> = {
  미팅: "bg-blue-100 text-blue-700",
  전화: "bg-green-100 text-green-700",
  메시지: "bg-violet-100 text-violet-700",
  기타: "bg-gray-100 text-gray-600",
};

function fmtWhen(예정일자: string, 예정시각: string): string {
  const m = 예정일자.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const d = m ? `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}` : 예정일자;
  return 예정시각 ? `${d} ${예정시각}` : d;
}

interface Props {
  contractRef: string;
  /** 저장본 진행기관 — ToDo 키. 비어있으면 추가 비활성. */
  institutionRef: string;
  /** draft(편집 중) 진행기관 — 입력했지만 미저장인 경우 자동 저장 트리거용. */
  draftInstitution?: string;
  companyName: string;
  todos: Todo[];
  /** 캘린더 포커스 ToDo id — 해당 카드 스크롤+하이라이트(3s). */
  focusId?: string | null;
  /** [4] 미저장 진행기관으로 추가 시 슬롯(계약)을 먼저 저장. */
  onEnsureSaved?: () => void;
}

export default function TodoSection({
  contractRef,
  institutionRef,
  draftInstitution,
  companyName,
  todos,
  focusId,
  onEnsureSaved,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const patch = usePatchTodo();
  const remove = useRemoveTodo();

  // 캘린더 포커스 — 매칭 ToDo 카드 스크롤 + 3초 하이라이트 링.
  const focusActive = !!focusId && todos.some((t) => t.id === focusId);
  const { ref: focusedRef, ring } = useFocusScroll<HTMLDivElement>(focusActive);
  // 완료 토글 낙관적 UI (2026-06 PostHog 분노클릭): checked 가 서버값에 묶여 시트 write
  // 완료 전까지 반응이 없던 lag 제거. id→희망값 override, onSettled 시 해제.
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});
  const toggleDone = (id: string, next: boolean) => {
    setOptimisticDone((m) => ({ ...m, [id]: next }));
    patch.mutate(
      { contractRef, id, partial: { 완료여부: next } },
      {
        onSettled: () =>
          setOptimisticDone((m) => {
            const c = { ...m };
            delete c[id];
            return c;
          }),
      },
    );
  };
  // [4] 4-A: 저장본이 있으면 그 값, 없으면 입력 중(draft) 진행기관으로 추가 허용.
  // 미저장이면 추가 클릭 시 onEnsureSaved 로 슬롯을 먼저 저장 → 키 일치 유지.
  const savedReady = institutionRef.trim() !== "";
  const draftInst = (draftInstitution ?? "").trim();
  const effectiveInstitution = savedReady ? institutionRef.trim() : draftInst;
  const canAdd = effectiveInstitution !== "";
  const needsSave = !savedReady && draftInst !== "";
  const addLabel = canAdd ? "ToDo 추가" : "진행기관 입력 후 추가";

  const handleAdd = () => {
    if (!canAdd) return;
    if (needsSave) onEnsureSaved?.(); // 미저장 진행기관 → 자동 저장 후 모달.
    setShowModal(true);
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">ToDo</span>
        <span className="text-[10px] text-gray-400">이 기관 할 일</span>
      </div>

      {todos.length > 0 && (
        <div className="space-y-1.5">
          {todos.map((t) => (
            <div
              key={t.id}
              ref={t.id === focusId ? focusedRef : undefined}
              className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 scroll-mt-28 ${
                ring && t.id === focusId
                  ? "animate-pulse ring-2 ring-inset ring-blue-400"
                  : ""
              }`}
            >
              <label className="-m-1 flex shrink-0 cursor-pointer items-center p-1">
                <input
                  type="checkbox"
                  checked={optimisticDone[t.id] ?? t.완료여부}
                  onChange={(e) => toggleDone(t.id, e.target.checked)}
                  className="h-4 w-4 rounded accent-gray-700"
                  aria-label="완료 토글"
                />
              </label>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGE[t.type]}`}
              >
                {t.type}
              </span>
              <span
                className={`flex-1 truncate text-xs ${
                  t.완료여부 ? "text-gray-400 line-through" : "text-gray-800"
                }`}
              >
                {t.제목}
              </span>
              <span className="shrink-0 text-[11px] text-gray-400">
                {fmtWhen(t.예정일자, t.예정시각)}
              </span>
              <button
                type="button"
                onClick={() => remove.mutate({ contractRef, id: t.id })}
                className="shrink-0 text-xs text-gray-300 hover:text-red-500"
                aria-label="ToDo 삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!canAdd}
        onClick={handleAdd}
        className="mt-1.5 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-transparent text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
      >
        <span className="text-sm leading-none">+</span>
        <span>{addLabel}</span>
      </button>

      {showModal && (
        <TodoFormModal
          contractRef={contractRef}
          institutionRef={effectiveInstitution}
          companyName={companyName}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
