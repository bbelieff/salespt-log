/**
 * CheckboxList — 7 체크박스 그리드 (수집 3 + 진행 4).
 * 시트 매핑: 02 계약수납관리!F~L
 *
 * 2026-05-19 사용자 디자인 변경:
 *  - 헤더 "서류 진행" → "실무 진행"
 *  - 수집: 공동인증서 · 임대차계약서 · 신분증
 *  - 진행: 드라이브업로드 · 컨설팅5종서류 · 사업계획서초안 · 플러그이관
 */
"use client";

import type { ContractPayment } from "@/types";

type CheckKey =
  | "공동인증서"
  | "임대차계약서"
  | "신분증"
  | "드라이브업로드"
  | "사업계획서초안발송"
  | "컨설팅5종서류발송"
  | "플러그이관";

interface Item {
  key: CheckKey;
  label: string;
  emoji: string;
}

const COLLECT: Item[] = [
  { key: "공동인증서", label: "공동인증서", emoji: "🔐" },
  { key: "임대차계약서", label: "임대차계약서", emoji: "📄" },
  { key: "신분증", label: "신분증", emoji: "🪪" },
];

const PROGRESS: Item[] = [
  { key: "드라이브업로드", label: "드라이브 업로드", emoji: "☁️" },
  { key: "컨설팅5종서류발송", label: "컨설팅 5종 서류", emoji: "📋" },
  { key: "사업계획서초안발송", label: "사업계획서 초안", emoji: "📊" },
  { key: "플러그이관", label: "플러그 이관", emoji: "🔌" },
];

const ALL_ITEMS: Item[] = [...COLLECT, ...PROGRESS];

interface Props {
  draft: Pick<ContractPayment, CheckKey>;
  onChange: (key: CheckKey, next: boolean) => void;
}

function renderItem(
  it: Item,
  draft: Pick<ContractPayment, CheckKey>,
  onChange: (key: CheckKey, next: boolean) => void,
) {
  const checked = draft[it.key];
  return (
    <label
      key={it.key}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
        checked
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(it.key, e.target.checked)}
        className="h-4 w-4 shrink-0 accent-blue-500"
      />
      <span className="shrink-0 text-base leading-none">{it.emoji}</span>
      <span
        className={`flex-1 truncate text-xs ${
          checked ? "font-semibold text-blue-800" : "text-gray-700"
        }`}
      >
        {it.label}
      </span>
    </label>
  );
}

export default function CheckboxList({ draft, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          수집
        </div>
        <div className="grid grid-cols-2 gap-2">
          {COLLECT.map((it) => renderItem(it, draft, onChange))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          진행
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PROGRESS.map((it) => renderItem(it, draft, onChange))}
        </div>
      </div>
    </div>
  );
}

export function checkedCount(cp: Pick<ContractPayment, CheckKey>): number {
  return ALL_ITEMS.reduce((n, it) => (cp[it.key] ? n + 1 : n), 0);
}

export const TOTAL_CHECKBOXES = ALL_ITEMS.length;
