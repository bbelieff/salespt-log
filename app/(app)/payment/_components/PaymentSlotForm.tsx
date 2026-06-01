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

import type { PaymentSlot, Progress, Todo } from "@/types";
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
}

function fmtComma(n: number): string {
  if (!n) return "";
  return n.toLocaleString("en-US");
}

export default function PaymentSlotForm({
  index,
  slot,
  removable,
  onChange,
  onRemove,
  contractRef,
  companyName,
  todos,
}: Props) {
  const style = SLOT_STYLES[index];
  const pct = progressToPct(slot.진행률);
  const fillClass = getSegClass(index, pct);
  const chipClass = pct >= 100 ? style.chipFull : style.chip;

  const set = <K extends keyof PaymentSlot>(key: K, value: PaymentSlot[K]) =>
    onChange({ ...slot, [key]: value });

  // 5등분 클릭 영역 (각 영역 = 20%, 동일 % 재클릭 시 0%)
  const segments = [20, 40, 60, 80, 100] as const;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      {/* 슬롯 헤더 */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold leading-none ${chipClass}`}
          >
            {index}
          </div>
          <span className="text-sm font-semibold text-gray-800">{style.name}</span>
        </div>
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-gray-400 hover:text-red-500"
            aria-label="수납 제거"
            title="이 수납 제거"
          >
            ✕
          </button>
        )}
      </div>

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
        <FieldText
          label="진행기관"
          value={slot.진행기관}
          placeholder="예: 미소재단"
          onChange={(v) => set("진행기관", v)}
        />
        <FieldText
          label="메모"
          value={slot.메모}
          placeholder="이 수납기관 관련 메모"
          onChange={(v) => set("메모", v)}
        />
        {/* ToDo 섹션 (Scope 2) — 메모와 진행률 사이, 이 기관(슬롯) 단위 */}
        {contractRef && (
          <TodoSection
            contractRef={contractRef}
            institutionRef={slot.진행기관}
            companyName={companyName ?? ""}
            todos={(todos ?? []).filter(
              (t) => t.institutionRef === slot.진행기관,
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
        <div className="grid grid-cols-3 gap-2">
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

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // iOS Safari 의 <input type="date"> 는 placeholder 폭(yyyy/mm/dd)으로
  // intrinsic width 를 잡아 grid cell 을 뚫고 나옴. 부모 div 에 min-w-0,
  // input 에 appearance-none 을 주어 grid 폭에 맞춰 shrink 되도록 강제.
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

/** 천 단위 콤마 + 커서 위치 보정 입력 (prototype v9 §[1] 패턴). */
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
      <input
        type="text"
        inputMode="numeric"
        value={fmtComma(value)}
        placeholder={placeholder}
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
          onChange(num);
        }}
        className={FIELD_INPUT_CLASS}
        style={{ fontVariantNumeric: "tabular-nums" }}
      />
    </div>
  );
}
