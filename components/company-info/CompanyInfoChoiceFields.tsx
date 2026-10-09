/**
 * CompanyInfoChoiceFields — 업체정보 편집기의 선택형 칸 (company-info-restructure, belie 2026-09-28).
 *
 * - BizTypeField: 사업자구분 · 과세유형 한 칸 select. 고르면 두 저장 키를 함께 쓴다.
 *   옛 값(과세유형 빈칸·목록 밖 자유 글)은 고를 수 없는 "지금 값" 선택지로 그대로 보인다.
 *   목록 밖 자유 글은 새 값으로 바꿀 때 기타메모로 옮겨 둔다(말없이 지우지 않는다).
 * - OwnershipField: 소유여부 글칸(belie 2026-10-09 — 「선택」 드롭다운 폐지). 칸을 누르면 자가·임차 빠른 선택이
 *   뜨고, 그 밖(무상사용 등)은 칸에 그대로 적는다. 옛 자유 글은 칸에 그대로 보인다. 빠른 선택으로 바꿀 때
 *   칸의 다른 글은 지우지 않고 기타메모로 옮긴다. 면적(㎡)은 늘 보이고, 보증금(원)·월세(원)는 임차일 때
 *   (또는 이미 값이 있을 때)만 — 한 줄 세 칸. 기업정보(소유여부)·대표자(대표소유여부)가 같은 모양.
 * - 보증금·월세 쉼표는 칸을 떠날 때(blur) 찍는다 — 입력 중에 다시 찍으면 커서가 끝으로 튄다(연락처와 같은 방식).
 */
"use client";

import { useState } from "react";
import type { CompanyInfo } from "@/types";
import {
  BIZ_TYPE_OPTIONS,
  appendMemoLine,
  bizTypeChoose,
  bizTypeView,
  formatWonInput,
  ownershipView,
  showsUnitSuffix,
  type OwnershipChoice,
} from "@/util/company-choice";
import { BIZ_TYPE_HINT, BIZ_TYPE_LABEL, LEASE_PARTS, type OwnershipSpec } from "@/components/company-info-defs";
import { FieldLabel, hintIdOf, inputCls } from "./CompanyInfoField";
import { groupTyping } from "@/util/live-format";
import { useLiveInput } from "./useLiveInput";

type CI = CompanyInfo;
type Patch = (p: Partial<CI>) => void;

export function BizTypeField({ draft, onPatch, id }: { draft: CI; onPatch: Patch; id: string }) {
  const view = bizTypeView(draft.사업자구분, draft.과세유형);
  const choose = (value: string) => {
    const r = bizTypeChoose(value, draft);
    if (!r) return;
    const patch: Partial<CI> = { 사업자구분: r.사업자구분, 과세유형: r.과세유형 };
    if (r.lost.length > 0) {
      patch.업체기타메모 = appendMemoLine(draft.업체기타메모, `이전 ${r.lost.join(" · ")}`);
    }
    onPatch(patch);
  };
  return (
    <div className="block min-w-0">
      <FieldLabel htmlFor={id} label={BIZ_TYPE_LABEL} hint={BIZ_TYPE_HINT} />
      <select
        id={id}
        className={inputCls}
        aria-describedby={hintIdOf(id, BIZ_TYPE_LABEL, BIZ_TYPE_HINT)}
        value={view.value}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">선택</option>
        {view.current && (
          <option value={view.current.value} disabled>
            {view.current.label}
          </option>
        )}
        {BIZ_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function UnitInput({
  id,
  label,
  hint,
  unit,
  value,
  won,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  unit: string;
  value: string;
  won: boolean;
  onChange: (v: string) => void;
}) {
  const formatOnBlur = () => {
    const next = formatWonInput(value);
    if (next !== value) onChange(next);
  };
  // 원 단위 칸(보증금·월세)은 입력하는 동시에 천 단위 쉼표(belie 2026-09-29). 면적(㎡)은 그대로.
  const live = useLiveInput((raw, caret, prev) => (won ? groupTyping(raw, caret, prev) : null), value, onChange);
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <div className="flex items-center gap-1">
        <input
          id={id}
          className={`${inputCls} min-w-0`}
          aria-describedby={hintIdOf(id, label, hint)}
          inputMode={won ? "numeric" : "decimal"}
          ref={live.ref}
          value={value}
          onChange={live.onChange}
          onBlur={won ? formatOnBlur : undefined}
        />
        {/* 옛 "1,000만"·"33㎡(10평)" 처럼 단위가 이미 적힌 값엔 단위를 또 붙이지 않는다. */}
        {showsUnitSuffix(value) && <span className="shrink-0 text-xs text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

export function OwnershipField({
  spec,
  draft,
  onPatch,
  idBase,
  className = "block",
}: {
  spec: OwnershipSpec;
  draft: CI;
  onPatch: Patch;
  idBase: string;
  className?: string;
}) {
  const inputId = `${idBase}-${spec.key}`;
  const text = (k: keyof CI) => String(draft[k] ?? "");
  const raw = text(spec.key);
  const { choice } = ownershipView(raw);
  const [focused, setFocused] = useState(false);
  const hasLease = [spec.deposit, spec.rent].some((k) => text(k).trim() !== "");
  // 자가·임차 빠른 선택. 칸에 직접 적은 다른 글(기타)이 있으면 지우지 않고 기타메모로 옮겨 둔다.
  const pick = (next: Exclude<OwnershipChoice, "">) => {
    const patch: Partial<CI> = { [spec.key]: next };
    const old = raw.trim();
    if (old && old !== "자가" && old !== "임차") patch[spec.memo] = appendMemoLine(text(spec.memo), `소유여부 이전 내용: ${old}`);
    onPatch(patch);
  };
  const part = (k: keyof CI, p: readonly [string, string, string], won: boolean) => (
    <UnitInput
      id={`${idBase}-${String(k)}`}
      label={p[0]}
      unit={p[1]}
      hint={p[2]}
      value={text(k)}
      won={won}
      onChange={(v) => onPatch({ [k]: v } as Partial<CI>)}
    />
  );
  return (
    <div className={`${className} min-w-0`}>
      <FieldLabel htmlFor={inputId} label="소유여부" hint={spec.hint} />
      {/* 「선택」 드롭다운 대신 글칸(belie 2026-10-09): 누르면 자가·임차를 바로 고르거나, 그 밖(무상사용 등)은 그대로 적는다. */}
      <input
        id={inputId}
        className={inputCls}
        aria-describedby={hintIdOf(inputId, "소유여부", spec.hint)}
        placeholder="자가 · 임차 · 그 밖은 직접 적기"
        value={raw}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onPatch({ [spec.key]: e.target.value } as Partial<CI>)}
      />
      {focused && (
        <div className="mt-1 flex gap-1.5" role="group" aria-label="소유여부 빠른 선택">
          {(["자가", "임차"] as const).map((c) => (
            <button
              key={c}
              type="button"
              // 누르는 순간 칸이 포커스를 잃어 버튼이 사라지지 않게(클릭 전에 blur 막기).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              aria-pressed={raw.trim() === c}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${raw.trim() === c ? "border-brand-red bg-red-50 text-brand-red" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {/* 면적은 자가·임차 상관없이 늘 보인다(belie 2026-10-09). 보증금·월세는 임차일 때(또는 이미 값이 있을 때)만.
          좁은 폰(360px 미만)은 세로로 쌓이고, 그 이상은 세 칸 한 줄 — 가로 넘침 없음. */}
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 xs:grid-cols-3" role="group" aria-label="면적·임차 조건">
        {(choice === "임차" || hasLease) && part(spec.deposit, LEASE_PARTS.deposit, true)}
        {(choice === "임차" || hasLease) && part(spec.rent, LEASE_PARTS.rent, true)}
        {part(spec.area, LEASE_PARTS.area, false)}
      </div>
    </div>
  );
}
