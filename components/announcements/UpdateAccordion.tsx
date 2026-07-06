/**
 * UpdateAccordion — "새로워졌어요 ✨" 묶음 리스트 (announcement-popup §7-4).
 *
 * 입력 = updates 행(UpdateItem[]) → groupUpdates 로 항목(그룹=1)화.
 * 접힘: 고객용 제목 + 메타줄(그룹 "개발 M/D~M/D · 적용 M/D" / 단건 "적용 M/D").
 * 펼침: "339·340·…번째 업데이트" → [전]/[후] 뱃지+문단(§7-2 포맷),
 *       전/후 키 없으면 일반 MD(MarkdownView — 이미지·sanitize 동일).
 */
"use client";

import { useState } from "react";
import type { UpdateItem } from "@/types";
import {
  groupUpdates,
  groupMetaLine,
  groupOrdinalLine,
  parseBeforeAfter,
  type UpdateGroup,
} from "@/service/update-groups";
import MarkdownView from "./MarkdownView";

function GroupBody({ g }: { g: UpdateGroup }) {
  const ba = parseBeforeAfter(g.bodyMd);
  return (
    <div className="space-y-2 px-1 pb-3">
      <p className="text-xs font-bold text-gray-400">{groupOrdinalLine(g)}</p>
      {ba ? (
        <>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
              전
            </span>
            <p className="text-xs leading-snug text-gray-600">{ba.before}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-brand-red">
              후
            </span>
            <p className="text-xs font-medium leading-snug text-gray-800">{ba.after}</p>
          </div>
        </>
      ) : g.bodyMd.trim() ? (
        <MarkdownView markdown={g.bodyMd} />
      ) : null}
      {/* 그룹 내 개별 변경 — 보조(작게). 단건은 표시 안 함 (§7-4). */}
      {g.lines.length > 0 && (
        <ul className="space-y-0.5 border-t border-gray-50 pt-2">
          {g.lines.map((l) => (
            <li key={l.pr} className="flex items-start gap-1.5 text-xs text-gray-400">
              <span className="shrink-0">·</span>
              <span className="min-w-0">{l.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function UpdateAccordion({ updates }: { updates: UpdateItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = groupUpdates(updates);

  if (groups.length === 0) {
    return <p className="py-2 text-xs text-gray-400">아직 업데이트 소식이 없어요.</p>;
  }

  return (
    // 모든 항목 동일한 카드 형태로 평면 나열 — 단건이 그룹에 종속돼 보이지 않게 (§7-4).
    <ul className="space-y-2">
      {groups.map((g) => {
        const expanded = open === g.key;
        return (
          <li
            key={g.key}
            // feat 포함 항목은 "새 기능" 강조 테두리 (new-feature-highlight §0). fix/perf 는 기본.
            className={`rounded-xl border bg-white px-2 ${
              g.hasFeat ? "border-red-200" : "border-gray-100"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : g.key)}
              className="flex w-full items-start gap-2 px-1 py-2.5 text-left"
              aria-expanded={expanded}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-800">
                  {g.hasFeat && (
                    <span className="mr-1 inline-block shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 align-middle text-xs font-bold text-brand-red">
                      새 기능
                    </span>
                  )}
                  {g.title}
                </span>
                <span className="mt-0.5 block text-xs text-gray-400">{groupMetaLine(g)}</span>
              </span>
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
            </button>
            {expanded && <GroupBody g={g} />}
          </li>
        );
      })}
    </ul>
  );
}
