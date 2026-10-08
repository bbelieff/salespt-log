/**
 * CompanyInfoField — 업체정보 편집기의 한 칸(라벨 + (?) 설명 + 입력). CompanyInfoEditor 에서 분리
 * (2026-09-28 company-info-restructure, 500줄 캡).
 *
 * - FieldLabel: 라벨 + (?) 툴팁(HintTooltip) + 화면낭독기용 상시 설명(sr-only). 회색 설명 줄 없음.
 * - 기대출 같은 여러 줄 칸 = textarea 자동높이(줄 수 따라) — 시트에 \n 그대로 저장.
 * - 연락처통신사: blur 에만 formatPhone(괄호 통신사 보존).
 * - 주민등록번호: 앞 6자리만(belie 결정). 입력 중 6자리 초과분 즉시 절단, blur 에 "NNNNNN-" 마무리
 *   (6자리 미만이면 비움) — 자르거나 비운 이유를 칸 아래에 알린다. 서버 스키마도 한 번 더 자른다.
 */
"use client";

import { useState } from "react";
import type { CompanyInfo } from "@/types";
import { formatPhone } from "@/lib/format/phone";
import HintTooltip from "@/components/ui/HintTooltip";
import { normalizeRrnFront, sanitizeRrnFrontTyping } from "@/util/rrn-front";
import type { FieldDef } from "@/components/company-info-defs";
import { bizNoTyping } from "@/util/live-format";
import { useLiveInput } from "./useLiveInput";

/** 위계(§3-2 contrast): 값 gray-900 / 테두리 gray-300 / 예시(placeholder)만 gray-300 옅게. */
export const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-300 focus:border-brand-red focus:outline-none";
/** 자동 계산 칸 — 입력칸과 같은 크기, 회색 바탕(직접 고칠 수 없음). */
export const readOnlyCls =
  "w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-900 focus:outline-none";

const RRN_CUT_MSG = "여기엔 앞 6자리만 저장해요. 뒷자리는 아래 계정 보관함에 넣어 주세요.";
const RRN_SHORT_MSG = "앞 6자리를 모두 입력해야 저장돼요.";

/** 설명이 라벨과 다를 때만 (?) 와 sr-only 설명을 단다 — 그 설명 요소 id. */
export function hintIdOf(inputId: string, label: string, hint?: string): string | undefined {
  return hint && hint !== label ? `${inputId}-hint` : undefined;
}

/**
 * 라벨 + (?) 설명. (?) 버튼은 <label> 밖 — 눌러도 입력칸이 포커스·활성되지 않는다.
 * tag = 라벨 옆 작은 회색 표시(자동 계산 칸의 "(자동)") — 입력칸 이름(label)에는 들어가지 않는다.
 */
export function FieldLabel({ htmlFor, label, hint, tag }: { htmlFor: string; label: string; hint?: string; tag?: string }) {
  const hintId = hintIdOf(htmlFor, label, hint);
  return (
    <>
      <div className="flex items-center gap-1">
        <label htmlFor={htmlFor} className="text-xs font-medium text-gray-800">
          {label}
        </label>
        {tag && <span className="text-xs text-gray-500">{tag}</span>}
        {hintId && <HintTooltip label={label} text={hint!} />}
      </div>
      {hintId && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
    </>
  );
}

interface Props {
  def: FieldDef;
  value: string;
  onChange: (k: keyof CompanyInfo, v: string) => void;
  /** 입력칸 id — 패널·모달이 같은 칸을 동시에 그리므로 위치까지 넣은 고유값. */
  id: string;
  className?: string;
}

export default function CompanyInfoField({ def, value: v, onChange, id, className = "block" }: Props) {
  const [k, label, hint, , multi] = def;
  // 주민등록번호 칸이 입력을 잘랐거나 비웠을 때 그 이유(말없이 사라지지 않게).
  const [rrnNotice, setRrnNotice] = useState("");
  const isPhone = k === "연락처통신사";
  const isRrn = k === "주민등록번호";
  const hintId = hintIdOf(id, label, hint);
  const normalizeOnBlur = isPhone ? formatPhone : isRrn ? normalizeRrnFront : null;
  const onBlur = normalizeOnBlur
    ? () => {
        const next = normalizeOnBlur(v);
        if (isRrn && v.trim() !== "" && next === "") setRrnNotice(RRN_SHORT_MSG);
        if (next !== v) onChange(k, next);
      }
    : undefined;
  const isBizNo = k === "사업자등록번호";
  // 사업자등록번호는 입력하는 동시에 000-00-00000(belie 2026-09-29). 숫자 아닌 글이면 그대로.
  const bizLive = useLiveInput((raw, caret, prev) => (isBizNo ? bizNoTyping(raw, caret, prev) : null), v, (next) => onChange(k, next));
  const onInput = (raw: string) => {
    if (!isRrn) return onChange(k, raw);
    // 숫자가 6자리를 넘으면 뒷자리는 잘린다 — 잘린 이유를 칸 아래에 알린다.
    setRrnNotice(raw.replace(/\D/g, "").length > 6 ? RRN_CUT_MSG : "");
    onChange(k, sanitizeRrnFrontTyping(raw));
  };
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      {multi ? (
        <textarea
          id={id}
          className={`${inputCls} resize-none leading-5`}
          rows={Math.max(2, v.split("\n").length)}
          aria-describedby={hintId}
          value={v}
          onChange={(e) => onChange(k, e.target.value)}
        />
      ) : (
        <input
          id={id}
          className={inputCls}
          aria-describedby={hintId}
          inputMode={isPhone ? "tel" : isRrn || isBizNo ? "numeric" : undefined}
          autoComplete={isRrn ? "off" : undefined}
          ref={isBizNo ? bizLive.ref : undefined}
          value={v}
          onChange={isBizNo ? bizLive.onChange : (e) => onInput(e.target.value)}
          onBlur={onBlur}
        />
      )}
      {isRrn && rrnNotice && (
        <p className="mt-0.5 text-xs text-amber-700" role="status">
          {rrnNotice}
        </p>
      )}
    </div>
  );
}
