/**
 * 실무 칸 「🎯 맞는 공고」(2026-10-26 맞춤공고 4단계 — belie 승인 목업 ②). 로드맵 메모와 실무진행 사이, 접는 상자.
 * 줄: 판정 배지(소진 임박/맞음/확인 필요) · 공고명 · 한 줄(지역·한도·마감). 「확인 필요」만 이유 한 줄.
 * 업체 지역·업종은 다시 적지 않는다(핸드오프 §3 ①). 맞는 공고가 없으면 상자를 그리지 않는다.
 * 「할 일로 담기」는 다음 단계(4b). 데이터는 실무/수납 page 의 useGrantMatches 가 내려준다(없으면 안 그림).
 */
"use client";

import Link from "next/link";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import type { GrantMatchesResponse } from "@/lib/analytics/grant-match";
import { contractRef } from "@/util/contract-ref";

const BADGE = {
  urgent: ["소진 임박", "bg-rose-50 text-rose-700 ring-rose-200"],
  match: ["맞음", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  check: ["확인 필요", "bg-amber-50 text-amber-800 ring-amber-200"],
} as const;

export default function GrantMatchBox({ 계약일, 업체명, grants: data }: { 계약일: string; 업체명: string; grants?: GrantMatchesResponse }) {
  const mine = data && !data.unavailable ? data.companies[contractRef(계약일, 업체명)] : undefined;
  const rows = (mine?.matches ?? []).filter((m) => data?.announcements[m.id]);
  if (rows.length === 0) return null;
  const ok = rows.filter((m) => m.verdict === "match").length;
  const check = rows.length - ok;
  return (
    <details data-grant-match-box className="group rounded-lg border border-slate-200 bg-white">
      <summary className="disclosure-summary payment-sticky-title flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-800 group-open:rounded-b-none">
        <span>🎯 맞는 공고 {ok}{check > 0 && <span className="font-normal text-slate-500"> · 확인 {check}</span>}</span>
        <DisclosureChevron />
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {rows.map((m) => {
          const a = data!.announcements[m.id]!;
          const [label, tone] = BADGE[m.urgent ? "urgent" : m.verdict];
          const line = [a.regionText, a.maxAmount, a.deadlineText && `마감 ${a.deadlineText}`].filter(Boolean).join(" · ");
          return (
            <li key={m.id} className="px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-px-11 font-bold ring-1 ${tone}`}>{label}</span>
                {a.link
                  ? <a href={a.link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline">{a.title}</a>
                  : <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{a.title}</span>}
              </div>
              {line && <p className="mt-0.5 truncate text-px-11 text-slate-500">{line}</p>}
              {m.verdict === "check" && m.reasons[0] && <p className="mt-0.5 truncate text-px-11 text-amber-800">{m.reasons.join(" · ")}</p>}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-slate-100 px-3 py-1.5 text-right">
        <Link href="/payment/news" className="text-xs font-semibold text-blue-700 hover:underline">공고별로 보기 →</Link>
      </div>
    </details>
  );
}

/** 목록 카드 칩 「공고 N」 / 「지역 없음」. 업체정보가 없으면 아무것도 안 붙인다. */
export function GrantChip({ 계약일, 업체명, grants: data }: { 계약일: string; 업체명: string; grants?: GrantMatchesResponse }) {
  const mine = data && !data.unavailable ? data.companies[contractRef(계약일, 업체명)] : undefined;
  if (!mine?.hasInfo) return null;
  if (mine.noRegion) return <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-px-11 font-semibold text-slate-500">지역 없음</span>;
  const n = mine.matches.length;
  if (n === 0) return null;
  return <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-px-11 font-bold text-emerald-700 ring-1 ring-emerald-200">공고 {n}</span>;
}
