/**
 * 헤더 칩 「공고필터 n/3」(2026-10-26 belie 승인 — 맞춤공고 1단계 보완. 같은 날 「공고매칭」→「공고필터」로 이름 변경).
 * 누르면 작은 펼침: 조건마다 ✓/– 한 줄, 빈 조건은 「채우기 →」로 그 칸까지 데려간다. 3/3이면 한 줄만.
 * Esc·바깥 누르기로 닫힌다. 값은 다시 길게 적지 않는다(핸드오프 §3).
 * 4단계(2026-10-26): 실무/수납에서 맞는 공고가 있으면(matchCount ≥ 1) 「맞는 공고 N」 — 누르면 같은 화면의 「🎯 맞는 공고」 상자를 열고 그리로 이동.
 * 그 밖의 화면(팝업 편집기 등)은 맞는 공고를 모르므로 「공고필터 n/3」 그대로.
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CompanyInfo } from "@/types";
import { employeeCount, grantProfile } from "@/lib/analytics/company-grant";

type CI = CompanyInfo;
type Line = { ok: boolean; text: string; fill?: keyof CI };

/** 조건 세 줄 — 지역·대분류·규모. 빈 조건은 채울 칸(fill)을 단다. */
export function grantReadyLines(draft: CI): Line[] {
  const p = grantProfile(draft);
  const region = p.region.시도
    ? { ok: true, text: `지역 ${p.region.시도}${p.region.시군구 ? ` ${p.region.시군구}` : ""}` }
    : { ok: false, text: String(draft.소재지 ?? "").trim() ? "지역: 소재지에서 시·도를 못 읽었어요" : "지역: 소재지 칸이 비어 있어요", fill: "소재지" as const };
  const industry = p.industry
    ? { ok: true, text: `대분류 ${p.industry}` }
    : { ok: false, text: "대분류: 업태 칸이 비어 있어요", fill: "업태" as const };
  const size = p.smallBusiness !== null
    ? { ok: true, text: `규모 ${p.smallBusiness ? "소상공인" : "소상공인 아님"}` }
    : employeeCount(draft.사대보험직원) === null
      ? { ok: false, text: "규모: 4대보험 직원 칸이 비어 있어요", fill: "사대보험직원" as const }
      : { ok: false, text: "규모: 대분류가 정해지면 판정돼요", fill: "업태" as const };
  return [region, industry, size];
}

export function GrantReadyChip({ draft, onFill, matchCount }: { draft: CI; onFill: (key: keyof CI) => void; matchCount?: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const n = grantProfile(draft).ready;
  const full = n === 3;

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => { setOpen(false); chip.current?.focus(); };
  if (matchCount && matchCount > 0) {
    const go = () => {
      const scope = chip.current?.closest("[data-payment-ci-expanded]")?.parentElement ?? document;
      const box = scope.querySelector<HTMLDetailsElement>("details[data-grant-match-box]") ?? document.querySelector<HTMLDetailsElement>("details[data-grant-match-box]");
      if (!box) return;
      box.open = true;
      box.scrollIntoView({ block: "start", behavior: "smooth" });
      box.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    };
    return (
      <button ref={chip} type="button" onClick={go} className="inline-flex min-h-6 items-center rounded-full bg-emerald-50 px-2 text-px-11 font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">
        맞는 공고 {matchCount}
      </button>
    );
  }
  return (
    <span ref={box} className="relative inline-block" onKeyDown={(e) => { if (open && e.key === "Escape") { e.stopPropagation(); close(); } }}>
      <button ref={chip} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-6 items-center rounded-full px-2 text-px-11 font-bold ring-1 ${full ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100" : "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100"}`}>
        공고필터 {n}/3{full ? " ✓" : ""}
      </button>
      {open && (
        <span id={panelId} role="dialog" aria-label="공고필터 조건" data-grant-ready-panel
          className="absolute left-0 top-full z-30 mt-1 block w-max max-w-72 rounded-lg border border-gray-200 bg-white p-2 text-left text-xs shadow-lg">
          {full ? (
            <span className="block font-semibold text-emerald-700">✓ 준비 완료 · 공고가 들어오면 맞는 공고를 보여 드려요</span>
          ) : (
            grantReadyLines(draft).map((l) => (
              <span key={l.text} className="flex items-center gap-1.5 py-0.5">
                <span aria-hidden className={`w-3 shrink-0 font-bold ${l.ok ? "text-emerald-600" : "text-gray-400"}`}>{l.ok ? "✓" : "–"}</span>
                <span className={l.ok ? "text-gray-800" : "text-gray-600"}>{l.text}</span>
                {l.fill && (
                  <button type="button" onClick={() => { setOpen(false); onFill(l.fill!); }}
                    className="ml-auto shrink-0 rounded px-1 font-semibold text-brand-red hover:bg-red-50">
                    채우기 →
                  </button>
                )}
              </span>
            ))
          )}
        </span>
      )}
    </span>
  );
}
