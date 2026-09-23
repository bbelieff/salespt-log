/**
 * MeetingSlotForm — 미팅 슬롯 공용 입력 행/버튼 (MeetingSlotItem 분할, 500줄 캡).
 * 신규 드래프트·등록 카드가 같은 입력 UI를 공유한다. 저장 로직 없음.
 */
"use client";

import DateInputCustom from "@/components/ui/DateInputCustom";
import TimeSelectPair from "@/components/ui/TimeSelectPair";

export function ExpandHeader({
  saved,
  reservationDate,
}: {
  saved: boolean;
  reservationDate: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-gray-400">
      <span>예약생성 {reservationDate}</span>
      {saved ? (
        <span className="font-semibold text-blue-600">✓ 등록됨</span>
      ) : (
        <span className="font-semibold text-amber-600">신규 입력</span>
      )}
    </div>
  );
}

export function DateTimeRow({
  미팅날짜,
  미팅시간,
  onDate,
  onTime,
  onBlurGroup,
}: {
  미팅날짜: string;
  미팅시간: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  onBlurGroup?: () => void;
}) {
  return (
    <div className="flex gap-2" onBlur={(e) => {
      // 통화·금액 그룹이 아니라 일정 그룹: 포커스가 그룹 밖으로 나갈 때 한 번 확정.
      if (onBlurGroup && !e.currentTarget.contains(e.relatedTarget as Node)) onBlurGroup();
    }}>
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-xs text-gray-500">미팅 일정</label>
        <DateInputCustom
          value={미팅날짜}
          onChange={onDate}
          ariaLabel="미팅 일정"
        />
      </div>
      <div className="shrink-0" style={{ width: 140 }}>
        <label className="mb-1 block text-xs text-gray-500">시간</label>
        <TimeSelectPair
          value={미팅시간}
          onChange={onTime}
          ariaLabel="미팅 시간"
        />
      </div>
    </div>
  );
}

export function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      <input
        type="text"
        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function FieldNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-600">
        <span>📝 예약비고</span>
        <span className="font-normal text-gray-400">· 미팅 전 준비정보</span>
      </label>
      <textarea
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="예: 사장님 부재 시간, 지참서류"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Actions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  onRemove,
  hint,
}: {
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  onRemove: () => void;
  hint: string;
}) {
  return (
    <>
      <div className="flex gap-2 pt-1">
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
        >
          ✕ 삭제
        </button>
      </div>
      <div className="text-center text-xs text-gray-400">{hint}</div>
    </>
  );
}
