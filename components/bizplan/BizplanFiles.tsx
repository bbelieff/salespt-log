"use client";
/**
 * 사업계획서 작성도구 — 자료 올리기 칸(필수 6 + 추가 자료). 파일은 이 브라우저 안에만 있고 서버로 가지 않는다.
 * 빈 필수 칸은 점선 테두리로 보인다. 빌더(7번째 필수)는 공식 판을 자동으로 넣으므로 줄만 보여 준다.
 */
import { useId, useRef } from "react";
import { FileUp, X, BookOpen } from "lucide-react";
import { BIZPLAN_SLOTS, type BizplanSlotKey } from "@/util/bizplan-pack";
import type { KitInfo, SlotFiles } from "./pack-client";

const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

function Slot({ slot, files, onAdd, onRemove }: {
  slot: (typeof BIZPLAN_SLOTS)[number];
  files: File[];
  onAdd: (key: BizplanSlotKey, list: File[]) => void;
  onRemove: (key: BizplanSlotKey, index: number) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const empty = files.length === 0;
  return (
    <li className={`rounded-lg border px-3 py-2.5 ${empty && slot.required ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {slot.label}
            {!slot.required && <span className="ml-1.5 text-xs font-normal text-slate-500">선택</span>}
          </p>
          <p className="text-xs text-slate-500">{empty ? slot.hint : `${files.length}개 · ${mb(files.reduce((a, f) => a + f.size, 0))}`}</p>
        </div>
        <input
          id={id}
          ref={input}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            if (list.length) onAdd(slot.key, list);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          {empty ? "올리기" : "더 올리기"}
        </button>
      </div>
      {!empty && (
        <ul className="mt-2 flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-700">
              <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{mb(f.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(slot.key, i)}
                aria-label={`${f.name} 빼기`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-red-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function BizplanFiles({ files, kit, onAdd, onRemove }: {
  files: SlotFiles;
  kit: KitInfo | null;
  onAdd: (key: BizplanSlotKey, list: File[]) => void;
  onRemove: (key: BizplanSlotKey, index: number) => void;
}) {
  return (
    <section aria-labelledby="bizplan-files-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="bizplan-files-title" className="text-base font-bold text-slate-900">1. 자료 올리기 <span className="text-sm font-semibold text-slate-500">(선택)</span></h2>
      <p className="mt-1 text-sm text-slate-600">안 올려도 돼요. 서류는 나중에 클로드 대화창에 직접 넣으면 돼요. 여기 올리면 숫자를 자동으로 읽어 팩트시트를 채워 드리고, 꾸러미에도 함께 담아 드려요.</p>
      <p className="mt-0.5 text-xs text-slate-500">올린 파일은 이 화면 안에서만 쓰고 경영일지 서버에 저장하지 않아요.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {BIZPLAN_SLOTS.map((s) => (
          <Slot key={s.key} slot={s} files={files[s.key]} onAdd={onAdd} onRemove={onRemove} />
        ))}
        <li className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${kit?.builder ? "border-slate-200 bg-white" : "border-dashed border-amber-300 bg-amber-50"}`}>
          <BookOpen className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">사업계획서 빌더</p>
            <p className="truncate text-xs text-slate-500">
              {kit === null ? "확인하는 중…" : kit.builder ? `공식 v${kit.builder.version || "?"} 자동 포함 · ${kit.builder.name}` : "공식 빌더 준비 중 — 내 빌더가 있으면 추가 자료 칸에 올려 주세요"}
            </p>
          </div>
        </li>
      </ul>
    </section>
  );
}
