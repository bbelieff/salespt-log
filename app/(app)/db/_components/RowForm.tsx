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
        b[f.key] = 0; // Zod number 스키마 — 빈 string 보내면 invalid_type
      } else if (f.type === "toggle") {
        b[f.key] = false;
      } else if (f.type === "select" && f.options) {
        b[f.key] = f.options[0] ?? "";
      } else {
        b[f.key] = "";
      }
    }
    // C3(R4): 매입DB 편집 시 총액은 컬럼이 아니라 입력 도우미라 initial 에 없다.
    //   저장된 개당단가 × 개수 로 총액을 역복원(부가세 토글 off 기준) → 개당단가 그대로 라운드트립.
    if ("총액" in b && !("총액" in initial) && typeof initial["개당단가"] === "number") {
      b["총액"] = (initial["개당단가"] as number) * Number(initial["주문개수"] ?? 0);
    }
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.cls]);

  const [draft, setDraft] = useState<Record<string, unknown>>(blank);

  // 자동(formula) 필드값을 채워 제출용 row 를 만든다 — 매입DB 개당단가는 시트수식이 아니라
  // 클라 역산값이므로 payload 에 포함돼야 저장된다(진짜 시트 수식 컬럼은 repo writeRow 가 재치환).
  // fields 순서대로 누적 → 뒤 수식(주문금액)이 앞 수식(개당단가) 결과를 참조 가능.
  const computed = useMemo(() => {
    const r: Record<string, unknown> = { ...draft };
    for (const f of channel.fields) {
      if (f.formula && f.calc) r[f.key] = f.calc(r);
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, channel.cls]);

  // 부모에 알림 (제출용 = 자동값 포함)
  useEffect(() => {
    onChange(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed]);

  // 타입별 변환: number 필드는 숫자로 캐스트해야 Zod 검증 통과 (Expected number).
  const setField = (key: string, raw: string) => {
    const field = channel.fields.find((f) => f.key === key);
    let value: unknown = raw;
    if (field?.type === "number") {
      const n = raw === "" ? 0 : Number(raw);
      value = Number.isFinite(n) ? n : 0;
    } else if (field?.type === "toggle") {
      value = raw === "true";
    }
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {channel.fields.map((f) => (
        <FieldCell
          key={f.key}
          field={f}
          value={draft[f.key]}
          allValues={computed}
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

  // toggle (부가세 포함 여부 등) — DB 컬럼 아닌 입력 도우미
  if (field.type === "toggle") {
    const on = Boolean(value);
    return (
      <div className={colSpan}>
        <label className="mb-1 block text-[11px] font-medium leading-tight text-gray-600">
          {field.label}
        </label>
        <button
          type="button"
          onClick={() => onChange(on ? "false" : "true")}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium ${
            on
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-300 bg-white text-gray-500"
          }`}
        >
          <span>{on ? "포함" : "미포함"}</span>
          <span
            className={`inline-flex h-4 w-7 items-center rounded-full px-0.5 transition-colors ${
              on ? "justify-end bg-blue-500" : "justify-start bg-gray-300"
            }`}
          >
            <span className="h-3 w-3 rounded-full bg-white" />
          </span>
        </button>
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
  // 금액 필드(unit="원"): 천 단위 콤마 표시 + numeric keyboard.
  // 입력은 text로 받되 onChange 시 콤마 strip 후 숫자만 부모로 전달.
  const isMoney = field.type === "number" && field.unit === "원";
  // number 필드: value가 0(default)이면 input은 빈 문자열로 표시 — UX 개선
  const numericValue = field.type === "number" ? Number(value ?? 0) : 0;
  const isEmpty =
    value === 0 || value === undefined || value === null || value === "";
  const inputValue = isMoney
    ? isEmpty
      ? ""
      : numericValue.toLocaleString("ko-KR")
    : field.type === "number"
      ? isEmpty
        ? ""
        : String(value)
      : String(value ?? "");
  // iOS Safari date input intrinsic-width 오버플로 방지: 부모 min-w-0 + appearance-none.
  const dateOverflowFix = field.type === "date" ? "appearance-none" : "";
  // 금액은 type="text" 로 — type="number"는 콤마 표시 시 invalid 처리됨.
  const inputType =
    field.type === "date"
      ? "date"
      : isMoney
        ? "text"
        : field.type === "number"
          ? "number"
          : "text";
  const handleChange = (raw: string) => {
    if (isMoney) {
      // 비숫자(콤마·공백·문자) 모두 strip → 부모 setField 가 Number() 캐스트.
      onChange(raw.replace(/[^\d]/g, ""));
    } else {
      onChange(raw);
    }
  };
  return (
    <div className={`min-w-0 ${colSpan}`}>
      <label className="mb-1 flex items-center gap-1 text-[11px] font-medium leading-tight text-gray-600">
        <span>
          {field.label}
          {field.unit && (
            <span className="ml-0.5 text-gray-300">({field.unit})</span>
          )}
        </span>
      </label>
      <input
        type={inputType}
        inputMode={field.type === "number" ? "numeric" : undefined}
        min={field.type === "number" && !isMoney ? 0 : undefined}
        value={inputValue}
        placeholder={field.placeholder}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${numCls} ${dateOverflowFix}`}
        style={
          field.type === "number"
            ? { fontVariantNumeric: "tabular-nums" }
            : undefined
        }
      />
    </div>
  );
}
