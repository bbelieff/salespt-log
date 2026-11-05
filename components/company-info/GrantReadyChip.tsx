/**
 * 헤더 칩 「맞는 공고 N」(2026-10-26 4단계): 실무/수납에서 맞는 공고가 있으면 — 누르면 같은 화면의 「🎯 맞는 공고」 상자를 열고 그리로 이동.
 * 예전 「공고필터 n/3」 칩과 펼침은 업체정보 맨 위 「공고필터」 버튼(GrantFilterPanel)으로 옮겼다(belie 2026-11-05).
 * grantReadyLines = 조건 세 줄(지역·대분류·규모) — 공고필터 펼침이 쓴다.
 */
"use client";

import { useRef } from "react";
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

export function GrantReadyChip({ matchCount }: { matchCount?: number }) {
  const chip = useRef<HTMLButtonElement>(null);
  if (!matchCount || matchCount <= 0) return null;
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
