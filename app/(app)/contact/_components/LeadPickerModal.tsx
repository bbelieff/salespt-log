/**
 * LeadPickerModal — 컨택탭 콜·지·기·소 미팅 슬롯 [발굴에서 가져오기] 피커 (lead-chain §2-1, PR-3).
 *
 * 목록 소스 = `useLeadCandidates()`(`/api/leads` = listLeadCandidates, 파일럿=DB·비파일럿=시트 게이트).
 * 각 후보에 `matched`(전환 여부) 파생 포함 → **이미 미팅으로 전환된 발굴은 숨긴다**(`!matched`, KPI-④).
 * 미매칭은 접수일이 지나도 계속 후보(이월, lead-chain §4-1). 접수일 내림차순, 검색. 선택 시 부모가 mergeLeadDraft 프리필.
 */
"use client";

import { useMemo, useState } from "react";
import type { DBLead } from "@/types";
import { useLeadCandidates } from "@/query/db-hooks";

interface Props {
  onPick: (lead: DBLead) => void;
  onClose: () => void;
}

/** 업체명이 비면 대표자명으로 대체(isLeadMeaningful 규칙과 일치). */
function leadTitle(l: DBLead): string {
  return (l.업체명 || "").trim() || (l.대표자명 || "").trim() || "(이름 없음)";
}

export default function LeadPickerModal({ onPick, onClose }: Props) {
  const candidates = useLeadCandidates();
  const [q, setQ] = useState("");

  const leads = useMemo(() => {
    // 전환된 발굴(matched) 숨김 → 미매칭만 후보(이월). 접수일 내림차순.
    const all = (candidates.data ?? [])
      .filter((l) => !l.matched)
      .sort((a, b) => (b.접수일 || "").localeCompare(a.접수일 || ""));
    const kw = q.trim().toLowerCase();
    const filtered = kw
      ? all.filter((l) =>
          [l.업체명, l.대표자명, l.연락처, l.소개처, l.조건, l.구분]
            .some((v) => (v || "").toLowerCase().includes(kw)),
        )
      : all.slice(0, 20); // 검색 없으면 최근 20건
    return filtered;
  }, [candidates.data, q]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <h3 className="text-sm font-black text-gray-900">
            발굴에서 가져오기
            <span className="ml-1 font-normal text-gray-400">(콜·지·기·소)</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            ✕ 닫기
          </button>
        </div>
        <p className="px-4 pt-1 text-[11px] text-gray-500">
          선택하면 업체명·업체정보·비고가 자동으로 채워져요. 직접 입력한 값은 덮지 않아요.
        </p>
        <div className="px-4 pt-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="업체명·대표자명·연락처 검색"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          {candidates.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">발굴 목록 불러오는 중…</p>
          ) : leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {q.trim() ? "검색 결과가 없어요" : "아직 가져올 발굴이 없어요"}
            </p>
          ) : (
            leads.map((l, i) => (
              <button
                key={`${l.row ?? i}-${l.발굴id ?? ""}`}
                type="button"
                onClick={() => onPick(l)}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-purple-300 hover:bg-purple-50"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                  {leadTitle(l)}
                  {l.업체명 && l.대표자명 ? (
                    <span className="ml-1 font-normal text-gray-400">· {l.대표자명}</span>
                  ) : null}
                </span>
                {l.구분 ? (
                  <span className="shrink-0 rounded bg-purple-100 px-1.5 py-px text-[11px] font-medium text-purple-700">
                    {l.구분}
                  </span>
                ) : null}
                <span className="shrink-0 text-xs text-gray-400">{l.접수일 || ""}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
