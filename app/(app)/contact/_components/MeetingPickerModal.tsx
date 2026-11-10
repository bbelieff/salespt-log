/**
 * MeetingPickerModal — 미팅예약 -1 시 "어떤 미팅을 삭제할지" 선택 모달 (Phase 4).
 *
 * cascade-edge-cases Q2 정책: 한 채널/날짜에 미팅카드 여러 개일 때 -1 버튼이
 * 마지막을 자동 삭제하던 것을 사용자 선택으로 전환. 선택 시 cascade 삭제.
 * 2026-11-10 AppDialog 로 통일 — 입력 칸 없는 고르기 창이라 Esc·✕·바깥 누르기로 닫힌다.
 */
"use client";

import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";
import type { Meeting } from "@/types";

interface Props {
  meetings: Meeting[];
  onPick: (m: Meeting) => void;
  onClose: () => void;
}

export default function MeetingPickerModal({ meetings, onPick, onClose }: Props) {
  return (
    <AppDialog
      title="삭제할 미팅 선택"
      onClose={onClose}
      dismissOnBackdrop
      size="md"
      className="rounded-2xl bg-white p-4 shadow-2xl"
    >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900">
            삭제할 미팅 선택
            <span className="ml-1 font-normal text-slate-400">
              ({meetings.length}건)
            </span>
          </h3>
          <AppDialogClose
            className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            ✕ 닫기
          </AppDialogClose>
        </div>
        <p className="mb-2 text-px-11 text-slate-500">
          선택한 미팅이 삭제됩니다 (계약카드 있으면 함께). 미팅예약 -1.
        </p>
        <div className="space-y-1.5">
          {meetings.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-red-300 hover:bg-red-50"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                {m.업체명 || "(업체명 없음)"}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {m.미팅날짜} {m.미팅시간}
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-400">
                {m.상태}
              </span>
            </button>
          ))}
        </div>
    </AppDialog>
  );
}
