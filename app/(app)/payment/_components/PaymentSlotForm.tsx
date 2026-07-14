/**
 * PaymentSlotForm v2 — 1 분할수납 슬롯 입력 (6 필드).
 * 시트 매핑: M~R (수납1) / S~X (수납2) / Y~AD (수납3)
 *
 * 필드: 진행기관 / 진행률(dropdown) / 현황 / 승인금액(원) / 수납액(원) / 수납일
 *
 * v9 prototype 매칭:
 *   - 슬롯별 색상 (1=teal / 2=cyan / 3=fuchsia)
 *   - 진행도 볼륨바 (5등분 클릭 — 0/20/40/60/80/100%)
 *   - 천 단위 콤마 input + 커서 위치 보정
 *   - 동일 % 재클릭 시 0% 토글
 */
"use client";

import { useId, useState } from "react";
import type { PaymentSlot, Progress, Todo } from "@/types";
import MoneyInput from "@/components/ui/MoneyInput";
import { formatMoneyInput } from "@/lib/format/money";
import TodoSection from "./TodoSection";

const SLOT_STYLES = {
  1: {
    name: "진행 1",
    family: "teal" as const,
    chip: "bg-teal-100 text-teal-700",
    chipFull: "bg-teal-600 text-white",
    segLow: "bg-teal-300",
    segMid: "bg-teal-500",
    segHigh: "bg-teal-700",
  },
  2: {
    name: "진행 2",
    family: "cyan" as const,
    chip: "bg-cyan-100 text-cyan-700",
    chipFull: "bg-cyan-600 text-white",
    segLow: "bg-cyan-300",
    segMid: "bg-cyan-500",
    segHigh: "bg-cyan-700",
  },
  3: {
    name: "진행 3",
    family: "fuchsia" as const,
    chip: "bg-fuchsia-100 text-fuchsia-700",
    chipFull: "bg-fuchsia-600 text-white",
    segLow: "bg-fuchsia-300",
    segMid: "bg-fuchsia-500",
    segHigh: "bg-fuchsia-700",
  },
} as const;

const PROGRESS_OPTIONS: Progress[] = ["", "0%", "20%", "40%", "60%", "80%", "100%"];

function progressToPct(p: Progress): number {
  if (p === "" || p === "0%") return 0;
  return parseInt(p, 10);
}

function pctToProgress(pct: number): Progress {
  if (pct === 0) return "";
  return `${pct}%` as Progress;
}

function getSegClass(slotIdx: 1 | 2 | 3, pct: number): string {
  if (pct === 0) return "bg-gray-300";
  const s = SLOT_STYLES[slotIdx];
  if (pct <= 40) return s.segLow;
  if (pct <= 80) return s.segMid;
  return s.segHigh;
}

interface Props {
  index: 1 | 2 | 3;
  slot: PaymentSlot;
  removable?: boolean; // 슬롯 2/3만 제거 가능
  onChange: (next: PaymentSlot) => void;
  onRemove?: () => void;
  /** Scope 2 — ToDo 섹션. contractRef 있을 때만 표시 (신규 계약은 미표시). */
  contractRef?: string;
  companyName?: string;
  /** 이 계약 전체 ToDo — 슬롯이 institutionRef(=진행기관)로 필터. */
  todos?: Todo[];
  focusTodoId?: string | null; // 캘린더 포커스 ToDo → TodoSection 전달.
  /** 저장본(cp) 진행기관 — ToDo 키(draft 아닌 저장값과만 묶어 새로고침 후 매칭 유지). */
  savedInstitution?: string;
  /** [3] 진행기관 콤보박스 후보 (자유입력 + 과거값 자동완성). */
  institutionOptions?: string[];
  /** [4] ToDo 추가 시 미저장 진행기관이면 이 콜백으로 슬롯(계약)을 먼저 저장. */
  onEnsureSaved?: () => void;
}

/** 공용 부품 별칭 — 0/빈값은 빈칸(기존 fmtComma 시맨틱 승계). 중복 구현 제거. */
const fmtComma = formatMoneyInput;

export default function PaymentSlotForm({
  index,
  slot,
  removable,
  onChange,
  onRemove,
  contractRef,
  companyName,
  todos,
  focusTodoId,
  savedInstitution,
  institutionOptions,
  onEnsureSaved,
}: Props) {
  const style = SLOT_STYLES[index];
  const pct = progressToPct(slot.진행률);
  const fillClass = getSegClass(index, pct);
  const chipClass = pct >= 100 ? style.chipFull : style.chip;

  const set = <K extends keyof PaymentSlot>(key: K, value: PaymentSlot[K]) =>
    onChange({ ...slot, [key]: value });

  // 5등분 클릭 영역 (각 영역 = 20%, 동일 % 재클릭 시 0%)
  const segments = [20, 40, 60, 80, 100] as const;

  // 완료 슬롯(100% 또는 승인>0 && 수납>=승인) 기본 접힘 / 진행 중 펼침.
  const isDone =
    pct >= 100 || (slot.승인금액 > 0 && slot.수납액 >= slot.승인금액);
  const [open, setOpen] = useState(!isDone);
  const pctColor =
    pct === 0 ? "text-gray-400" : pct >= 100 ? "text-green-600" : "text-blue-600";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      {/* 슬롯 헤더 — 클릭으로 접기/펼치기. 완료 슬롯은 기본 접힘. */}
      <div
        className={`flex cursor-pointer items-center justify-between gap-2 ${
          open ? "mb-2.5" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none ${chipClass}`}
          >
            {index}
          </div>
          <span className="shrink-0 text-sm font-semibold text-gray-800">
            {style.name}
          </span>
          {/* 접힘 요약: 진행기관 · 진행률 · 수납/승인 */}
          {!open && (
            <span className="ml-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-gray-500">
              <span className="truncate font-medium text-gray-600">
                {slot.진행기관 || "기관 미입력"}
              </span>
              <span className={`shrink-0 font-semibold ${pctColor}`}>· {pct}%</span>
              {(slot.승인금액 > 0 || slot.수납액 > 0) && (
                <span
                  className="shrink-0"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  · ₩{fmtComma(slot.수납액) || 0}/{fmtComma(slot.승인금액) || 0}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* [10] 주제 = 진행기관명 (펼침 시만; 접힘 땐 좌측 요약에 표시). */}
          {open && slot.진행기관 && (
            <span
              className="max-w-[140px] truncate text-xs font-semibold text-gray-600"
              title={slot.진행기관}
            >
              🏛 {slot.진행기관}
            </span>
          )}
          {removable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="shrink-0 text-xs text-gray-400 hover:text-red-500"
              aria-label="수납 제거"
              title="이 수납 제거"
            >
              ✕
            </button>
          )}
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {open && (
        <>


      {/* 진행도 볼륨바 (5등분 클릭) */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-gray-500">진행도</span>
          <span
            className={`text-xs font-semibold ${
              pct === 0
                ? "text-gray-400"
                : pct >= 100
                  ? "text-green-600"
                  : "text-gray-700"
            }`}
          >
            {pct}%
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`}
            style={{
              width: `${pct}%`,
              transition: "width 0.3s ease-out",
            }}
          />
          <div className="absolute inset-0 flex">
            {segments.map((target) => {
              const next = pct === target ? 0 : target;
              return (
                <button
                  key={target}
                  type="button"
                  onClick={() => set("진행률", pctToProgress(next))}
                  className="flex-1 transition-colors hover:bg-white/30"
                  aria-label={`진행도 ${target}%`}
                  title={`${target}%`}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex justify-between px-0.5 text-[10px] text-gray-400">
          <span>0</span>
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100</span>
        </div>
      </div>

      {/* 입력 필드 — 2026-05-17 재구성:
          진행기관 → 메모 → (진행률 + 진행내용) → (승인금액 + 수납일 + 수납액) */}
      <div className="space-y-1.5">
        <FieldCombo
          label="진행기관"
          value={slot.진행기관}
          placeholder="예: 미소재단 (입력하면 다음부터 목록에 떠요)"
          options={institutionOptions ?? []}
          onChange={(v) => set("진행기관", v)}
        />
        <FieldText
          label="메모"
          value={slot.메모}
          placeholder="이 기관 진행 메모"
          onChange={(v) => set("메모", v)}
        />
        {/* ToDo 섹션 (Scope 2) — 메모와 진행률 사이, 이 기관(슬롯) 단위.
            키는 저장본(cp) 진행기관 — draft(미저장)가 아니라 저장값과만 묶음. */}
        {contractRef && (
          <TodoSection
            contractRef={contractRef}
            institutionRef={savedInstitution ?? ""}
            draftInstitution={slot.진행기관}
            companyName={companyName ?? ""}
            onEnsureSaved={onEnsureSaved}
            focusId={focusTodoId}
            todos={(todos ?? []).filter(
              (t) => t.institutionRef === (savedInstitution ?? ""),
            )}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <FieldSelect
            label="진행률"
            value={slot.진행률}
            options={PROGRESS_OPTIONS}
            onChange={(v) => set("진행률", v as Progress)}
          />
          <FieldText
            label="현황"
            value={slot.현황}
            placeholder="예: 실사 진행 중"
            onChange={(v) => set("현황", v)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-2">
          <FieldMoney
            label="승인금액 (원)"
            value={slot.승인금액}
            placeholder="3,000,000"
            onChange={(v) => set("승인금액", v)}
          />
          <FieldDate
            label="수납일"
            value={slot.수납일}
            onChange={(v) => set("수납일", v)}
          />
          <FieldMoney
            label="수납액 (원)"
            value={slot.수납액}
            placeholder="2,000,000"
            onChange={(v) => set("수납액", v)}
          />
        </div>
      </div>
        </>
      )}
    </div>
  );
}

// ── 필드 프리미티브 ──────────────────────────────────────────

const FIELD_INPUT_CLASS =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none";

const FIELD_LABEL_CLASS = "mb-0.5 block text-xs text-gray-500";

function FieldText({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder ?? "-"}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT_CLASS}
      />
    </div>
  );
}

/** [3] 자유입력 + 과거값 자동완성(구글시트 드롭다운형). native datalist 사용. */
function FieldCombo({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const listId = useId();
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="text"
        list={listId}
        value={value}
        placeholder={placeholder ?? "-"}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT_CLASS}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // iOS Safari date input intrinsic width(yyyy/mm/dd)가 grid 뚫는 것 → min-w-0 + appearance-none 으로 shrink 강제.
  return (
    <div className="min-w-0">
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_INPUT_CLASS} appearance-none`}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT_CLASS}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "" ? "—" : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 천 단위 콤마 + 커서 보정 — 공용 MoneyInput 위임(중복 구현 제거). 라벨 래퍼만 유지. */
function FieldMoney({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <MoneyInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={FIELD_INPUT_CLASS}
        aria-label={label}
      />
    </div>
  );
}
