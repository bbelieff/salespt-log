/**
 * 맞춤공고 칸(2026-10-25 belie 승인 목업 — 경영일지_맞춤공고 핸드오프 §4-A). [기업정보] 원래 칸 밑·옆에 붙는다(새 구간 없음).
 *
 * - RegionAddress: 소재지 입력 + 같은 줄 시·도 / 시·군·구(넓으면 한 줄, 좁으면 줄바꿈). 소재지에서 계산한 값이면 「자동」.
 *   손으로 고르면 지역시도·지역시군구에 저장되고 「자동」이 사라진다. 「자동으로」를 고르면 저장값을 비워 다시 계산.
 * - IndustryLine: 업종 줄 아래 「대분류」(자동) + 「제외 업종」 켜기.
 * - FeatureChips: 「공고 특성」 칩. 특허 및 인증 글에서 읽은 벤처·이노비즈·메인비즈는 자동으로 켜져 있다(그 글을 고치면 바뀐다).
 * 설명 문구는 두지 않는다(belie 원칙 ②). 자동 값은 저장하지 않는다 — lib/analytics/company-grant.ts.
 */
"use client";

import type { CompanyInfo } from "@/types";
import type { FieldDef } from "@/components/company-info-defs";
import { SIDO, SIGUNGU, type Sido } from "@/util/admin-regions";
import { grantProfile, 대분류_목록, 공고특성_목록, splitFeatures } from "@/lib/analytics/company-grant";
import CompanyInfoField from "./CompanyInfoField";

type CI = CompanyInfo;
const selCls = "rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 focus:border-brand-red focus:outline-none";
const AUTO = "자동으로";

export function AutoTag() {
  return <span className="rounded bg-blue-50 px-1 text-px-10 font-bold text-blue-700">자동</span>;
}

export function RegionAddress({ draft, id, className, onField, onPatch }: { draft: CI; id: string; className: string; onField: (k: keyof CI, v: string) => void; onPatch: (p: Partial<CI>) => void }) {
  const p = grantProfile(draft);
  const sido = p.region.시도;
  const list = sido ? SIGUNGU[sido as Sido] : [];
  const def: FieldDef = ["소재지", "소재지", "주소지", 2];
  return (
    <div className={`${className} flex min-w-0 flex-wrap items-end gap-1.5`}>
      <CompanyInfoField def={def} value={String(draft.소재지 ?? "")} onChange={onField} id={id} className="block min-w-48 flex-1" />
      <span className="inline-flex shrink-0 items-center gap-1 pb-0.5">
        <select aria-label="시·도" className={selCls} value={sido} onChange={(e) => {
          const v = e.target.value;
          onPatch(v === AUTO ? { 지역시도: "", 지역시군구: "" } : { 지역시도: v, 지역시군구: v === sido ? p.region.시군구 : "" });
        }}>
          {!sido && <option value="">시·도</option>}
          {!p.regionAuto && <option value={AUTO}>{AUTO}</option>}
          {SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {list.length > 0 && (
          <select aria-label="시·군·구" className={selCls} value={p.region.시군구} onChange={(e) => {
            const v = e.target.value;
            onPatch(v === AUTO ? { 지역시도: "", 지역시군구: "" } : { 지역시도: sido, 지역시군구: v });
          }}>
            {!p.region.시군구 && <option value="">시·군·구</option>}
            {!p.regionAuto && <option value={AUTO}>{AUTO}</option>}
            {list.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {p.regionAuto && sido && <AutoTag />}
      </span>
    </div>
  );
}

export function IndustryLine({ draft, className, onPatch }: { draft: CI; className: string; onPatch: (p: Partial<CI>) => void }) {
  const p = grantProfile(draft);
  return (
    <div className={`${className} flex flex-wrap items-center gap-1.5`}>
      <span className="text-px-11 text-gray-500">대분류</span>
      <select aria-label="대분류" className={selCls} value={p.industry} onChange={(e) => onPatch({ 대분류: e.target.value === AUTO ? "" : e.target.value })}>
        {!p.industry && <option value="">대분류</option>}
        {!p.industryAuto && <option value={AUTO}>{AUTO}</option>}
        {대분류_목록.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {p.industryAuto && p.industry && <AutoTag />}
      <label className="ml-1 inline-flex items-center gap-1 text-px-11 text-gray-600">
        <input type="checkbox" className="h-3.5 w-3.5 accent-brand-red" checked={p.excluded} onChange={(e) => onPatch({ 제외업종: e.target.checked ? "예" : "아니오" })} />
        제외 업종
      </label>
    </div>
  );
}

export function FeatureChips({ draft, className, onPatch }: { draft: CI; className: string; onPatch: (p: Partial<CI>) => void }) {
  const p = grantProfile(draft);
  const manual = splitFeatures(draft.공고특성);
  const toggle = (f: string) => {
    const next = manual.includes(f as never) ? manual.filter((x) => x !== f) : [...manual, f];
    onPatch({ 공고특성: 공고특성_목록.filter((x) => (next as string[]).includes(x)).join(",") });
  };
  return (
    <div className={`${className} flex flex-wrap items-center gap-1`} role="group" aria-label="공고 특성">
      <span className="mr-0.5 text-px-11 text-gray-500">공고 특성</span>
      {공고특성_목록.map((f) => {
        const on = p.features.includes(f);
        const auto = p.autoFeatures.includes(f);
        return (
          <button key={f} type="button" aria-pressed={on} disabled={auto} title={auto ? "특허 및 인증에서 읽음" : undefined} onClick={() => toggle(f)}
            className={`min-h-6 rounded-full border px-2 text-px-11 font-semibold ${on ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"} ${auto ? "cursor-default" : ""}`}>
            {f}{auto && <span className="ml-0.5 text-px-10 text-blue-600">·자동</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 헤더 칩 「공고매칭 n/3」 — 지역·대분류·규모 판정이 되는가. */
export function GrantReadyChip({ draft }: { draft: CI }) {
  const n = grantProfile(draft).ready;
  const full = n === 3;
  return (
    <span className={`inline-block rounded-full px-2 text-px-11 font-bold ring-1 ${full ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
      공고매칭 {n}/3{full ? " ✓" : ""}
    </span>
  );
}
