/**
 * 공고필터 버튼 + 펼침(belie 2026-11-05 「업종·소재지·공고특성이 앞에 나올 필요 없다 — 공고필터 버튼을 위에 놓고
 * 자동 적용된 현황을 그쪽으로 옮기자 · PC 실무/수납에도 버튼이 보여야」).
 *
 * 버튼은 업체정보 펼침 맨 위(기본보기/확장보기 줄)에 늘 있다 — 세 조건이 다 맞아도 숨기지 않는다.
 * 펼치면 지역(시·도/시·군·구) · 업종(대분류·제외 업종) · 규모 · 공고 특성을 한곳에서 보고 고친다.
 * 빈 조건은 「채우기 →」로 그 입력 칸까지 데려간다. 값 계산·저장 규칙은 lib/analytics/company-grant.ts.
 */
"use client";

import type { ReactNode } from "react";
import type { CompanyInfo } from "@/types";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import { grantProfile } from "@/lib/analytics/company-grant";
import { FeatureChips, IndustryLine, RegionSelects } from "./CompanyGrantFields";
import { grantReadyLines } from "./GrantReadyChip";

type CI = CompanyInfo;

export function GrantFilterButton({ draft, open, onToggle, controlsId }: { draft: CI; open: boolean; onToggle: () => void; controlsId: string }) {
  const n = grantProfile(draft).ready;
  const tone = n < 3 ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100";
  // 높이는 옆 보기 토글(테두리 + p-0.5 + py-1 text-xs)과 같은 상자로 — 화살표도 글자 줄보다 작게(h-3) 맞춘다(2026-11-05 belie 「높이도 맞춰」).
  return (
    <button type="button" aria-expanded={open} aria-controls={controlsId} onClick={onToggle} data-grant-filter-button
      className={`inline-flex shrink-0 rounded-lg border p-0.5 ${tone}`}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold">
        공고필터 <span className="font-semibold">{n < 3 ? `${n}/3` : "✓"}</span>
        <DisclosureChevron open={open} className="h-3 w-3" />
      </span>
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-10 shrink-0 text-px-11 font-semibold text-gray-500">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
    </div>
  );
}

export function GrantFilterPanel({ draft, id, onPatch, onFill }: { draft: CI; id: string; onPatch: (p: Partial<CI>) => void; onFill: (key: keyof CI) => void }) {
  const p = grantProfile(draft);
  const lines = grantReadyLines(draft);
  const missing = (i: number) => {
    const l = lines[i]!;
    if (l.ok) return null;
    return (
      <span className="inline-flex min-w-0 items-center gap-1 text-px-11 text-amber-800">
        {l.text.replace(/^[^:]+:\s*/, "")}
        {l.fill && <button type="button" onClick={() => onFill(l.fill!)} className="shrink-0 rounded px-1 font-semibold text-brand-red hover:bg-red-50">채우기 →</button>}
      </span>
    );
  };
  return (
    <section id={id} aria-label="공고필터" data-grant-filter-panel className="space-y-2 rounded-md border border-gray-100 bg-white p-2.5 shadow-sm">
      <Row label="지역"><RegionSelects draft={draft} onPatch={onPatch} />{missing(0)}</Row>
      <Row label="업종"><IndustryLine draft={draft} className="" onPatch={onPatch} />{missing(1)}</Row>
      <Row label="규모">
        {p.smallBusiness !== null && <span className="text-xs text-gray-800">{p.smallBusiness ? "소상공인" : "소상공인 아님"}</span>}
        {missing(2)}
      </Row>
      <Row label="특성"><FeatureChips draft={draft} className="" onPatch={onPatch} /></Row>
    </section>
  );
}
