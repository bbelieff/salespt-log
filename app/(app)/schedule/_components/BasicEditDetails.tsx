/**
 * BasicEditDetails — 미팅 기본 정보(날짜/시간/업체명/장소/예약비고) 수정.
 * 정본: docs/design/prototypes/schedule-weekly.html `details` 섹션
 *
 * 펼침 시 입력 필드 노출 → "수정 완료" 클릭 → onSave(partial) 호출.
 * 변경된 필드만 patch (미수정 필드는 보내지 않음).
 *
 * 예약 상태 카드에서만 사용 (처리완료 카드는 수정 불가 — 새 row 만들거나 시트 직접).
 */
"use client";

import { useState } from "react";

interface Initial {
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
  장소: string;
  예약비고: string;
}

interface Props {
  initial: Initial;
  onSave: (partial: Partial<Initial>) => void;
  pending: boolean;
}

export default function BasicEditDetails({
  initial,
  onSave,
  pending,
}: Props) {
  const [draft, setDraft] = useState<Initial>({ ...initial });
  const [warn, setWarn] = useState("");

  const dirty: Partial<Initial> = {};
  (Object.keys(draft) as Array<keyof Initial>).forEach((k) => {
    if (draft[k] !== initial[k]) dirty[k] = draft[k];
  });
  const hasChanges = Object.keys(dirty).length > 0;

  const submit = () => {
    if (!hasChanges) return;
    if (!draft.미팅날짜 || !draft.미팅시간) {
      setWarn("날짜와 시간은 비울 수 없습니다");
      return;
    }
    if (!draft.업체명.trim() || !draft.장소.trim()) {
      setWarn("업체명·장소는 필수입니다");
      return;
    }
    setWarn("");
    onSave(dirty);
  };

  return (
    <details className="rounded-lg border border-gray-200 bg-white/60 px-3 py-2">
      <summary className="flex cursor-pointer select-none items-center gap-1 text-xs font-semibold text-gray-600">
        ✏️ 일정 수정 <span className="font-normal text-gray-400">· 날짜·시간·업체·장소·비고</span>
      </summary>

      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-gray-500">미팅 날짜</label>
            <input
              type="date"
              value={draft.미팅날짜}
              onChange={(e) =>
                setDraft((d) => ({ ...d, 미팅날짜: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="shrink-0" style={{ width: 110 }}>
            <label className="mb-1 block text-xs text-gray-500">시간</label>
            <input
              type="time"
              step={900}
              value={draft.미팅시간}
              onChange={(e) =>
                setDraft((d) => ({ ...d, 미팅시간: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">업체명</label>
          <input
            type="text"
            value={draft.업체명}
            onChange={(e) =>
              setDraft((d) => ({ ...d, 업체명: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">장소</label>
          <input
            type="text"
            value={draft.장소}
            onChange={(e) =>
              setDraft((d) => ({ ...d, 장소: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-600">
            <span>📝 예약비고</span>
            <span className="font-normal text-gray-400">· 시트 I열</span>
          </label>
          <textarea
            rows={2}
            value={draft.예약비고}
            onChange={(e) =>
              setDraft((d) => ({ ...d, 예약비고: e.target.value }))
            }
            placeholder="예: 사장님 부재 시간, 지참서류 등"
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
          disabled={pending || !hasChanges}
          className="w-full rounded-lg bg-blue-500 py-2 text-sm font-bold text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {pending
            ? "저장중..."
            : hasChanges
              ? "💾 수정 완료"
              : "변경사항 없음"}
        </button>
      </div>
    </details>
  );
}
