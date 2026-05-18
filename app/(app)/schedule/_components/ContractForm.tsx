/**
 * ContractForm — 💵 계약 인라인 입력 폼.
 * 정본: docs/design/prototypes/schedule-weekly.html `contract` action
 *
 * 입력: 수임비(원, 필수, 천단위 콤마) + 계약조건(선택)
 * 검증: 수임비 > 0
 * 확정 → 상태=계약, 계약여부=true, 수임비, 계약조건 patch
 *
 * 단위: 원(₩) — 04 업체관리!L과 02 계약수납관리!E 모두 원 단위 통일.
 */
"use client";

import { useState } from "react";

interface Props {
  initialFee: number;
  initialTerms: string;
  onConfirm: (fee: number, terms: string) => void;
  pending: boolean;
}

function fmtComma(n: number): string {
  if (!n) return "";
  return n.toLocaleString("en-US");
}

export default function ContractForm({
  initialFee,
  initialTerms,
  onConfirm,
  pending,
}: Props) {
  const [feeNum, setFeeNum] = useState<number>(initialFee > 0 ? initialFee : 0);
  const [terms, setTerms] = useState(initialTerms);
  const [warn, setWarn] = useState("");

  const submit = () => {
    if (!Number.isFinite(feeNum) || feeNum <= 0) {
      setWarn("수임비를 원 단위로 입력해주세요 (0보다 큰 숫자)");
      return;
    }
    setWarn("");
    onConfirm(feeNum, terms.trim());
  };

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-green-300 bg-green-50 p-3">
      <div className="flex items-center gap-1 text-xs font-bold text-green-800">
        💵 계약 정보 입력
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600">
          수임비 (원) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={fmtComma(feeNum)}
            onChange={(e) => {
              const input = e.currentTarget;
              const oldVal = input.value;
              const cursorPos = input.selectionStart ?? 0;
              const digits = oldVal.replace(/[^\d]/g, "");
              const num = digits ? parseInt(digits, 10) : 0;
              const newVal = num ? num.toLocaleString("en-US") : "";
              // 커서 보정: 콤마 개수 차이만큼 이동
              requestAnimationFrame(() => {
                const oldCommas = (oldVal.slice(0, cursorPos).match(/,/g) ?? [])
                  .length;
                const newCommas = (newVal.slice(0, cursorPos).match(/,/g) ?? [])
                  .length;
                const newPos = Math.max(
                  0,
                  Math.min(newVal.length, cursorPos + (newCommas - oldCommas)),
                );
                try {
                  input.setSelectionRange(newPos, newPos);
                } catch {
                  /* no-op */
                }
              });
              setFeeNum(num);
            }}
            placeholder="5,000,000"
            aria-label="수임비"
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-base font-semibold focus:border-green-500 focus:outline-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          <span className="shrink-0 text-sm font-semibold text-gray-600">
            원
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600">
          계약 조건{" "}
          <span className="font-normal text-gray-400">· 특이사항</span>
        </label>
        <textarea
          rows={2}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="예: 6개월 분할, 부가세 별도, 출판물 포함"
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
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
        className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? "저장중..." : "💵 계약 확정"}
      </button>
    </div>
  );
}
