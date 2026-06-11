/**
 * UpdateAccordion — "새로워졌어요 ✨" 업데이트 리스트 (announcement-popup §3).
 *
 * 닫힘 = 날짜 + title_user 한 줄. 펼침 = body_md (MD 렌더).
 * body_md 가 빈 항목은 펼칠 게 없으므로 정적 행 (chevron 없음).
 * milestone 라벨이 직전 항목과 달라지는 지점에 그룹 헤더 삽입.
 */
"use client";

import { useState } from "react";
import type { UpdateItem } from "@/types";
import MarkdownView from "./MarkdownView";

export default function UpdateAccordion({ updates }: { updates: UpdateItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (updates.length === 0) {
    return <p className="py-2 text-xs text-gray-400">아직 업데이트 소식이 없어요.</p>;
  }

  return (
    <ul className="divide-y divide-gray-50">
      {updates.map((u, i) => {
        const showMilestone =
          !!u.milestone && u.milestone !== (updates[i - 1]?.milestone ?? "");
        const expandable = u.bodyMd.trim() !== "";
        const expanded = open === u.pr;
        return (
          <li key={u.pr}>
            {showMilestone && (
              <div className="bg-red-50 px-1 py-1.5 text-xs font-black text-brand-red">
                {u.milestone}
              </div>
            )}
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpen(expanded ? null : u.pr)}
              className="flex w-full items-start gap-2 px-1 py-2.5 text-left"
              aria-expanded={expandable ? expanded : undefined}
            >
              <span className="mt-0.5 shrink-0 text-xs text-gray-400">{u.date}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800">
                {u.titleUser}
              </span>
              {expandable && (
                <svg
                  className={`mt-1 h-3 w-3 shrink-0 text-gray-400 transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {expandable && expanded && (
              <div className="px-1 pb-3 pl-7">
                <MarkdownView markdown={u.bodyMd} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
