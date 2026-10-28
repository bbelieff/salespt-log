"use client";
/**
 * 휴지통 표 — 행을 누르면 고르기(체크박스와 같음), 맨 위 체크로 보이는 줄 전체.
 * 되살릴 수 없는 줄은 흐리게 + 이유, 고를 수 없다. 휴대폰은 「내용」 칸을 이름 아래로 접는다.
 */
import type { TrashItem, TrashKind } from "@/service/trash";

const KIND: Record<TrashKind, { label: string; cls: string }> = {
  todo: { label: "할 일", cls: "bg-blue-50 text-blue-700" },
  meeting: { label: "미팅", cls: "bg-violet-50 text-violet-700" },
  lead: { label: "DB", cls: "bg-emerald-50 text-emerald-700" },
};

const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
};

export default function TrashTable({ items, picked, canRestore, onToggle, onToggleAll, keyOf }: {
  items: TrashItem[];
  picked: Set<string>;
  canRestore: boolean;
  onToggle: (key: string) => void;
  onToggleAll: (keys: string[], on: boolean) => void;
  keyOf: (i: TrashItem) => string;
}) {
  const selectable = items.filter((i) => !i.blocked).map(keyOf);
  const allOn = selectable.length > 0 && selectable.every((k) => picked.has(k));
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            {canRestore && <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="보이는 줄 모두 고르기" checked={allOn} disabled={!selectable.length} onChange={(e) => onToggleAll(selectable, e.target.checked)} className="h-4 w-4 accent-blue-600" /></th>}
            <th className="w-16 px-2 py-2 font-medium">종류</th>
            <th className="px-2 py-2 font-medium">이름</th>
            <th className="hidden px-2 py-2 font-medium pc:table-cell">내용</th>
            <th className="w-24 px-3 py-2 text-right font-medium">지운 때</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i) => {
            const key = keyOf(i);
            const on = picked.has(key);
            const can = canRestore && !i.blocked;
            return (
              <tr key={key} data-trash-row aria-selected={on} onClick={() => can && onToggle(key)}
                className={`transition-colors ${can ? "cursor-pointer hover:bg-blue-50/60 active:bg-blue-100/70" : ""} ${on ? "bg-blue-50" : ""} ${i.blocked ? "text-slate-400" : "text-slate-800"}`}>
                {canRestore && <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`${i.name} 고르기`} checked={on} disabled={!can} onChange={() => onToggle(key)} className="h-4 w-4 accent-blue-600" /></td>}
                <td className="px-2 py-2.5"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${KIND[i.kind].cls}`}>{KIND[i.kind].label}</span></td>
                <td className="min-w-0 px-2 py-2.5">
                  <p className="truncate font-semibold" title={i.name}>{i.name}</p>
                  <p className="truncate text-xs text-slate-500 pc:hidden" title={i.detail}>{i.detail}</p>
                  {i.blocked && <p className="text-xs text-amber-700">{i.blocked}</p>}
                </td>
                <td className="hidden truncate px-2 py-2.5 text-xs text-slate-500 pc:table-cell" title={i.detail}>{i.detail}</td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-500">{when(i.deletedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
