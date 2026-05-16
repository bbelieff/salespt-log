/**
 * AddMeetingForm — 같은 업체에 추가 미팅 잡기 (2026-05-17 [2b]).
 *
 * 사용: 닫힌 미팅카드(완료/취소/계약)에서 [➕ 추가미팅] 클릭 시 인라인 폼.
 * 동작 (호출 측): appendMeeting 호출 — 새 uuid, 같은 채널/업체/장소,
 *   미팅날짜·시간만 새 입력. 상태=예약, previousMeetingId 없음 (독립 미팅).
 */
"use client";

import { useState } from "react";

interface Props {
  vendor: string;
  defaultDate: string; // YYYY-MM-DD (오늘)
  onConfirm: (newDate: string, newTime: string) => void;
  onCancel: () => void;
  pending: boolean;
}

export default function AddMeetingForm({
  vendor,
  defaultDate,
  onConfirm,
  onCancel,
  pending,
}: Props) {
  const [newDate, setNewDate] = useState(defaultDate);
  const [newTime, setNewTime] = useState("10:00");
  const [warn, setWarn] = useState("");

  const submit = () => {
    if (!newDate || !newTime) {
      setWarn("새 날짜와 시간을 모두 입력해주세요");
      return;
    }
    setWarn("");
    onConfirm(newDate, newTime);
  };

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-blue-300 bg-blue-50 p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-blue-800">
        ➕ 추가 미팅 — {vendor}
      </div>
      <div className="text-xs text-gray-600">
        같은 업체로 새 예약 카드 생성 (채널/장소 동일, 상태=예약).
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-gray-600">새 날짜</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="shrink-0" style={{ width: 110 }}>
          <label className="mb-1 block text-xs text-gray-600">새 시간</label>
          <input
            type="time"
            step={900}
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {warn && (
        <div className="rounded-md bg-red-100 px-2 py-1.5 text-xs font-medium text-red-700">
          ⚠ {warn}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-blue-500 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {pending ? "저장중..." : "➕ 추가 확정"}
        </button>
      </div>
    </div>
  );
}
