/**
 * 미팅 슬롯 카드 — 신규(saved=false) / 등록완료(saved=true) 두 모드.
 * 정본: docs/design/prototypes/contact-daily-input.html (v7)
 */
"use client";

import { useState } from "react";
import type { Channel, Meeting, MeetingState } from "@/types";
import DateInputCustom from "@/components/ui/DateInputCustom";
import TimeSelectPair from "@/components/ui/TimeSelectPair";
import ChannelBadge from "@/components/ui/ChannelBadge";

export interface NewSlot {
  // 미저장 슬롯의 in-memory 모델 (Meeting과 별도)
  tempId: string; // UUID. 등록 시 Meeting.id로 사용
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
  장소: string;
  예약비고: string;
}

interface NewProps {
  mode: "new";
  channel: Channel;
  reservationDate: string; // 오늘 = 예약일
  reservationTime: string; // 현재 시각 = 예약시각
  slot: NewSlot;
  minDate?: string;
  onChange: (next: NewSlot) => void;
  onRegister: (meeting: Meeting) => void;
  onCancel: () => void;
}

interface SavedProps {
  mode: "saved";
  meeting: Meeting;
  onPatch: (partial: Partial<Omit<Meeting, "id">>) => void;
  onRemove: () => void;
}

type Props = NewProps | SavedProps;

export default function MeetingSlotCard(props: Props) {
  const [expanded, setExpanded] = useState(props.mode === "new");

  if (props.mode === "new") {
    return (
      <NewCard
        {...props}
        expanded
        onToggleExpand={() => {}}
      />
    );
  }
  return (
    <SavedCard
      {...props}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
    />
  );
}

// ── 신규 카드 (강제 펼침 + [등록]) ─────────────────────────────
function NewCard(
  props: NewProps & { expanded: boolean; onToggleExpand: () => void },
) {
  const { channel, slot, onChange, onRegister, onCancel, reservationDate, reservationTime, minDate } =
    props;
  const [error, setError] = useState<string>("");

  const update = <K extends keyof NewSlot>(key: K, value: NewSlot[K]) =>
    onChange({ ...slot, [key]: value });

  const handleRegister = () => {
    setError("");
    if (!slot.미팅날짜) return setError("미팅 날짜 필수");
    if (!slot.미팅시간) return setError("미팅 시간 필수");
    if (!slot.업체명.trim()) return setError("업체명 필수");
    if (!slot.장소.trim()) return setError("장소 필수");

    const meeting: Meeting = {
      id: slot.tempId,
      예약일: reservationDate,
      예약시각: reservationTime,
      미팅날짜: slot.미팅날짜,
      미팅시간: slot.미팅시간,
      channel,
      업체명: slot.업체명.trim(),
      장소: slot.장소.trim(),
      예약비고: slot.예약비고.trim(),
      상태: "예약" as MeetingState,
      계약여부: false,
      수임비: 0,
      미팅사유: "",
      계약조건: "",
    };
    onRegister(meeting);
  };

  return (
    <div className="rounded-lg border-l-4 border-gray-300 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <ChannelBadge channel={channel} />
        <span>새 미팅 예약</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">날짜</span>
          <DateInputCustom
            value={slot.미팅날짜}
            onChange={(v) => update("미팅날짜", v)}
            min={minDate}
            ariaLabel="미팅 날짜"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">시간</span>
          <TimeSelectPair
            value={slot.미팅시간}
            onChange={(v) => update("미팅시간", v)}
            ariaLabel="미팅 시간"
          />
        </label>
      </div>

      <input
        type="text"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="업체명"
        value={slot.업체명}
        onChange={(e) => update("업체명", e.target.value)}
      />
      <input
        type="text"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="장소"
        value={slot.장소}
        onChange={(e) => update("장소", e.target.value)}
      />
      <textarea
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="예약비고 (지참서류 등, 선택)"
        value={slot.예약비고}
        onChange={(e) => update("예약비고", e.target.value)}
      />

      {error && (
        <div className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
          ⚠ {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRegister}
          className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 active:scale-95"
        >
          ✓ 등록
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ✕ 삭제
        </button>
      </div>
    </div>
  );
}

// ── 등록완료 카드 (한 줄 접힘 + 클릭 펼침) ─────────────────────
function SavedCard(
  props: SavedProps & { expanded: boolean; onToggleExpand: () => void },
) {
  const { meeting, onPatch, onRemove, expanded, onToggleExpand } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    미팅날짜: meeting.미팅날짜,
    미팅시간: meeting.미팅시간,
    업체명: meeting.업체명,
    장소: meeting.장소,
    예약비고: meeting.예약비고,
  });

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-2 rounded-lg border-l-4 border-blue-500 bg-blue-50 px-3 py-2 text-left text-xs hover:bg-blue-100"
      >
        <ChannelBadge channel={meeting.channel} />
        <span className="font-semibold">{meeting.미팅시간}</span>
        <span className="flex-1 truncate font-medium text-gray-900">
          {meeting.업체명}
        </span>
        <span className="truncate text-gray-500">{meeting.장소}</span>
      </button>
    );
  }

  const saveEdit = () => {
    onPatch(draft);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft({
      미팅날짜: meeting.미팅날짜,
      미팅시간: meeting.미팅시간,
      업체명: meeting.업체명,
      장소: meeting.장소,
      예약비고: meeting.예약비고,
    });
    setEditing(false);
  };

  return (
    <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ChannelBadge channel={meeting.channel} />
        <span className="text-xs text-gray-500">등록 완료</span>
        <button
          type="button"
          onClick={onToggleExpand}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          aria-label="접기"
        >
          ▲ 접기
        </button>
      </div>

      {editing ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <DateInputCustom
              value={draft.미팅날짜}
              onChange={(v) => setDraft((d) => ({ ...d, 미팅날짜: v }))}
              ariaLabel="미팅 날짜"
            />
            <TimeSelectPair
              value={draft.미팅시간}
              onChange={(v) => setDraft((d) => ({ ...d, 미팅시간: v }))}
              ariaLabel="미팅 시간"
            />
          </div>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.업체명}
            onChange={(e) => setDraft((d) => ({ ...d, 업체명: e.target.value }))}
            placeholder="업체명"
          />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.장소}
            onChange={(e) => setDraft((d) => ({ ...d, 장소: e.target.value }))}
            placeholder="장소"
          />
          <textarea
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={draft.예약비고}
            onChange={(e) =>
              setDraft((d) => ({ ...d, 예약비고: e.target.value }))
            }
            placeholder="예약비고"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              💾 수정 완료
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm">
            <span className="font-bold">{meeting.미팅날짜}</span>{" "}
            <span className="font-bold">{meeting.미팅시간}</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {meeting.업체명}
          </div>
          <div className="text-xs text-gray-500">📍 {meeting.장소}</div>
          {meeting.예약비고 && (
            <div className="text-xs text-gray-600">📝 {meeting.예약비고}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              ✎ 수정
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              ✕ 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}
