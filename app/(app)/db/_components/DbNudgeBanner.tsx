/**
 * DbNudgeBanner — 미기록 넛지 (C5). 직접생산이 "생산중인데 종료일이 지난 미완"이거나
 * 완료인데 비용(기간예산) 0 인 행을 감지해 입력을 유도. 클라 빈도제어(오늘 닫으면 숨김).
 * 데이터: useDBOverview (직접생산). 의존: C1(시작/종료·생산개수 모델).
 */
"use client";

import { useEffect, useState } from "react";
import { useDBOverview } from "@/query/db-hooks";

const DISMISS_KEY = "db-nudge-dismissed-on";
const num = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0) || 0;
const str = (r: Record<string, unknown>, k: string) => String(r[k] ?? "");

interface Props {
  /** 직접생산 탭으로 전환 (배너 CTA). */
  onGoDirect: () => void;
}

export default function DbNudgeBanner({ onGoDirect }: Props) {
  const overview = useDBOverview();
  const [dismissed, setDismissed] = useState(true); // SSR 기본 숨김 → mount 후 판정

  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === today);
    } catch {
      setDismissed(false);
    }
  }, [today]);

  const prods = overview.data?.productions ?? [];
  // 생산중(생산개수 0)인데 종료일이 오늘보다 이전 = 완료 입력 누락
  const overdue = prods.filter(
    (p) => num(p as never, "생산개수") === 0 && str(p as never, "종료일") && str(p as never, "종료일") < today,
  ).length;
  // 완료인데 비용(기간예산) 0 = 비용 미입력
  const noCost = prods.filter(
    (p) => num(p as never, "생산개수") > 0 && num(p as never, "기간예산") === 0,
  ).length;

  if (dismissed || (overdue === 0 && noCost === 0)) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, today);
    } catch {
      /* ignore */
    }
  };

  const msg =
    overdue > 0
      ? `생산기간이 끝난 직접생산 ${overdue}건이 미완료예요. 생산 수량을 입력해 완료하세요.`
      : `직접생산 ${noCost}건에 비용(기간예산)이 비어 있어요. 비용을 입력해 주세요.`;

  return (
    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
      <span className="shrink-0 text-base">⏰</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-amber-800">{msg}</p>
        <button
          type="button"
          onClick={onGoDirect}
          className="mt-1 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
        >
          직접생산 보기
        </button>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="오늘 그만 보기"
        className="shrink-0 text-amber-400 hover:text-amber-700"
      >
        ✕
      </button>
    </div>
  );
}
