/**
 * CompanyInfoLayoutToggle — 업체정보 [기본보기 | 확장보기] (belie 2026-10-09).
 *
 * - 기본보기: 계약 전(컨택관리·일정계약 미팅카드)에 필요한 칸만, 컨택가이드 순서(company-info-defs 기본_*_ITEMS).
 * - 확장보기: 지금의 전체 화면(대표자·기업정보·재무) 그대로 — 실무/수납(계약 후)의 기본값.
 * useInfoLayout: 화면이 정한 기본값(defaultLayout)으로 열고, 사용자가 바꾸면 그 「화면 종류」에서만 기기에 기억한다
 * (컨택에서 확장으로 바꿔도 실무/수납의 기본값은 그대로).
 */
"use client";

import { useEffect, useState } from "react";
import type { CompanyInfo } from "@/types";
import { 기본_대표자_ITEMS, 기본_사업자_ITEMS, 기업정보_ITEMS, 대표자_ITEMS, 재무_ITEMS } from "@/components/company-info-defs";
import { hiddenFilledCount } from "./view-filter";

export type InfoLayout = "basic" | "extended";
export const LAYOUT_LABEL: Record<InfoLayout, string> = { basic: "기본보기", extended: "확장보기" };
const storeKey = (screen: InfoLayout) => `salespt:company-info-layout:${screen}`;

export function useInfoLayout(defaultLayout: InfoLayout) {
  const [layout, setLayoutState] = useState<InfoLayout>(defaultLayout);
  useEffect(() => {
    try {
      const v = localStorage.getItem(storeKey(defaultLayout));
      if (v === "basic" || v === "extended") setLayoutState(v);
    } catch {
      // 기억을 못 읽으면 화면 기본값 그대로.
    }
  }, [defaultLayout]);
  const setLayout = (l: InfoLayout) => {
    setLayoutState(l);
    try {
      localStorage.setItem(storeKey(defaultLayout), l);
    } catch {
      // 기억하지 못해도 보기는 바뀐다.
    }
  };
  return { layout, setLayout };
}

export default function CompanyInfoLayoutToggle({ layout, onChange }: { layout: InfoLayout; onChange: (l: InfoLayout) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-gray-300 bg-white p-0.5" role="group" aria-label="업체정보 보기 범위">
      {(["basic", "extended"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={layout === l}
          onClick={() => onChange(l)}
          className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold ${layout === l ? "bg-slate-800 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
        >
          {LAYOUT_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/** 기본보기에서 안 보이는데 적힌 칸(+ 사용자가 추가한 필드) 수 — 있으면 「확장보기에 적힌 항목 N개」 버튼. 값은 지우지 않는다. */
export function HiddenFilledNotice({ draft, onOpen }: { draft: CompanyInfo; onOpen: () => void }) {
  const custom = (["업체", "대표자"] as const).reduce(
    (n, g) => n + Object.values(draft.커스텀?.[g] ?? {}).filter((v) => String(v).trim()).length,
    0,
  );
  const n = hiddenFilledCount([대표자_ITEMS, 기업정보_ITEMS, 재무_ITEMS], [기본_대표자_ITEMS, 기본_사업자_ITEMS], draft) + custom;
  if (n === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-slate-500 hover:text-slate-800"
    >
      ▾ 확장보기에 적힌 항목 {n}개 더 있어요 · 보기
    </button>
  );
}
