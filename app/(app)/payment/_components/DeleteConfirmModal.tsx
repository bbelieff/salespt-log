/** 계약수납 삭제 확인 모달 (2026-05-17 [3] cascade 옵션) —
 *  page.tsx 500줄 캡으로 분리(contract-termination PR). 마크업·동작 무변경. */
"use client";

interface Props {
  label: string;
  cascadeOpt: boolean;
  onCascadeChange: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({
  label,
  cascadeOpt,
  onCascadeChange,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-semibold text-gray-900">
          이 계약수납을 지울까요?
        </h3>
        <p className="mb-3 text-sm leading-relaxed text-gray-600">
          <b>{label}</b> 계약수납 기록을 지워요.
          <br />
          입력한 내용이 모두 사라져요.
        </p>
        <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
          <input
            type="checkbox"
            checked={cascadeOpt}
            onChange={(e) => onCascadeChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <b>이 계약의 미팅도 ‘예약’ 상태로 되돌리기</b>
            <br />
            <span className="text-gray-500">
              일정·계약 탭의 해당 미팅이 계약 전(예약)으로 돌아가고,
              <br />
              수임비·계약조건이 비워져요.
            </span>
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
