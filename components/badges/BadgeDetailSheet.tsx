"use client";
/** 배지 하나 크게 보기 — 모바일은 아래에서 올라오는 시트, 태블릿 이상은 가운데 창. Esc·바깥 누르기로 닫힘. */
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef } from "react";
import type { BadgeDef } from "@/lib/analytics/badge-catalog";
import type { BadgeState } from "@/lib/analytics/badges";
import BadgeMedal from "./BadgeMedal";

export function badgeDateLabel(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : "";
}

export default function BadgeDetailSheet({ def, state, onClose }: { def: BadgeDef; state: BadgeState; onClose: () => void }) {
  const firstButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    firstButton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); back?.focus?.(); };
  }, [onClose]);

  const hidden = def.group === "secret" && !state.earned;
  const p = state.progress;
  let body: React.ReactNode;
  if (state.earned) {
    body = <>
      <p className="max-w-xs text-sm text-gray-600">{def.how}</p>
      <p className="text-sm font-bold text-emerald-700">{state.earnedOn ? `${badgeDateLabel(state.earnedOn)}에 얻었어요` : "얻었어요"}</p>
    </>;
  } else if (hidden) {
    // 숨은 배지는 준비 중이어도 조건을 보이지 않는다.
    body = <p className="max-w-xs text-sm text-gray-600">어떻게 얻는지는 비밀이에요. 평소처럼 기록하다 보면 깜짝 열려요.</p>;
  } else if (!def.ready) {
    body = <>
      <p className="max-w-xs text-sm text-gray-600">{def.how}</p>
      <p className="text-sm text-gray-500">곧 얻을 수 있게 열어 드릴게요.</p>
    </>;
  } else {
    body = <>
      <p className="max-w-xs text-sm text-gray-600">{def.how}</p>
      {p && <>
        <div className="badge-meter badge-meter--next mt-1 w-2/3" aria-hidden="true"><i style={{ width: `${Math.round((p.cur / p.max) * 100)}%` }} /></div>
        <p className="text-sm text-gray-700"><b>{p.max - p.cur}{p.unit}</b> 남았어요 ({p.cur} / {p.max}{p.unit})</p>
      </>}
    </>;
  }
  const cta = !state.earned && def.ready && !hidden ? def.cta : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 2xl:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="badge-sheet-title" onClick={e => e.stopPropagation()}
        className="badge-sheet flex w-full flex-col items-center gap-1.5 rounded-t-2xl bg-white px-5 pb-8 pt-6 text-center 2xl:w-96 2xl:rounded-2xl 2xl:pb-5">
        <BadgeMedal img={def.img} tier={def.tier} locked={!state.earned} hidden={hidden} size="lg" />
        <h2 id="badge-sheet-title" className="text-lg font-black text-gray-900">{hidden ? "???" : def.name}</h2>
        {body}
        <div className="mt-3 flex w-full gap-2">
          <button ref={firstButton} type="button" onClick={onClose}
            className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${cta ? "border border-gray-200 bg-white text-gray-700" : "bg-gray-900 text-white"}`}>
            {state.earned ? "확인" : "닫기"}
          </button>
          {cta && (
            <Link href={cta.href as Route} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">
              {cta.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
