/**
 * TodoSection — 진행 슬롯 내 ToDo 목록 + 추가 버튼 (Scope 2).
 * (계약 × 기관) 단위. institutionRef = 슬롯 진행기관 (비어있으면 추가 비활성).
 * 시각 정본: docs/design/prototypes/practice-payment-mockup.html
 */
"use client";

import { useState } from "react";
import type { Todo, TodoType } from "@/types";
import { usePatchTodo, useRemoveTodo } from "@/query/todos-hooks";
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
  /** draft(편집 중) 진행기관 — 입력했지만 미저장인 경우 안내 분기용. */
  draftInstitution?: string;
  companyName: string;
  todos: Todo[];
}

export default function TodoSection({
  contractRef,
  institutionRef,
  draftInstitution,
  companyName,
  todos,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const patch = usePatchTodo();
  const remove = useRemoveTodo();
  const canAdd = institutionRef.trim() !== "";
  // 진행기관을 입력만 하고 [저장] 안 함 → 저장 유도 (미저장 진행기관에 투두를
  // 달면 새로고침 후 슬롯에서 사라지므로 저장된 진행기관에만 추가 허용).
  const draftOnly = !canAdd && (draftInstitution ?? "").trim() !== "";
  const addLabel = canAdd
    ? "ToDo 추가"
    : draftOnly
      ? "진행기관 저장 후 추가"
      : "진행기관 입력 후 추가";

  return (
    <div
      className="rounded-lg border border-dashed border-amber-300 p-2.5"
      style={{ background: "rgba(254,243,199,0.35)" }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">ToDo</span>
        <span className="text-[10px] text-gray-400">이 기관 할 일</span>
      </div>

      {todos.length > 0 && (
        <div className="space-y-1.5">
          {todos.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
            >
              <label className="-m-1 flex shrink-0 cursor-pointer items-center p-1">
                <input
                  type="checkbox"
                  checked={t.완료여부}
                  onChange={(e) =>
                    patch.mutate({
                      contractRef,
                      id: t.id,
                      partial: { 완료여부: e.target.checked },
                    })
                  }
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
        onClick={() => setShowModal(true)}
        className="mt-1.5 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-amber-300 bg-transparent text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
      >
        <span className="text-sm leading-none">+</span>
        <span>{addLabel}</span>
      </button>

      {showModal && (
        <TodoFormModal
          contractRef={contractRef}
          institutionRef={institutionRef}
          companyName={companyName}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
