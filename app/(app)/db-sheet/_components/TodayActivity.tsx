"use client";
/**
 * 「오늘 활동」(belie 2026-11-07, 목업 0-v2·B안) — 일별 기록을 DB 목록 옆으로 뺀 반쪽 패널.
 * 닫혀 있어도 살짝 나와 있다: 폰 = 화면 아래 띠(흐름 숫자 + 빠른 추가), PC = 오른쪽 아래 카드. 누르면 덮어 들어오는 반페이지.
 * 숫자는 일별 기록(GET /api/daily/오늘) 그대로 — DB 목록에서 한 일은 이미 들어 있다. 손으로 더하는 건 현수막 게시(사람이 없는 활동) 하나.
 * 지난 날짜 고치기·기록 옮기기는 일별 기록 탭.
 * 현수막은 한 번에 여러 장 붙이므로 게시 수를 칸에 바로 적는다(−/＋ 는 미세 조정, belie 2026-11-08).
 * PC 닫힘 카드는 오른쪽 아래 「오늘 챙길 일」 버튼과 겹치지 않게 그 왼쪽에 둔다.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type TouchEvent as RTouchEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Minus } from "lucide-react";
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
  const [draft, setDraft] = useState<string | null>(null), [focusBanner, setFocusBanner] = useState(false);
  const bannerInput = useRef<HTMLInputElement>(null), cancelDraft = useRef(false);
  // 폰: 띠를 위로 쓸어 올리면 열고, 펼친 머리를 아래로 쓸어내리면 닫는다(belie 2026-11-08 「스르륵」).
  const touchY = useRef<number | null>(null);
  const swipe = (dir: "up" | "down", act: () => void) => ({
    onTouchStart: (e: RTouchEvent) => { touchY.current = e.touches[0]?.clientY ?? null; },
    onTouchMove: (e: RTouchEvent) => {
      const y0 = touchY.current, y = e.touches[0]?.clientY;
      if (y0 === null || y === undefined) return;
      if (dir === "up" ? y0 - y > 24 : y - y0 > 40) { touchY.current = null; act(); }
    },
    onTouchEnd: () => { touchY.current = null; },
  });
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

  // 「＋ 현수막 게시」로 열면 게시 수 칸에 바로 적게 한다.
  useEffect(() => {
    if (open && focusBanner) { bannerInput.current?.focus(); bannerInput.current?.select(); setFocusBanner(false); }
  }, [open, focusBanner]);

  // 현수막 게시 수 저장 — 그날 현수막 줄을 읽은 값 그대로(DB 목록 집계 기준값 포함) 보내 다른 칸은 건드리지 않는다.
  async function setBannerCount(next: number) {
    if (!banner || save.isPending || !Number.isInteger(next) || next < 0 || next > 999 || next === banner.production) return;
    setError("");
    try { await save.mutateAsync({ date: today, channels: { 현수막: { ...banner, production: next } } as Record<Channel, typeof banner> }); }
    catch (e) { setError((e as Error).message || "저장하지 못했어요. 일별 기록에서 다시 해 주세요."); }
  }

  const bump = (delta: number) => banner ? setBannerCount(banner.production + delta) : undefined;
  function commitDraft() {
    if (draft === null) return;
    if (cancelDraft.current) { cancelDraft.current = false; setDraft(null); return; }
    const n = Number(draft.replace(/[^0-9]/g, ""));
    setDraft(null);
    if (draft.trim() !== "") void setBannerCount(n);
  }
  const openBanner = () => { setFocusBanner(true); setOpen(true); };
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
    <button type="button" className={`rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50 ${column ? "rounded-lg py-2 text-left" : "shrink-0"}`} disabled={!banner} onClick={openBanner}>＋ 현수막 게시</button>
  </div>;

  const head = <div {...swipe("down", () => setOpen(false))} className="relative flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3">
    <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 pc:hidden" />
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><ChannelBadge channel="현수막" /><span className="text-sm font-semibold text-slate-800">게시</span></div>
          <div className="mt-0.5 text-xs text-slate-500">오늘 붙인 장수를 적어요{stock !== null && ` · 재고 ${stock}개`}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="현수막 게시 빼기" disabled={!banner || !banner.production || save.isPending} onClick={() => void bump(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 disabled:opacity-40"><Minus size={18} aria-hidden="true" /></button>
          <input ref={bannerInput} type="text" inputMode="numeric" aria-label="오늘 현수막 게시 수" disabled={!banner || save.isPending}
            className="h-10 w-16 rounded-lg border border-slate-300 bg-white text-center text-lg font-bold tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
            value={draft ?? (banner ? String(banner.production) : "–")}
            onFocus={e => { setDraft(banner ? String(banner.production) : ""); e.currentTarget.select(); }}
            onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            onBlur={commitDraft}
            onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } else if (e.key === "Escape") { e.stopPropagation(); cancelDraft.current = true; e.currentTarget.blur(); } }} />
          {[1, 5, 10].map(n => <button key={n} type="button" aria-label={`현수막 게시 ${n}장 더하기`} disabled={!banner || save.isPending} onClick={() => void bump(n)} className="flex h-10 min-w-10 items-center justify-center rounded-full bg-emerald-600 px-2 text-sm font-bold tabular-nums text-white disabled:opacity-40">＋{n}</button>)}
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
    {open && <div aria-hidden="true" className="ta-scrim fixed inset-0 z-[60] bg-slate-900/25" onClick={() => setOpen(false)} />}
    {/* 펼침 — 폰·태블릿은 아래에서 반쯤, PC 는 오른쪽 반. 한 벌만 그린다. */}
    {open && <div className="ta-sheet fixed inset-x-0 bottom-0 z-[61] h-[60dvh] overflow-hidden rounded-t-2xl shadow-2xl pc:left-auto pc:top-0 pc:h-auto pc:w-[min(46vw,560px)] pc:rounded-none">{body}</div>}
    {/* 닫힘 — 폰·태블릿: 아래 띠 / PC: 오른쪽 아래 카드 */}
    {!open && <>
      <div className="fixed inset-x-0 bottom-0 z-40 pc:hidden">
        <section aria-label="오늘 활동" {...swipe("up", () => setOpen(true))} className="relative touch-pan-x rounded-t-2xl border-t border-slate-200 bg-white px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-3 shadow-lg">
          <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300" />
          <button type="button" aria-expanded={false} className="flex w-full items-center justify-between" onClick={() => setOpen(true)}>
            <span className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">오늘 활동</span><span className="text-xs text-slate-500">{dayLabel(today)}</span></span>
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700">펼치기<ChevronUp size={14} aria-hidden="true" /></span>
          </button>
          <div className="mt-2">{funnel(true)}</div>
          <div className="mt-2 overflow-x-auto">{chips(false)}</div>
        </section>
      </div>
      <div className="fixed bottom-0 right-[calc(96px+env(safe-area-inset-right,0px))] z-40 hidden w-72 pc:block">
        <section aria-label="오늘 활동" className="rounded-t-2xl border-x border-t border-slate-200 bg-white px-4 pb-4 pt-3 shadow-lg">
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
