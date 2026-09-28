/**
 * CompanyInfoChoiceFields — 업체정보 편집기의 선택형 칸 (company-info-restructure, belie 2026-09-28).
 *
 * - BizTypeField: 사업자구분 · 과세유형 한 칸 select. 고르면 두 저장 키를 함께 쓴다.
 *   옛 값(과세유형 빈칸·목록 밖 자유 글)은 고를 수 없는 "지금 값" 선택지로 그대로 보인다.
 *   목록 밖 자유 글은 새 값으로 바꿀 때 기타메모로 옮겨 둔다(말없이 지우지 않는다).
 * - OwnershipField: 소유여부 자가/임차 select. 임차면(또는 임차 칸에 이미 값이 있으면) 보증금(원)·
 *   월세(원)·면적(㎡) 세 칸을 한 줄에. 옛 자유 글("임차 : 보 1000만, 월 50만")은 선택을 짐작해 보여 주고
 *   원문을 "이전에 적은 내용"으로 칸 아래에 둔다 — 선택을 바꾸거나, 짐작이 맞으면 "임차로 확정"을 누르면
 *   (이미 선택된 값을 다시 고르면 change 가 안 일어나므로) 선택값을 저장하고 원문을 기타메모로 옮긴다.
 *   기업정보(소유여부)·대표자(대표소유여부)가 같은 모양.
 * - 보증금·월세 쉼표는 칸을 떠날 때(blur) 찍는다 — 입력 중에 다시 찍으면 커서가 끝으로 튄다(연락처와 같은 방식).
 */
"use client";

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
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <div className="flex items-center gap-1">
        <input
          id={id}
          className={`${inputCls} min-w-0`}
          aria-describedby={hintIdOf(id, label, hint)}
          inputMode={won ? "numeric" : "decimal"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
  const { choice, legacy } = ownershipView(String(draft[spec.key] ?? ""));
  const selectId = `${idBase}-${spec.key}`;
  const text = (k: keyof CI) => String(draft[k] ?? "");
  const hasLease = [spec.deposit, spec.rent, spec.area].some((k) => text(k).trim() !== "");
  const choose = (next: OwnershipChoice) => {
    const patch: Partial<CI> = { [spec.key]: next };
    // 옛 자유 글은 기타메모로 옮겨 둔다(보증금·월세 같은 글이 선택 하나로 사라지지 않게).
    if (legacy) patch[spec.memo] = appendMemoLine(text(spec.memo), `소유여부 이전 내용: ${legacy}`);
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
      <FieldLabel htmlFor={selectId} label="소유여부" hint={spec.hint} />
      <select
        id={selectId}
        className={inputCls}
        aria-describedby={hintIdOf(selectId, "소유여부", spec.hint)}
        value={choice}
        onChange={(e) => choose(e.target.value as OwnershipChoice)}
      >
        <option value="">선택</option>
        <option value="자가">자가</option>
        <option value="임차">임차</option>
      </select>
      {legacy && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500" role="note">
          <span className="min-w-0 break-words">이전에 적은 내용: {legacy} · 선택하면 기타메모로 옮겨 둬요</span>
          {choice && (
            <button
              type="button"
              onClick={() => choose(choice)}
              className="shrink-0 rounded border border-gray-300 px-1.5 text-gray-700 hover:bg-gray-50"
            >
              {choice}로 확정
            </button>
          )}
        </div>
      )}
      {(choice === "임차" || hasLease) && (
        // 좁은 폰(360px 미만)은 세로로 쌓이고, 그 이상은 세 칸 한 줄 — 가로 넘침 없음.
        <div className="mt-1.5 grid grid-cols-1 gap-1.5 xs:grid-cols-3" role="group" aria-label="임차 조건">
          {part(spec.deposit, LEASE_PARTS.deposit, true)}
          {part(spec.rent, LEASE_PARTS.rent, true)}
          {part(spec.area, LEASE_PARTS.area, false)}
        </div>
      )}
    </div>
  );
}
