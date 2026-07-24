"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ExpenseCategory } from "@/types";

interface Props {
  categories: ExpenseCategory[];
  value: string;
  busy: boolean;
  loading: boolean;
  loaded: boolean;
  errorMessage: string | null;
  retrying: boolean;
  onRetry: () => void;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<ExpenseCategory>;
  onRename: (id: string, name: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onMessage: (message: string) => void;
}

const controlClass = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 focus:border-blue-500 focus:outline-none";

export default function ExpenseCategoryPicker({ categories, value, busy, loading, loaded, errorMessage, retrying, onRetry, onChange, onCreate, onRename, onArchive, onMessage }: Props) {
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const activeCategories = useMemo(() => categories.filter((category) => !category.archivedAt), [categories]);
  const selected = activeCategories.find((category) => category.id === value);
  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
  const filtered = activeCategories.filter((category) => category.name.normalize("NFKC").toLocaleLowerCase("ko-KR").includes(normalizedQuery));

  useEffect(() => setRenameName(selected?.name ?? ""), [selected?.name]);
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  async function createCategory() {
    const name = createName.trim();
    if (!name) return;
    try {
      const category = await onCreate(name);
      onChange(category.id);
      setCreateName("");
      setOpen(false);
    } catch {
      // Parent mutation handler owns the user-facing error message.
    }
  }

  async function renameCategory() {
    const name = renameName.trim();
    if (!selected || !name || name === selected.name) return;
    try {
      await onRename(selected.id, name);
    } catch {
      // Parent mutation handler owns the user-facing error message.
    }
  }

  async function archiveCategory() {
    if (!selected) return;
    try {
      await onArchive(selected.id);
    } catch {
      // Parent mutation handler owns the user-facing error message.
    }
  }

  if (loading || (!loaded && !errorMessage)) {
    return <div role="status" className="rounded-lg border border-gray-200 bg-slate-50 p-3 text-xs font-semibold text-gray-600">카테고리를 불러오고 있습니다.</div>;
  }

  if (errorMessage) {
    return (
      <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">
        <p className="font-semibold">{errorMessage}</p>
        <button type="button" disabled={retrying} onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-red-200 bg-white px-4 font-bold disabled:opacity-50">{retrying ? "다시 불러오는 중…" : "다시 시도"}</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="비용 카테고리"
        onClick={() => setOpen((value) => !value)}
        className={`${controlClass} flex items-center justify-between gap-3 font-semibold`}
      >
        <span className={selected ? "" : "text-gray-400"}>{selected?.name ?? (categories.length === 0 ? "첫 카테고리를 추가하세요" : "카테고리를 선택하세요")}</span>
        <span aria-hidden="true" className="text-gray-400">⌄</span>
      </button>
      {categories.length === 0 && <p className="mt-2 text-xs text-gray-500">등록된 카테고리가 없습니다. 목록을 열어 새 카테고리를 추가해 주세요.</p>}

      {open && (
        <div
          className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <label className="block text-xs font-semibold text-gray-600">
            카테고리 검색
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" placeholder="이름 검색" />
          </label>
          <div id={listId} role="listbox" aria-label="카테고리 선택" className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? <p className="px-2 py-3 text-xs text-gray-400">일치하는 카테고리가 없습니다.</p> : filtered.map((category) => (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={category.id === value}
                onClick={() => { onChange(category.id); setOpen(false); }}
                className={`min-h-11 w-full rounded-lg px-3 text-left text-sm ${category.id === value ? "bg-blue-50 font-bold text-blue-700" : "hover:bg-slate-50"}`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-700">새 카테고리</p>
            <div className="mt-1 flex gap-2">
              <input aria-label="새 카테고리 이름" value={createName} onChange={(event) => setCreateName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm" maxLength={40} placeholder="예: 임차료" />
              <button type="button" disabled={busy || !createName.trim()} onClick={() => void createCategory()} className="min-h-11 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700 disabled:opacity-40">추가</button>
            </div>
          </div>

          {selected && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-700">선택 카테고리 관리</p>
              <div className="mt-1 flex gap-2">
                <input aria-label="선택 카테고리 이름 수정" value={renameName} onChange={(event) => setRenameName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm" maxLength={40} />
                <button type="button" disabled={busy || !renameName.trim() || renameName.trim() === selected.name} onClick={() => void renameCategory()} className="min-h-11 rounded-lg border border-gray-200 px-3 text-xs font-bold disabled:opacity-40">이름 수정</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => void archiveCategory()} className="min-h-11 rounded-lg border border-gray-200 text-xs font-bold">보관</button>
                <button type="button" onClick={() => onMessage(`“${selected.name}” 카테고리는 사용 이력 보호를 위해 삭제할 수 없습니다. 대신 보관해 주세요.`)} className="min-h-11 rounded-lg border border-red-100 text-xs font-bold text-red-600">삭제</button>
              </div>
              <p className="mt-2 text-xs text-gray-400">사용 중인 카테고리는 삭제하지 않고 보관해 과거 비용의 분류명을 유지합니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
