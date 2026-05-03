/**
 * PaymentSlotForm — 1 분할수납 슬롯 입력 (5 필드).
 * 시트 매핑: M~Q (수납1) / R~V (수납2) / W~AA (수납3)
 *
 * 필드: 진행기관(text) / 현황(text) / 승인금액(number, 원) / 수납액(number, 원) / 수납일(date)
 */
"use client";

import type { PaymentSlot } from "@/types";

interface Props {
  index: 1 | 2 | 3;
  slot: PaymentSlot;
  onChange: (next: PaymentSlot) => void;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function PaymentSlotForm({ index, slot, onChange }: Props) {
  const set = <K extends keyof PaymentSlot>(key: K, value: PaymentSlot[K]) =>
    onChange({ ...slot, [key]: value });

  // 진척: 수납액 / 승인금액
  const progress =
    slot.승인금액 > 0
      ? Math.round((slot.수납액 / slot.승인금액) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold text-gray-700">수납 {index}</div>
        {slot.승인금액 > 0 && (
          <div className="text-[11px] text-gray-500">
            진척 <span className="font-semibold text-blue-700">{progress}%</span>
            {" · "}
            <span className="num-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtMoney(slot.수납액)} / {fmtMoney(slot.승인금액)}원
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="진행기관" type="text" value={slot.진행기관}
          onChange={(v) => set("진행기관", v)}
          placeholder="예: 미소재단"
        />
        <Field label="현황" type="text" value={slot.현황}
          onChange={(v) => set("현황", v)}
          placeholder="예: 실사중"
        />
        <Field label="승인금액 (원)" type="number" value={slot.승인금액}
          onChange={(v) => set("승인금액", Number(v) || 0)}
        />
        <Field label="수납액 (원)" type="number" value={slot.수납액}
          onChange={(v) => set("수납액", Number(v) || 0)}
        />
        <div className="col-span-2">
          <Field label="수납일" type="date" value={slot.수납일}
            onChange={(v) => set("수납일", v)}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: "text" | "number" | "date";
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const numStyle =
    type === "number" ? { fontVariantNumeric: "tabular-nums" as const } : undefined;
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-600">
        {label}
      </label>
      <input
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        value={String(value ?? "")}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        style={numStyle}
      />
    </div>
  );
}
