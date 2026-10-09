/**
 * CompanyInfoViewToggle — 업체정보 보기 [전체 | 적은 것 N | 안 적은 것 N] (belie 2026-10-08).
 * useInfoView: 고른 보기는 기기에 기억하고, 보일 칸은 편집기를 열 때(또는 보기를 바꿀 때)의 값으로 고정한다 —
 * 「안 적은 것」에서 방금 채운 칸이 적는 도중에 사라지지 않게.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyInfo } from "@/types";
import { VIEW_LABEL, VIEW_MODES, type ViewMode } from "./view-filter";

const STORE_KEY = "salespt:company-info-view";

function readMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return (VIEW_MODES as readonly string[]).includes(v ?? "") ? (v as ViewMode) : "all";
  } catch {
    return "all";
  }
}

export function useInfoView(draft: CompanyInfo, open: boolean, modal: boolean) {
  const [mode, setModeState] = useState<ViewMode>("all");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [snap, setSnap] = useState(draft);
  useEffect(() => setModeState(readMode()), []);
  useEffect(() => setSnap(draftRef.current), [open, modal, mode]);
  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORE_KEY, m);
    } catch {
      // 기억하지 못해도 보기는 바뀐다.
    }
  };
  return { mode, setMode, snap };
}

interface Props {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  counts: [number, number];
}

export default function CompanyInfoViewToggle({ mode, onChange, counts }: Props) {
  const countOf: Record<ViewMode, number | null> = { all: null, filled: counts[0], empty: counts[1] };
  return (
    <div className="flex w-full rounded-lg border border-gray-200 bg-white p-0.5 sm:w-auto" role="group" aria-label="업체정보 보기">
      {VIEW_MODES.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold sm:flex-none ${
            mode === m ? "bg-slate-800 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {VIEW_LABEL[m]}
          {countOf[m] !== null && <span className={`ml-1 tabular-nums ${mode === m ? "text-white/80" : "text-gray-400"}`}>{countOf[m]}</span>}
        </button>
      ))}
    </div>
  );
}
