/**
 * KsicLine — 업종 줄 아래 「표준산업분류」(belie 2026-11-04 「MSC 벤치마킹」 · 11-05 「고른 코드 저장」).
 * 업태·업종(사업자등록증의 종목)을 읽어 KSIC 11차 세세분류 1순위를 「자동」으로 보여 주고, 「후보」를 펴면 2·3순위 + 직접 찾기.
 * 후보·찾은 줄의 「고르기」로 정하면 `표준산업분류`("47711 운송장비용 주유소 운영업")에 저장(04 CJ · 06 BR) —
 * 대분류처럼 빈값 = 자동(저장 안 함), 「자동으로」로 되돌린다. 코드 옆 「복사」로 신청서에 바로 붙인다.
 * 분류표(lib/config/ksic11.ts, 220KB)는 이 줄이 처음 그려질 때 한 번만 받는다(동적 import). 계산은 lib/util/ksic.ts.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyInfo } from "@/types";
import { searchKsic, suggestKsic, type KsicData } from "@/util/ksic";
import { AutoTag } from "./CompanyGrantFields";

let cache: KsicData | null = null;
let loading: Promise<KsicData> | null = null;
function loadKsic(): Promise<KsicData> {
  if (cache) return Promise.resolve(cache);
  loading ??= import("@/config/ksic11").then((m) => (cache = m.KSIC11));
  return loading;
}

const smallBtn = "shrink-0 rounded px-1 text-px-11 font-semibold";

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
      className={`${smallBtn} text-gray-500 hover:bg-gray-100 hover:text-gray-800`}
      aria-label={`산업분류 코드 ${code} 복사`}
    >
      {done ? "복사됨" : "복사"}
    </button>
  );
}

function Row({ code, name, path, onPick }: { code: string; name: string; path?: string; onPick?: () => void }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 py-0.5" title={path}>
      {code && <span className="shrink-0 rounded bg-slate-100 px-1 font-mono text-px-11 font-semibold tabular-nums text-slate-700">{code}</span>}
      <span className="min-w-0 truncate text-xs text-gray-800">{name}</span>
      {code && <CopyCode code={code} />}
      {onPick && (
        <button type="button" onClick={onPick} className={`${smallBtn} text-brand-red hover:bg-red-50`} aria-label={`${code} ${name} 고르기`}>
          고르기
        </button>
      )}
    </span>
  );
}

/** 저장값 "47711 이름" → [코드, 이름]. 코드로 시작하지 않는 글은 코드 없이 글 그대로. */
export function splitSavedKsic(v: string): [string, string] {
  const m = /^(\d{5})\s+(.*)$/.exec(v.trim());
  return m ? [m[1]!, m[2]!] : ["", v.trim()];
}

export function KsicLine({ draft, className, onPatch }: { draft: CompanyInfo; className: string; onPatch: (p: Partial<CompanyInfo>) => void }) {
  const [data, setData] = useState<KsicData | null>(cache);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const 업태 = String(draft.업태 ?? "");
  const 종목 = String(draft.업종주생산품목 ?? "") || String(draft.주생산품목 ?? "");
  const saved = String(draft.표준산업분류 ?? "").trim();
  const has = (업태 + 종목).trim() !== "" || saved !== "";
  useEffect(() => {
    if (has && !data) void loadKsic().then(setData);
  }, [has, data]);
  const top = useMemo(() => (data && (업태 + 종목).trim() ? suggestKsic(업태, 종목, data, 3) : []), [data, 업태, 종목]);
  const found = useMemo(() => (open && q.trim() ? searchKsic(q, data, 8) : []), [open, q, data]);
  if (!has || !data) return null;
  const pick = (code: string, name: string) => {
    onPatch({ 표준산업분류: `${code} ${name}` });
    setOpen(false);
    setQ("");
  };
  const [savedCode, savedName] = splitSavedKsic(saved);
  const first = top[0];
  // 펼친 목록: 자동이면 2·3순위, 고른 값이 있으면 1~3순위 중 고른 것만 빼고.
  const others = saved ? top.filter((h) => h.code !== savedCode) : top.slice(1);
  return (
    <div className={`${className} min-w-0`} data-ksic-line>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="shrink-0 whitespace-nowrap text-px-11 text-gray-500">표준산업분류</span>
        {saved ? (
          <span className="min-w-0 flex-1"><Row code={savedCode} name={savedName} /></span>
        ) : first ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0"><Row code={first.code} name={first.name} path={`${first.sectionName} › ${first.midName}`} onPick={() => pick(first.code, first.name)} /></span>
            <AutoTag />
          </span>
        ) : (
          <span className="text-xs text-gray-400">맞는 분류를 못 찾았어요</span>
        )}
        {saved && (
          <button type="button" onClick={() => onPatch({ 표준산업분류: "" })} className={`${smallBtn} text-gray-500 hover:bg-gray-100`}>
            자동으로
          </button>
        )}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${smallBtn} text-blue-700 hover:bg-blue-50`}>
          {open ? "접기" : "후보"}
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-1 rounded-md border border-gray-200 bg-gray-50 p-1.5">
          {others.map((h) => (
            <Row key={h.code} code={h.code} name={h.name} path={`${h.sectionName} › ${h.midName}`} onPick={() => pick(h.code, h.name)} />
          ))}
          <input
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
            placeholder="코드나 낱말로 찾기 (예: 47711, 화초)"
            aria-label="표준산업분류 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {found.map((h) => (
            <Row key={`s-${h.code}`} code={h.code} name={h.name} path={`${h.sectionName} › ${h.midName}`} onPick={() => pick(h.code, h.name)} />
          ))}
          {q.trim() !== "" && found.length === 0 && <p className="text-xs text-gray-400">찾는 분류가 없어요</p>}
        </div>
      )}
    </div>
  );
}
