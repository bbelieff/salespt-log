/**
 * RowForm — 편집/추가 공용 폼 grid.
 * 정본: db-management.html v11 `renderFieldsForm`
 *
 * 자동수식 필드는 disabled + auto-field 스타일(노란 점선 박스).
 * 일반 입력 변경 시 클라이언트 미리보기 계산.
 *
 * 정렬 계약(2026-09-24): 모든 컨트롤 공통 높이(h-10) + 라벨 하단 baseline
 * (min-h-8 items-end). 예시 문구는 컨트롤 위 별도 span이 아니라 실제
 * input placeholder로 이동(라벨은 그대로 유지). 2개 수식 필드는
 * memo(span=2) 앞의 전용 2열 그룹에만 렌더(계산 순서는 channel.fields
 * 원본 순서 그대로 — computed는 손대지 않음).
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChannelMeta, FieldDef } from "../_lib/channels";
import { fmtWon } from "../_lib/channels";
import { rowFormDirty } from "../_lib/dirty";
import MoneyInput from "@/components/ui/MoneyInput";
import PhoneInput from "@/components/ui/PhoneInput";

interface Props {
  channel: ChannelMeta;
  initial?: Record<string, unknown>;
  onChange: (row: Record<string, unknown>) => void;
  /** 미저장 여부 — **자동 필드 제외** draft vs blank. RowCard/추가폼 이탈 가드용(거짓 dirty 0). */
  onDirtyChange?: (dirty: boolean) => void;
}

export default function RowForm({ channel, initial = {}, onChange, onDirtyChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  // 추가(생산 시작) 모드 = initial 없음. 2단계 필드(hideInAdd) 숨김 판단용.
  const isAdd = Object.keys(initial).length === 0;
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
    // C3: 매입DB 편집 시 총액은 컬럼이 아니라 입력 도우미라 initial 에 없다.
    //   저장된 개당단가·부가세여부로 총액 역복원 → 개당단가 그대로 라운드트립, 토글도 복원.
    //   부가세 포함이면 ×1.1 (calc 가 다시 ÷1.1 하므로 일치).
    if ("총액" in b && !("총액" in initial) && typeof initial["개당단가"] === "number") {
      const base = (initial["개당단가"] as number) * Number(initial["주문개수"] ?? 0);
      b["총액"] = b["부가세여부"] ? Math.round(base * 1.1) : base;
    }
    // C1: 직접생산 편집 시 예산입력(도우미) 역복원 — 저장 기간예산(부가세 제외)×(포함?1.1).
    if ("예산입력" in b && typeof initial["기간예산"] === "number") {
      const ex = initial["기간예산"] as number;
      b["예산입력"] = b["부가세여부"] ? Math.round(ex * 1.1) : ex;
    }
    // 직접생산 생산개수(M)는 입력칸 없는 자동 동기화값(ADR-0024) — 개당단가(예산÷생산개수)
    // 계산용으로만 draft 에 보존(저장 시 service 가 유입합으로 재동기화).
    if (typeof initial["생산개수"] === "number") b["생산개수"] = initial["생산개수"];
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

  // 미저장 판정 = 서버 기준값(blank) vs 현재 입력(draft), **자동(formula) 필드 제외**.
  // 수식/자동값 mount 정착이 거짓 dirty 를 못 내게 함(유실 사고 수리). blank 은 [channel.cls] 메모라
  // initial(=서버 row) 이 refetch 로 바뀌어도 재계산 안 됨 → 편집 중 draft 안 덮임.
  useEffect(() => {
    onDirtyChange?.(rowFormDirty(channel.fields, blank, draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, blank]);

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

  // 렌더 전용 그룹핑 — 계산 순서(computed)는 channel.fields 원본 그대로.
  // inline(일반 1칸) → 수식 2열 그룹 → memo(span=2). 일반 필드 원본 순서 유지.
  const visible = channel.fields.filter((f) => !(isAdd && f.hideInAdd));
  const formulaFields = visible.filter((f) => f.formula);
  const memoFields = visible.filter((f) => !f.formula && f.span === 2);
  const inlineFields = visible.filter((f) => !f.formula && f.span !== 2);

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {inlineFields.length > 0 && (
        <div className="grid min-w-0 grid-cols-2 gap-2.5">
          {inlineFields.map((f) => (
            <FieldCell
              key={f.key}
              field={f}
              value={draft[f.key]}
              allValues={computed}
              onChange={(v) => setField(f.key, v)}
            />
          ))}
        </div>
      )}
      {formulaFields.length > 0 && (
        <div className="grid min-w-0 grid-cols-2 gap-2.5">
          {formulaFields.map((f) => (
            <FieldCell
              key={f.key}
              field={f}
              value={draft[f.key]}
              allValues={computed}
              onChange={(v) => setField(f.key, v)}
            />
          ))}
        </div>
      )}
      {memoFields.map((f) => (
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
  // 라벨 baseline — 2줄 라벨과 1줄 라벨이 섞여도 컨트롤 시작점이 어긋나지 않게
  // 같은 grid 행의 셀을 늘리고 라벨이 남은 높이를 채워 제어점을 맞춘다.
  const labelCls =
    "mb-1 flex min-h-4 flex-1 flex-wrap items-end gap-1 text-xs font-medium leading-tight text-gray-600";

  // 자동수식 — disabled + 노란 박스
  if (field.formula) {
    const calcVal = field.calc ? field.calc(allValues) : 0;
    const display = calcVal
      ? `${fmtWon(calcVal)}${field.unit ? ` ${field.unit}` : ""}`
      : "-";
    return (
      <div className="flex min-w-0 flex-col">
        <label className={labelCls}>
          <span className="min-w-0 break-keep">{field.label}</span>
          <span className="shrink-0 rounded bg-amber-100 px-1 py-px text-[11px] font-bold text-amber-800">
            🔒 자동
          </span>
        </label>
        <input
          type="text"
          disabled
          value={display}
          title={display}
          aria-label={field.label}
          data-field={field.key}
          className="h-10 w-full min-w-0 max-w-full cursor-not-allowed truncate rounded-lg border border-dashed border-amber-600 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 num-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
      </div>
    );
  }

  // toggle (부가세 포함 여부 등) — DB 컬럼 아닌 입력 도우미
  if (field.type === "toggle") {
    const on = Boolean(value);
    return (
      <div className="flex min-w-0 flex-col">
        <label className={labelCls}>{field.label}</label>
        <button
          type="button"
          onClick={() => onChange(on ? "false" : "true")}
          aria-label={field.label}
          aria-pressed={on}
          data-field={field.key}
          className={`flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
            on
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-300 bg-white text-gray-500"
          }`}
        >
          <span className="min-w-0 truncate">{on ? "포함" : "미포함"}</span>
          <span
            aria-hidden="true"
            className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors ${
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
      <div className="flex min-w-0 flex-col">
        <label className={labelCls}>{field.label}</label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          data-field={field.key}
          className="h-10 w-full min-w-0 max-w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
  // 금액 필드(unit="원") → 공용 MoneyInput(콤마 + 커서 보정). 부모 setField 가 Number() 캐스트하므로
  // number 방출을 String 으로 넘긴다(계약 유지: 시트에는 숫자만 나간다).
  const isMoney = field.type === "number" && field.unit === "원";
  const isPhone = field.type === "phone"; // → 공용 PhoneInput(자동 하이픈)
  const numericValue = field.type === "number" ? Number(value ?? 0) : 0;
  // number 필드: value가 0(default)이면 input은 빈 문자열로 표시 — UX 개선
  const isEmpty =
    value === 0 || value === undefined || value === null || value === "";
  const inputValue =
    field.type === "number" ? (isEmpty ? "" : String(value)) : String(value ?? "");
  // iOS Safari date input intrinsic-width 오버플로 방지: 부모 min-w-0 + appearance-none.
  const dateOverflowFix = field.type === "date" ? "appearance-none" : "";
  const inputType = field.type === "date" ? "date" : field.type === "number" ? "number" : "text";
  // 예시 문구는 위 별도 span이 아니라 실제 placeholder로 — 별도 행이 생기지 않아
  // 짝지어진 두 컨트롤 높이가 어긋나지 않는다. 라벨은 그대로 유지.
  const inputCls = `h-10 w-full min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${numCls} ${dateOverflowFix}`;

  return (
    <div className="flex min-w-0 flex-col">
      <label className={labelCls}>
        <span className="min-w-0 break-keep">
          {field.label}
          {field.unit && (
            <span className="ml-0.5 text-gray-300">({field.unit})</span>
          )}
        </span>
      </label>
      {isMoney ? (
        <MoneyInput
          value={numericValue}
          onChange={(n) => onChange(String(n))}
          placeholder={field.placeholder}
          className={inputCls}
          aria-label={field.label}
        />
      ) : isPhone ? (
        <PhoneInput
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={field.placeholder}
          className={inputCls}
          aria-label={field.label}
        />
      ) : (
        <input
          type={inputType}
          inputMode={field.type === "number" ? "numeric" : undefined}
          min={field.type === "number" ? 0 : undefined}
          value={inputValue}
          placeholder={field.placeholder}
          aria-label={field.label}
          onChange={(e) => onChange(e.target.value)}
          data-field={field.key}
          className={inputCls}
          style={
            field.type === "number"
              ? { fontVariantNumeric: "tabular-nums" }
              : undefined
          }
        />
      )}
    </div>
  );
}
