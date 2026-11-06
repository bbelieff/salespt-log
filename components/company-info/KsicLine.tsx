/**
 * KsicLine — 공고필터 펼침의 업종 줄 아래 「산업분류」(belie 2026-11-04 「MSC 벤치마킹」 · 11-05 「고른 코드 저장」
 * · 11-06 「고르기·후보·복사·자동으로 너무 복잡 — 공고필터로」).
 * 업태·업종(사업자등록증의 종목)을 읽어 KSIC 11차 세세분류 1순위를 「자동」으로 보여 준다. 버튼은 「바꾸기」 하나:
 * 코드를 누르면 복사(「복사됨」 알림), 「바꾸기」를 펴면 [자동 추천으로 두기(고른 값이 있을 때)] · 2·3순위 · 찾기 —
 * 줄을 누르면 바로 정하고 닫힌다. 고른 값은 `표준산업분류`("47711 이름", 04 CJ · 06 BR), 빈값 = 자동(저장 안 함).
 * 분류표(lib/config/ksic11.ts, 220KB)는 이 줄이 처음 그려질 때 한 번만 받는다(동적 import). 계산은 lib/util/ksic.ts.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyInfo } from "@/types";
import { searchKsic, suggestKsic, type KsicData } from "@/util/ksic";
import AppToast from "@/components/ui/AppToast";
import { AutoTag } from "./CompanyGrantFields";

let cache: KsicData | null = null;
let loading: Promise<KsicData> | null = null;
function loadKsic(): Promise<KsicData> {
  if (cache) return Promise.resolve(cache);
  loading ??= import("@/config/ksic11").then((m) => (cache = m.KSIC11));
  return loading;
}

const chip = "shrink-0 rounded bg-slate-100 px-1 font-mono text-px-11 font-semibold tabular-nums text-slate-700";

/** 펼친 목록의 한 줄 — 줄 전체가 버튼(누르면 정하고 닫힘). */
function Choice({ code, name, path, lead, onPick }: { code: string; name: string; path?: string; lead?: string; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} title={path} className="flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-white">
      {lead && <span className="shrink-0 text-px-11 font-semibold text-brand-red">{lead}</span>}
      <span className={chip}>{code}</span>
      <span className="min-w-0 truncate text-xs text-gray-800">{name}</span>
    </button>
  );
}

/** 저장값 "47711 이름" → [코드, 이름]. 코드로 시작하지 않는 글은 코드 없이 글 그대로. */
export function splitSavedKsic(v: string): [string, string] {
  const m = /^(\d{5})\s+(.*)$/.exec(v.trim());
  return m ? [m[1]!, m[2]!] : ["", v.trim()];
}

export function KsicLine({ draft, onPatch }: { draft: CompanyInfo; onPatch: (p: Partial<CompanyInfo>) => void }) {
  const [data, setData] = useState<KsicData | null>(cache);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const 업태 = String(draft.업태 ?? "");
  const 종목 = String(draft.업종주생산품목 ?? "") || String(draft.주생산품목 ?? "");
  const saved = String(draft.표준산업분류 ?? "").trim();
  const has = (업태 + 종목).trim() !== "" || saved !== "";
  useEffect(() => {
    if (has && !data) void loadKsic().then(setData);
  }, [has, data]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const top = useMemo(() => (data && (업태 + 종목).trim() ? suggestKsic(업태, 종목, data, 3) : []), [data, 업태, 종목]);
  const found = useMemo(() => (open && q.trim() ? searchKsic(q, data, 8) : []), [open, q, data]);
  if (!has || !data) return null;
  const close = () => {
    setOpen(false);
    setQ("");
  };
  const pick = (code: string, name: string) => {
    onPatch({ 표준산업분류: `${code} ${name}` });
    close();
  };
  const [savedCode, savedName] = splitSavedKsic(saved);
  const first = top[0];
  const cur = saved ? { code: savedCode, name: savedName } : first ? { code: first.code, name: first.name } : null;
  // 펼친 목록: 1순위는 지금 줄(자동) 또는 맨 위 「자동 추천으로 두기」에 이미 있으니 2·3순위만 — 고른 값과 같은 것도 뺀다.
  const others = top.slice(1).filter((h) => h.code !== savedCode);
  return (
    <div className="w-full min-w-0" data-ksic-line>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 whitespace-nowrap text-px-11 text-gray-500">산업분류</span>
        {cur ? (
          <>
            {cur.code && (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(cur.code).then(() => setCopied(true), () => {})}
                className={`${chip} hover:bg-slate-200`}
                aria-label={`산업분류 코드 ${cur.code} 복사`}
              >
                {cur.code}
              </button>
            )}
            <span className="min-w-0 truncate text-xs text-gray-800" title={first && !saved ? `${first.sectionName} › ${first.midName}` : undefined}>
              {cur.name}
            </span>
            {!saved && <AutoTag />}
          </>
        ) : (
          <span className="min-w-0 truncate text-xs text-gray-400">맞는 분류를 못 찾았어요</span>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
          className="shrink-0 rounded px-1 text-px-11 font-semibold text-blue-700 hover:bg-blue-50"
        >
          {open ? "닫기" : "바꾸기"}
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-0.5 rounded-md border border-gray-200 bg-gray-50 p-1">
          {saved && first && (
            <Choice
              lead="자동 추천으로 두기"
              code={first.code}
              name={first.name}
              onPick={() => {
                onPatch({ 표준산업분류: "" });
                close();
              }}
            />
          )}
          {others.map((h) => (
            <Choice key={h.code} code={h.code} name={h.name} path={`${h.sectionName} › ${h.midName}`} onPick={() => pick(h.code, h.name)} />
          ))}
          <input
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-brand-red focus:outline-none"
            placeholder="코드나 낱말로 찾기 (예: 47711, 화초)"
            aria-label="표준산업분류 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {found.map((h) => (
            <Choice key={`s-${h.code}`} code={h.code} name={h.name} path={`${h.sectionName} › ${h.midName}`} onPick={() => pick(h.code, h.name)} />
          ))}
          {q.trim() !== "" && found.length === 0 && <p className="px-1 text-xs text-gray-400">찾는 분류가 없어요</p>}
        </div>
      )}
      {copied && <AppToast>산업분류 코드 {cur?.code} 복사됨</AppToast>}
    </div>
  );
}
