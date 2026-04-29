/**
 * RescheduleForm — 📅 일정 변경 인라인 폼.
 * 정본: docs/design/prototypes/schedule-weekly.html `reschedule` action
 *
 * 입력: 새 날짜 + 새 시간 + (선택) 사유
 * 동작 (호출 측 책임):
 *   1) 새 미팅 row append (id=uuid, 모든 필드 복사 + 미팅날짜/미팅시간 새값
 *      + previousMeetingId=원본id + 상태="예약")
 *   2) 원본 미팅 patch: 상태="변경", 미팅사유=사유
 *   3) 두 mutation 모두 성공해야 invalidate
 *
 * UX 결과: 원본 카드는 "변경됨"(보라) + 새 카드는 새 날짜에 "예약"(노랑).
 *         previousMeetingId로 체이닝되어 이력 추적 가능.
 */
"use client";

import { useState } from "react";

interface Props {
  initialDate: string; // YYYY-MM-DD
  initialTime: string; // HH:MM
  vendor: string;
  onConfirm: (newDate: string, newTime: string, reason: string) => void;
  pending: boolean;
}

const PRESETS = [
  "사장님 사유",
  "내 사유",
  "긴급일정",
  "더 좋은 시간 협의",
];

export default function RescheduleForm({
  initialDate,
  initialTime,
  vendor,
  onConfirm,
  pending,
}: Props) {
  const [newDate, setNewDate] = useState(initialDate);
  const [newTime, setNewTime] = useState(initialTime);
  const [reason, setReason] = useState("");
  const [warn, setWarn] = useState("");

  const submit = () => {
    if (!newDate || !newTime) {
      setWarn("새 날짜와 시간을 모두 입력해주세요");
      return;
    }
    if (newDate === initialDate && newTime === initialTime) {
      setWarn("기존과 같은 일정입니다");
      return;
    }
    setWarn("");
    onConfirm(newDate, newTime, reason.trim());
  };

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-purple-300 bg-purple-50 p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-purple-800">
        📅 일정 변경
      </div>

      <div className="text-xs text-gray-500">
        기존: <b className="text-gray-700">{initialDate} {initialTime}</b>
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-gray-600">새 날짜</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none"
          />
        </div>
        <div className="shrink-0" style={{ width: 110 }}>
          <label className="mb-1 block text-xs text-gray-600">새 시간</label>
          <input
            type="time"
            step={900}
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setReason(`${vendor}, ${p}`)}
            className="rounded-md border border-purple-200 bg-white px-2 py-0.5 text-xs text-purple-800 transition-colors hover:bg-purple-100"
          >
            {p}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600">
          변경 사유{" "}
          <span className="font-normal text-gray-400">· 시트 M열</span>
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`예: ${vendor}, 사장님 출장으로 다음 주 이동`}
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none"
        />
      </div>

      {warn && (
        <div className="rounded-md bg-red-100 px-2 py-1.5 text-xs font-medium text-red-700">
          ⚠ {warn}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-purple-500 py-2.5 text-sm font-bold text-white transition-all hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? "저장중..." : "📅 일정 변경 확정"}
      </button>

      <div className="rounded-md bg-white/60 px-2 py-1.5 text-[11px] text-gray-500">
        💡 이전 카드는 보라색 &ldquo;변경됨&rdquo;으로 보존 · 새 카드가 새 날짜에 생성
      </div>
    </div>
  );
}
