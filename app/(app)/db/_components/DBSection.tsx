/**
 * DBSection — 4채널 모두에 쓰는 generic 표 컴포넌트.
 * 컬럼 정의(FieldDef)와 row 데이터를 받아 list + add + edit/delete inline.
 *
 * 시안: docs/design/prototypes/* (DB관리 prototype 별도 없음 — minimal table UI)
 */
"use client";

import { useState } from "react";

export type FieldType = "date" | "text" | "number" | "select";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** select 인 경우 옵션. */
  options?: readonly string[];
  /** 시트 수식이 자동 채우는 컬럼 — 표시만, 입력 X. */
  computed?: boolean;
  /** 단위 라벨 (예: "원", "건"). */
  unit?: string;
}

export type RowData = Record<string, string | number | undefined> & {
  row: number;
};

interface Props {
  fields: readonly FieldDef[];
  rows: RowData[];
  pendingRow: number | null; // 진행중인 row 표시
  onAdd: (data: Record<string, string | number>) => void;
  onPatch: (row: number, data: Record<string, string | number>) => void;
  onRemove: (row: number) => void;
  /** 해당 채널의 합계 정보 표시용 (선택). */
  summary?: React.ReactNode;
  emptyHint?: string;
}

function blankDraft(fields: readonly FieldDef[]): Record<string, string> {
  const d: Record<string, string> = {};
  for (const f of fields) if (!f.computed) d[f.key] = "";
  return d;
}

function fmtCell(v: string | number | undefined, f: FieldDef): string {
  if (v === undefined || v === "" || v === 0) {
    if (f.type === "number" && v === 0) return "0";
    if (v === undefined || v === "") return "—";
  }
  if (f.type === "number") {
    return Number(v).toLocaleString("ko-KR");
  }
  return String(v);
}

export default function DBSection({
  fields,
  rows,
  pendingRow,
  onAdd,
  onPatch,
  onRemove,
  summary,
  emptyHint = "데이터 없음",
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(
    blankDraft(fields),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});

  const handleAdd = () => {
    const out: Record<string, string | number> = {};
    for (const f of fields) {
      if (f.computed) continue;
      const v = draft[f.key] ?? "";
      out[f.key] = f.type === "number" ? Number(v) || 0 : v;
    }
    onAdd(out);
    setDraft(blankDraft(fields));
  };

  const startEdit = (r: RowData) => {
    setEditing(r.row);
    const d: Record<string, string> = {};
    for (const f of fields) {
      if (f.computed) continue;
      const v = r[f.key];
      d[f.key] = v === undefined ? "" : String(v);
    }
    setEditDraft(d);
  };

  const handlePatch = () => {
    if (editing === null) return;
    const out: Record<string, string | number> = {};
    for (const f of fields) {
      if (f.computed) continue;
      const v = editDraft[f.key] ?? "";
      out[f.key] = f.type === "number" ? Number(v) || 0 : v;
    }
    onPatch(editing, out);
    setEditing(null);
  };

  return (
    <section className="space-y-3">
      {summary && <div>{summary}</div>}

      {/* 신규 행 입력 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
        <div className="mb-2 text-xs font-bold text-blue-800">+ 새 행 추가</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fields.map((f) =>
            f.computed ? null : (
              <FieldInput
                key={f.key}
                field={f}
                value={draft[f.key] ?? ""}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, [f.key]: v }))
                }
              />
            ),
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={pendingRow !== null}
          className="mt-2 w-full rounded-lg bg-blue-500 py-2 text-sm font-bold text-white transition-all hover:bg-blue-600 disabled:bg-gray-300"
        >
          {pendingRow === -1 ? "추가중..." : "✓ 추가"}
        </button>
      </div>

      {/* 행 리스트 */}
      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const isEditing = editing === r.row;
            const isPending = pendingRow === r.row;
            return (
              <li
                key={r.row}
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {fields.map((f) =>
                        f.computed ? null : (
                          <FieldInput
                            key={f.key}
                            field={f}
                            value={editDraft[f.key] ?? ""}
                            onChange={(v) =>
                              setEditDraft((d) => ({ ...d, [f.key]: v }))
                            }
                          />
                        ),
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handlePatch}
                        disabled={isPending}
                        className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:bg-gray-300"
                      >
                        {isPending ? "저장중..." : "💾 저장"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
                    {fields.map((f) => (
                      <div key={f.key} className="min-w-0">
                        <div className="text-[10px] font-medium text-gray-400">
                          {f.label}
                        </div>
                        <div
                          className={`truncate text-sm ${f.computed ? "font-bold text-green-700" : "text-gray-800"}`}
                          title={String(r[f.key] ?? "")}
                        >
                          {fmtCell(r[f.key], f)}
                          {f.unit && r[f.key] !== undefined && r[f.key] !== "" && (
                            <span className="ml-0.5 text-xs text-gray-500">
                              {f.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="col-span-2 mt-1 flex gap-2 sm:col-span-3">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        ✏️ 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("이 행을 비울까요? (시트의 합계 행은 유지됩니다)"))
                            onRemove(r.row);
                        }}
                        disabled={isPending}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        🗑 삭제
                      </button>
                      <span className="ml-auto text-[10px] text-gray-400">
                        시트 row {r.row}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <div>
        <label className="mb-1 block text-[11px] text-gray-500">
          {field.label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">선택…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      <label className="mb-1 block text-[11px] text-gray-500">
        {field.label}
        {field.unit && (
          <span className="ml-1 text-gray-400">({field.unit})</span>
        )}
      </label>
      <input
        type={
          field.type === "date"
            ? "date"
            : field.type === "number"
              ? "number"
              : "text"
        }
        inputMode={field.type === "number" ? "numeric" : undefined}
        min={field.type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
