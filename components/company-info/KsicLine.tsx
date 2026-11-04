/**
 * KsicLine — 업종 줄 아래 「표준산업분류」 추천(belie 2026-11-04 「MSC 벤치마킹」).
 * 업태·업종(사업자등록증의 종목)을 읽어 KSIC 11차 세세분류 1순위를 보여 주고, 「후보」를 펴면 3순위까지 + 직접 찾기.
 * 코드 옆 「복사」로 지원사업 신청서 등에 바로 붙인다. 저장하지 않는다(대분류 자동처럼 읽을 때 계산) — 고른 코드 저장은 다음 단계.
 * 분류표(220KB)는 이 줄이 처음 그려질 때 한 번만 받는다(동적 import). 계산은 lib/util/ksic.ts.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyInfo } from "@/types";
import { searchKsic, suggestKsic, type KsicData } from "@/util/ksic";

let cache: KsicData | null = null;
let loading: Promise<KsicData> | null = null;
function loadKsic(): Promise<KsicData> {
  if (cache) return Promise.resolve(cache);
  loading ??= import("@/config/ksic11.json").then((m) => (cache = (m.default ?? m) as unknown as KsicData));
  return loading;
}

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="shrink-0 rounded px-1 text-px-11 font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      aria-label={`산업분류 코드 ${code} 복사`}
    >
      {done ? "복사됨" : "복사"}
    </button>
  );
}

function Row({ code, name, path }: { code: string; name: string; path: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 py-0.5" title={path}>
      <span className="shrink-0 rounded bg-slate-100 px-1 font-mono text-px-11 font-semibold tabular-nums text-slate-700">{code}</span>
      <span className="min-w-0 truncate text-xs text-gray-800">{name}</span>
      <CopyCode code={code} />
    </span>
  );
}

export function KsicLine({ draft, className }: { draft: CompanyInfo; className: string }) {
  const [data, setData] = useState<KsicData | null>(cache);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const 업태 = String(draft.업태 ?? "");
  const 종목 = String(draft.업종주생산품목 ?? "") || String(draft.주생산품목 ?? "");
  const has = (업태 + 종목).trim() !== "";
  useEffect(() => {
    if (has && !data) void loadKsic().then(setData);
  }, [has, data]);
  const top = useMemo(() => (data && has ? suggestKsic(업태, 종목, data, 3) : []), [data, has, 업태, 종목]);
  const found = useMemo(() => (open && q.trim() ? searchKsic(q, data, 8) : []), [open, q, data]);
  if (!has || !data) return null;
  const first = top[0];
  return (
    <div className={`${className} min-w-0`} data-ksic-line>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="shrink-0 whitespace-nowrap text-px-11 text-gray-500">표준산업분류</span>
        {first ? (
          <span className="min-w-0 flex-1"><Row code={first.code} name={first.name} path={`${first.sectionName} › ${first.midName}`} /></span>
        ) : (
          <span className="text-xs text-gray-400">맞는 분류를 못 찾았어요</span>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded px-1 text-px-11 font-semibold text-blue-700 hover:bg-blue-50"
        >
          {open ? "접기" : "후보"}
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-1 rounded-md border border-gray-200 bg-gray-50 p-1.5">
          {top.slice(1).map((h) => <Row key={h.code} code={h.code} name={h.name} path={`${h.sectionName} › ${h.midName}`} />)}
          <input
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
            placeholder="코드나 낱말로 찾기 (예: 47711, 화초)"
            aria-label="표준산업분류 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {found.map((h) => <Row key={`s-${h.code}`} code={h.code} name={h.name} path={`${h.sectionName} › ${h.midName}`} />)}
          {q.trim() !== "" && found.length === 0 && <p className="text-xs text-gray-400">찾는 분류가 없어요</p>}
        </div>
      )}
    </div>
  );
}
