/**
 * 캘린더 일자상세 — ToDo 1건 카드 (실무 + 일반이벤트).
 * page.tsx 500줄 캡 때문에 분리하면서 일반이벤트 삭제 UI 추가 (2026-07-15).
 *
 * - 실무(미팅/전화/메시지/기타): 카드 클릭 → 실무·수납 탭으로 점프 (기존 동작 유지).
 * - 일반: 실무·수납 탭에 표시되지 않아 지울 방법이 없었음(고아) → 카드에서 바로 삭제.
 *   삭제는 기존 ToDo 삭제 경로 재사용(DELETE /api/todos/[id]) — 구글 캘린더에 담아둔
 *   일정도 함께 정리된다. 실수 방지용 확인 다이얼로그 필수.
 *   수정(제목·날짜)은 이번 스코프 밖 (docs/plans/active/calendar-general-event-delete.md).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Todo } from "@/types";
import { useRemoveTodo } from "@/query/todos-hooks";
import GcalItemToggle from "./GcalItemToggle";
import TodoTypeIcon from "./TodoTypeIcon";

// tokens.md — 실무 진회색 / 일반이벤트 teal(비집계). inline style (채널 hex와 동일 방식).
const PRACTICE_HEX = "#334155";
const GENERAL_HEX = "#0d9488";

export default function TodoDayCard({
  t,
  gcalConnected,
  gcalOn,
  onGcalChange,
  onGcalToast,
}: {
  t: Todo;
  gcalConnected: boolean;
  gcalOn: boolean;
  onGcalChange: (id: string, on: boolean) => void;
  onGcalToast: (msg: string) => void;
}) {
  const router = useRouter();
  const remove = useRemoveTodo();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  const general = t.type === "일반";
  const accent = general ? GENERAL_HEX : PRACTICE_HEX;

  const onConfirm = () => {
    setFailed(false);
    remove.mutate(
      { contractRef: t.contractRef, id: t.id },
      {
        onSuccess: () => setConfirming(false),
        onError: () => setFailed(true),
      },
    );
  };

  return (
    <li
      role={general ? undefined : "button"}
      tabIndex={general ? undefined : 0}
      onClick={
        general ? undefined : () => router.push(`/payment?focus=${t.id}`)
      }
      className={`flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm ${
        general
          ? ""
          : "cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
      }`}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span
        className="shrink-0 text-sm font-bold text-gray-700"
        style={{ width: 44 }}
      >
        {t.예정시각 || "—"}
      </span>
      <span
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-white"
        style={{ background: accent }}
      >
        <TodoTypeIcon type={t.type} size={12} /> {general ? "일반" : "실무"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">
          {t.업체명 || t.제목}
        </div>
        <div className="truncate text-[11px] text-gray-400">{t.제목}</div>
      </div>
      {t.장소 && (
        <span className="max-w-20 shrink-0 truncate text-xs text-gray-400">
          {t.장소}
        </span>
      )}
      {general && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="일반 일정 지우기"
          title="일반 일정 지우기"
          className="shrink-0 rounded-md p-1 text-gray-300 transition-colors hover:text-red-500"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {gcalConnected && (
        <GcalItemToggle
          kind="todo"
          id={t.id}
          on={gcalOn}
          onChange={onGcalChange}
          onToast={onGcalToast}
        />
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !remove.isPending && setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-gray-900">
              이 일정을 지울까요?
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              <b>{t.제목}</b>
              <br />
              {t.예정일자}
              {t.예정시각 ? ` ${t.예정시각}` : ""} 일정을 지워요. 구글 캘린더에
              담아둔 일정도 함께 사라져요.
            </p>
            {failed && (
              <p className="mb-3 text-sm font-medium text-red-600">
                지우지 못했어요. 잠시 후 다시 시도해 주세요.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={remove.isPending}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={remove.isPending}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {remove.isPending ? "지우는 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
