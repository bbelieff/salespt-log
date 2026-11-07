"use client";
/**
 * 「오늘 활동」(belie 2026-11-07, 목업 0-v2·B안) — 일별 기록을 DB 목록 옆으로 뺀 반쪽 패널.
 * 닫혀 있어도 살짝 나와 있다: 폰 = 화면 아래 띠(흐름 숫자 + 빠른 추가), PC = 오른쪽 아래 카드. 누르면 덮어 들어오는 반페이지.
 * 숫자는 일별 기록(GET /api/daily/오늘) 그대로 — DB 목록에서 한 일은 이미 들어 있다. 손으로 더하는 건 현수막 게시(사람이 없는 활동) 하나.
 * 지난 날짜 고치기·기록 옮기기는 일별 기록 탭.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Minus, Plus } from "lucide-react";
import { CHANNEL_ORDER, type Channel } from "@/types";
import ChannelBadge from "@/components/ui/ChannelBadge";
import { useDay, useSaveMetrics } from "@/query/contact-hooks";
import { todayKST } from "@/util/week";

const STEPS = [["production", "생산"], ["inflow", "유입"], ["contactProgress", "컨택"], ["meetingReservation", "미팅"]] as const;
type Key = (typeof STEPS)[number][0];
const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${iso}T12:00:00+09:00`));

export function TodayActivity({ onAdd }: { onAdd: () => void }) {
  const today = todayKST();
  const day = useDay(today);
  const save = useSaveMetrics({ silent: true });
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const ch = day.data?.channels;
  const total = (k: Key) => ch ? CHANNEL_ORDER.reduce((n, c) => n + (ch[c]?.[k] ?? 0), 0) : null;
  const banner = ch?.현수막;
  const stock = day.data ? Math.max(0, day.data.bannerStockBase - (banner?.production ?? 0)) : null;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  // 현수막 게시 ±1 — 그날 현수막 줄을 읽은 값 그대로(DB 목록 집계 기준값 포함) 보내 다른 칸은 건드리지 않는다.
  async function bump(delta: 1 | -1) {
    if (!banner || save.isPending) return;
    const next = banner.production + delta;
    if (next < 0) return;
    setError("");
    try { await save.mutateAsync({ date: today, channels: { 현수막: { ...banner, production: next } } as Record<Channel, typeof banner> }); }
    catch (e) { setError((e as Error).message || "저장하지 못했어요. 일별 기록에서 다시 해 주세요."); }
  }

  const add = () => { setOpen(false); onAdd(); };
  const num = (k: Key) => { const v = total(k); return v === null ? "–" : String(v); };
  const funnel = (row: boolean) => <ol className={row ? "flex items-center gap-1" : "grid gap-1"} aria-label="오늘 숫자">
    {STEPS.map(([k, label], i) => <li key={k} className={`flex flex-1 items-center gap-1 rounded-lg ${row ? "justify-center px-1 py-1.5" : "justify-between px-3 py-2"} ${i === 3 ? "bg-emerald-50" : "bg-slate-50"}`}>
      {row ? <><b className={`text-base tabular-nums ${i === 3 ? "text-emerald-700" : "text-slate-900"}`}>{num(k)}</b><span className="text-xs text-slate-500">{label}</span></>
        : <><span className="text-sm text-slate-600">{label}</span><b className={`text-lg tabular-nums ${i === 3 ? "text-emerald-700" : "text-slate-900"}`}>{num(k)}</b></>}
    </li>)}
  </ol>;
  const chips = (column: boolean) => <div className={column ? "flex flex-col gap-1.5" : "flex gap-1.5"}>
    <button type="button" className={`rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white ${column ? "rounded-lg py-2 text-left" : "shrink-0"}`} onClick={add}>＋ DB 추가</button>
    <button type="button" className={`rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50 ${column ? "rounded-lg py-2 text-left" : "shrink-0"}`} disabled={!banner || save.isPending} onClick={() => void bump(1)}>＋ 현수막 게시</button>
  </div>;

  const head = <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800">STEP 2</span>
        <h2 className="text-base font-bold text-slate-900">오늘 활동</h2>
        <span className="text-sm text-slate-500">{dayLabel(today)}</span>
      </div>
      <p className="mt-1 break-keep text-xs text-slate-500">DB 목록에서 한 일은 저절로 세져요. 목록에 없는 활동만 여기서 더해요.</p>
    </div>
    <button type="button" aria-label="오늘 활동 닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)}>
      <ChevronDown className="pc:hidden" size={18} aria-hidden="true" /><ChevronLeft className="hidden rotate-180 pc:block" size={18} aria-hidden="true" />
    </button>
  </div>;

  const body = <section aria-label="오늘 활동" className="flex h-full flex-col bg-white">
    {head}
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {funnel(true)}
      <table className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-center text-sm">
        <caption className="sr-only">채널별 오늘 숫자</caption>
        <thead><tr className="text-xs text-slate-500"><th className="w-[34%] text-left font-medium">채널</th>{STEPS.map(([k, l]) => <th key={k} className="font-medium">{l}</th>)}</tr></thead>
        <tbody>{CHANNEL_ORDER.map(c => <tr key={c}><td className="text-left"><ChannelBadge channel={c} /></td>{STEPS.map(([k]) => <td key={k} className="tabular-nums text-slate-700">{ch ? ch[c]?.[k] ?? 0 : "–"}</td>)}</tr>)}</tbody>
      </table>
      <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">목록에 없는 활동</p>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><ChannelBadge channel="현수막" /><span className="text-sm font-semibold text-slate-800">게시</span></div>
          <div className="mt-0.5 text-xs text-slate-500">오늘 붙인 현수막{stock !== null && ` · 재고 ${stock}개`}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="현수막 게시 빼기" disabled={!banner || !banner.production || save.isPending} onClick={() => void bump(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 disabled:opacity-40"><Minus size={18} aria-hidden="true" /></button>
          <span className="w-9 text-center text-lg font-bold tabular-nums text-slate-900" aria-live="polite">{banner?.production ?? "–"}</span>
          <button type="button" aria-label="현수막 게시 더하기" disabled={!banner || save.isPending} onClick={() => void bump(1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-40"><Plus size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <p className="mt-2 break-keep text-xs text-slate-500">현수막 문의·지인 소개·콜드콜도 「＋ DB 추가」로 목록에 올리면 유입·컨택·미팅이 저절로 더해져요.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
      <Link href="/contact" className="text-sm font-semibold text-emerald-700">일별 기록 전체 →</Link>
      <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white" onClick={add}>＋ DB 추가</button>
    </div>
  </section>;

  if (day.isError) return null; // 일별 기록을 못 읽는 계정(시트 없음 등)은 패널 없이 목록만
  return <>
    {/* 펼치면 위 머리줄(z-50)·메뉴(55·56)보다 위, 대화상자(200)보다 아래. */}
    {open && <div aria-hidden="true" className="fixed inset-0 z-[60] bg-slate-900/25" onClick={() => setOpen(false)} />}
    {/* 펼침 — 폰·태블릿은 아래에서 반쯤, PC 는 오른쪽 반. 한 벌만 그린다. */}
    {open && <div className="fixed inset-x-0 bottom-0 z-[61] h-[60dvh] overflow-hidden rounded-t-2xl shadow-2xl pc:left-auto pc:top-0 pc:h-auto pc:w-[min(46vw,560px)] pc:rounded-none">{body}</div>}
    {/* 닫힘 — 폰·태블릿: 아래 띠 / PC: 오른쪽 아래 카드 */}
    {!open && <>
      <div className="fixed inset-x-0 bottom-0 z-40 pc:hidden">
        <section aria-label="오늘 활동" className="rounded-t-2xl border-t border-slate-200 bg-white px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-lg">
          <button type="button" aria-expanded={false} className="flex w-full items-center justify-between" onClick={() => setOpen(true)}>
            <span className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">오늘 활동</span><span className="text-xs text-slate-500">{dayLabel(today)}</span></span>
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700">펼치기<ChevronUp size={14} aria-hidden="true" /></span>
          </button>
          <div className="mt-2">{funnel(true)}</div>
          <div className="mt-2 overflow-x-auto">{chips(false)}</div>
        </section>
      </div>
      <div className="fixed bottom-0 right-0 z-40 hidden w-60 pc:block">
        <section aria-label="오늘 활동" className="rounded-tl-2xl border-l border-t border-slate-200 bg-white px-4 pb-4 pt-3 shadow-lg">
          <button type="button" aria-expanded={false} className="flex w-full items-center justify-between" onClick={() => setOpen(true)}>
            <span className="text-left"><span className="block text-sm font-bold text-slate-900">오늘 활동</span><span className="text-xs text-slate-500">{dayLabel(today)}</span></span>
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700"><ChevronLeft size={14} aria-hidden="true" />펼치기</span>
          </button>
          <div className="mt-3">{funnel(false)}</div>
          <div className="mt-3">{chips(true)}</div>
        </section>
      </div>
    </>}
  </>;
}
