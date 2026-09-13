"use client";
import { Plus, X } from "lucide-react";

/** One PT과제 per row. Rows are single-line by construction — the stored text column
 * joins them with newlines, so a newline inside a row would silently split it.
 */
export default function GoalTaskRows({ rows, onChange, disabled = false, label, placeholder }: {
  rows: string[]; onChange: (rows: string[]) => void; disabled?: boolean; label: string; placeholder?: string;
}) {
  const set = (i: number, value: string) => onChange(rows.map((row, j) => i === j ? value.replace(/\r\n|\r|\n/g, " ") : row));
  return <fieldset className="space-y-2" disabled={disabled}>
    <legend className="text-sm font-semibold">{label}</legend>
    {rows.map((row, i) => <div key={i} className="flex items-center gap-2">
      <span aria-hidden className="w-5 shrink-0 text-center text-xs text-gray-400 tabular-nums">{i + 1}</span>
      <input aria-label={`${label} ${i + 1}번`} type="text" maxLength={2000} value={row} placeholder={placeholder}
        onChange={e => set(i, e.target.value)}
        className="min-h-11 w-full min-w-0 rounded-xl border border-gray-300 px-3 text-sm" />
      <button type="button" aria-label={`${label} ${i + 1}번 삭제`} disabled={rows.length <= 1}
        onClick={() => onChange(rows.filter((_, j) => j !== i))}
        className="min-h-11 shrink-0 rounded-lg px-2 text-gray-400 hover:text-gray-700 disabled:opacity-30">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>)}
    <button type="button" onClick={() => onChange([...rows, ""])}
      className="flex min-h-11 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm font-semibold">
      <Plus className="h-4 w-4" aria-hidden />과제 추가
    </button>
  </fieldset>;
}
