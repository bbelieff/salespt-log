/**
 * RowForm — 편집/추가 공용 폼 grid.
 * 정본: db-management.html v11 `renderFieldsForm`
 *
 * 자동수식 필드는 disabled + auto-field 스타일(노란 점선 박스).
 * 일반 입력 변경 시 클라이언트 미리보기 계산.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChannelMeta, FieldDef } from "../_lib/channels";
import { fmtWon } from "../_lib/channels";

interface Props {
  channel: ChannelMeta;
  initial?: Record<string, unknown>;
  onChange: (row: Record<string, unknown>) => void;
}

export default function RowForm({ channel, initial = {}, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = useMemo(() => {
    const b: Record<string, unknown> = {};
    for (const f of channel.fields) {
      if (f.formula) continue;
      if (f.key in initial) {
        b[f.key] = initial[f.key];
      } else if (f.type === "date") {
        b[f.key] = today;
      } else if (f.type === "number") {
        b[f.key] = "";
      } else if (f.type === "select" && f.options) {
        b[f.key] = f.options[0] ?? "";
      } else {
        b[f.key] = "";
      }
    }
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.cls]);

  const [draft, setDraft] = useState<Record<string, unknown>>(blank);

  // 부모에 알림
  useEffect(() => {
    onChange(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setField = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {channel.fields.map((f) => (
        <FieldCell
          key={f.key}
          field={f}
          value={draft[f.key]}
          allValues={draft}
          onChange={(v) => setField(f.key, v)}
        />
      ))}
    </div>
  );
}

function FieldCell({
  field,
  value,
  allValues,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  allValues: Record<string, unknown>;
  onChange: (v: string) => void;
}) {
  const colSpan = field.span === 2 ? "col-span-2" : "";

  // 자동수식 — disabled + 노란 박스
  if (field.formula) {
    const calcVal = field.calc ? field.calc(allValues) : 0;
    const display = calcVal
      ? `${fmtWon(calcVal)}${field.unit ? ` ${field.unit}` : ""}`
      : "-";
    return (
      <div className={colSpan}>
        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium leading-tight text-gray-600">
          <span>{field.label}</span>
          <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-800">
            🔒 자동
          </span>
        </label>
        <input
          type="text"
          disabled
          value={display}
          className="w-full cursor-not-allowed rounded-lg border border-dashed border-amber-600 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 num-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
      </div>
    );
  }

  // select
  if (field.type === "select" && field.options) {
    return (
      <div className={colSpan}>
        <label className="mb-1 block text-[11px] font-medium leading-tight text-gray-600">
          {field.label}
        </label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // 일반 input
  const numCls = field.type === "number" ? "num-mono" : "";
  return (
    <div className={colSpan}>
      <label className="mb-1 flex items-center gap-1 text-[11px] font-medium leading-tight text-gray-600">
        <span>
          {field.label}
          {field.unit && (
            <span className="ml-0.5 text-gray-300">({field.unit})</span>
          )}
        </span>
      </label>
      <input
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        inputMode={field.type === "number" ? "numeric" : undefined}
        min={field.type === "number" ? 0 : undefined}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${numCls}`}
        style={
          field.type === "number"
            ? { fontVariantNumeric: "tabular-nums" }
            : undefined
        }
      />
    </div>
  );
}
