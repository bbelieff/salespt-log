"use client";
/**
 * 주간 보드 제목 칸 — 위: 「11월 2주」 + 날짜·수강 주차 / 가운데: 「‹ 이번 주 ›」 · 「금~목 | 월~일」 / 아래: 미팅·실무·일반 필터.
 * 조작 세 줄은 같은 「트레이」 모양(높이 34, 안쪽 버튼 28) — 2026-11-11 belie 「버튼 높이도 서로 안 맞고」.
 */
import type { CSSProperties } from "react";
import type { DayOrder } from "../../_lib/board";
import { LAYER_DOT, LAYER_LABEL, type LayerKey, type Layers } from "./board-style";

const TRAY = "flex h-[34px] items-center gap-0.5 rounded-[11px] bg-slate-900/[0.06] p-[3px] shadow-[inset_0_1px_2px_rgb(15_23_42/0.09)]";
const BTN = "flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-900";
const ON = "aria-pressed:bg-white aria-pressed:font-extrabold aria-pressed:text-slate-900 aria-pressed:shadow-sm";
const chev = (d: string) => <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function BoardTitle({ title, range, course, order, layers, onPrev, onNext, onToday, onOrder, onLayer, className = "", style }: {
  title: string; range: string; course: string; order: DayOrder; layers: Layers;
  onPrev: () => void; onNext: () => void; onToday: () => void; onOrder: (o: DayOrder) => void; onLayer: (k: LayerKey) => void; className?: string; style?: CSSProperties;
}) {
  return (
    <nav aria-label="주차 이동" style={style} className={`wb-title flex flex-col justify-between gap-1 px-3.5 py-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-4xl font-black leading-none tracking-[-0.04em] text-slate-900 tabular-nums">{title}</h1>
        <p className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-px-13 font-semibold tabular-nums text-slate-600">{range}</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{course}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div role="group" aria-label="주 이동" className={`${TRAY} flex-[1.25]`}>
          <button type="button" onClick={onPrev} aria-label="이전 주" className={`${BTN} w-[30px] shrink-0 px-0`}>{chev("M15 18l-6-6 6-6")}</button>
          <button type="button" onClick={onToday} className={`${BTN} flex-1`}>이번 주</button>
          <button type="button" onClick={onNext} aria-label="다음 주" className={`${BTN} w-[30px] shrink-0 px-0`}>{chev("M9 18l6-6-6-6")}</button>
        </div>
        <div role="group" aria-label="요일 순서" className={`${TRAY} flex-1`}>
          {(["fri", "mon"] as const).map((o) => (
            <button key={o} type="button" aria-pressed={order === o} onClick={() => onOrder(o)} title={o === "fri" ? "수강 주차와 같은 금~목" : "달력과 같은 월~일"} className={`${BTN} ${ON} flex-1`}>{o === "fri" ? "금~목" : "월~일"}</button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="보이는 일정 종류 (여러 개 선택)" className={TRAY}>
        {(Object.keys(LAYER_LABEL) as LayerKey[]).map((k) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => onLayer(k)} className={`${BTN} ${ON} flex-1 ${layers[k] ? "" : "text-slate-400"}`}>
            <i className={`h-2 w-2 rounded-full ${LAYER_DOT[k]} ${layers[k] ? "" : "opacity-35"}`} />{LAYER_LABEL[k]}
          </button>
        ))}
      </div>
    </nav>
  );
}
