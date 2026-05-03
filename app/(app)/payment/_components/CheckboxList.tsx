/**
 * CheckboxList — 7 체크박스 그리드 (서류 6 + 플러그이관 1).
 * 시트 매핑: 02 계약수납관리!F~L
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

const ITEMS: Array<{ key: CheckKey; label: string; emoji: string }> = [
  { key: "공동인증서", label: "공동인증서", emoji: "🔐" },
  { key: "임대차계약서", label: "임대차계약서", emoji: "📄" },
  { key: "신분증", label: "신분증", emoji: "🪪" },
  { key: "드라이브업로드", label: "드라이브 업로드", emoji: "☁️" },
  { key: "사업계획서초안발송", label: "사업계획서 초안발송", emoji: "📊" },
  { key: "컨설팅5종서류발송", label: "컨설팅 5종 서류발송", emoji: "📋" },
  { key: "플러그이관", label: "플러그 이관", emoji: "🔌" },
];

interface Props {
  draft: Pick<ContractPayment, CheckKey>;
  onChange: (key: CheckKey, next: boolean) => void;
}

export default function CheckboxList({ draft, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ITEMS.map((it) => {
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
      })}
    </div>
  );
}

export function checkedCount(
  cp: Pick<ContractPayment, CheckKey>,
): number {
  return ITEMS.reduce((n, it) => (cp[it.key] ? n + 1 : n), 0);
}

export const TOTAL_CHECKBOXES = ITEMS.length;
