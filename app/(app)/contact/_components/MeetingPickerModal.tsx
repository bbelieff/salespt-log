/**
 * MeetingPickerModal — 미팅예약 -1 시 "어떤 미팅을 삭제할지" 선택 모달 (Phase 4).
 *
 * cascade-edge-cases Q2 정책: 한 채널/날짜에 미팅카드 여러 개일 때 -1 버튼이
 * 마지막을 자동 삭제하던 것을 사용자 선택으로 전환. 선택 시 cascade 삭제.
 */
"use client";

import type { Meeting } from "@/types";

interface Props {
  meetings: Meeting[];
  onPick: (m: Meeting) => void;
  onClose: () => void;
}

export default function MeetingPickerModal({ meetings, onPick, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-sm font-black text-gray-900">
            삭제할 미팅 선택
            <span className="ml-1 font-normal text-gray-400">
              ({meetings.length}건)
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            ✕ 닫기
          </button>
        </div>
        <p className="mb-2 text-[11px] text-gray-500">
          선택한 미팅이 삭제됩니다 (계약카드 있으면 함께). 미팅예약 -1.
        </p>
        <div className="space-y-1.5">
          {meetings.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-red-300 hover:bg-red-50"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                {m.업체명 || "(업체명 없음)"}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {m.미팅날짜} {m.미팅시간}
              </span>
              <span className="shrink-0 text-xs font-medium text-gray-400">
                {m.상태}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
