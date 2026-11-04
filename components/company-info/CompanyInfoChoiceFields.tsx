/**
 * CompanyInfoChoiceFields — 업체정보 편집기의 선택형 칸 (company-info-restructure, belie 2026-09-28).
 *
 * - BizTypeField: 사업자구분 · 과세유형 한 칸 select. 고르면 두 저장 키를 함께 쓴다.
 *   옛 값(과세유형 빈칸·목록 밖 자유 글)은 고를 수 없는 "지금 값" 선택지로 그대로 보인다.
 *   목록 밖 자유 글은 새 값으로 바꿀 때 기타메모로 옮겨 둔다(말없이 지우지 않는다).
 * - OwnershipField(belie 2026-11-04 재배치): 주소지 아래 [면적 | 소유여부(드롭다운: 자가·임차·임차(무상)·기타)],
 *   임차면 그 아래 [보증금 | 월세]. 보증금·월세는 천원 단위로 보이고 적지만 저장은 원(옛 값·TXT·서류 자동입력 호환).
 *   단위(㎡·천원)는 칸 안에 흐리게. 목록 밖 옛 자유 글은 고를 수 없는 「지금 값」으로 보이고, 다른 값을 고르면
 *   기타메모로 옮긴다(말없이 지우지 않는다). 기업정보(소유여부)·대표자(대표소유여부)가 같은 모양.
 */
"use client";

import { useState } from "react";
import type { CompanyInfo } from "@/types";
import {
  BIZ_TYPE_OPTIONS,
  OWNERSHIP_OPTIONS,
  appendMemoLine,
  bizTypeChoose,
  bizTypeView,
  ownershipView,
  showsUnitSuffix,
  thousandToWon,
  wonToThousandView,
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

/** 단위(㎡·천원)를 칸 안 오른쪽에 흐리게 보이는 숫자 칸. thousand = 저장은 원, 보이기·적기는 천원. */
function UnitInput({ id, label, hint, unit, stored, thousand, onChange }: {
  id: string;
  label: string;
  hint: string;
  unit: string;
  stored: string;
  thousand: boolean;
  onChange: (v: string) => void;
}) {
  // 적는 동안은 친 글자를 그대로 붙잡는다 — 저장값(원)에서 다시 그리면 "1." 같은 중간 글이 사라진다.
  const [typing, setTyping] = useState<string | null>(null);
  const view = thousand ? (wonToThousandView(stored) ?? stored) : stored;
  const shown = typing ?? view;
  const live = useLiveInput(
    (raw, caret, prev) => (thousand ? groupTyping(raw, caret, prev) : null),
    shown,
    (v) => {
      setTyping(v);
      onChange(thousand ? thousandToWon(v) : v);
    },
  );
  // 옛 "1,000만"·"33㎡(10평)" 처럼 단위가 이미 적힌 값엔 단위를 또 보이지 않는다.
  const showUnit = showsUnitSuffix(shown);
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      <div className="relative">
        <input
          id={id}
          className={`${inputCls} min-w-0 ${showUnit ? "pr-10" : ""}`}
          aria-describedby={hintIdOf(id, label, hint)}
          inputMode="decimal"
          ref={live.ref}
          value={shown}
          onChange={live.onChange}
          onBlur={() => setTyping(null)}
        />
        {showUnit && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-400">{unit}</span>}
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
  const selectId = `${idBase}-${spec.key}`;
  const text = (k: keyof CI) => String(draft[k] ?? "");
  const raw = text(spec.key);
  const { choice, legacy } = ownershipView(raw);
  const hasLease = [spec.deposit, spec.rent].some((k) => text(k).trim() !== "");
  // 고르면 그 값으로. 목록 밖 옛 글이 있었으면 지우지 않고 기타메모로 옮겨 둔다.
  const pick = (next: string) => {
    const patch: Partial<CI> = { [spec.key]: next };
    if (legacy) patch[spec.memo] = appendMemoLine(text(spec.memo), `소유여부 이전 내용: ${legacy}`);
    onPatch(patch);
  };
  const part = (k: keyof CI, p: readonly [string, string, string], thousand: boolean) => (
    <UnitInput
      id={`${idBase}-${String(k)}`}
      label={p[0]}
      unit={p[1]}
      hint={p[2]}
      stored={text(k)}
      thousand={thousand}
      onChange={(v) => onPatch({ [k]: v } as Partial<CI>)}
    />
  );
  return (
    <div className={`${className} min-w-0 space-y-1.5`}>
      <div className="grid grid-cols-2 items-end gap-1.5">
        {part(spec.area, LEASE_PARTS.area, false)}
        <div className="min-w-0">
          <FieldLabel htmlFor={selectId} label="소유여부" hint={spec.hint} />
          <select
            id={selectId}
            className={inputCls}
            aria-describedby={hintIdOf(selectId, "소유여부", spec.hint)}
            value={legacy ? "__legacy" : choice}
            onChange={(e) => pick(e.target.value)}
          >
            <option value="">선택</option>
            {legacy && <option value="__legacy" disabled>{legacy}</option>}
            {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      {/* 보증금·월세는 임차일 때(또는 이미 값이 있을 때)만 — 소유여부 아래 한 줄. */}
      {(choice === "임차" || hasLease) && (
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="임차 조건">
          {part(spec.deposit, LEASE_PARTS.deposit, true)}
          {part(spec.rent, LEASE_PARTS.rent, true)}
        </div>
      )}
    </div>
  );
}
