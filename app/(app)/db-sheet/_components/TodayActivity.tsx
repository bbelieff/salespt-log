"use client";
/**
 * 「오늘 활동」(belie 2026-11-07, 목업 0-v2·B안) — 일별 기록을 DB 목록 옆으로 뺀 반쪽 패널.
 * 닫혀 있어도 살짝 나와 있다: 폰 = 화면 아래 띠(흐름 숫자 + 빠른 추가), PC = 오른쪽 아래 카드.
 * 펼치면 폰은 아래에서 반쯤 올라오고, PC 는 그 카드가 제자리에서 위·왼쪽으로 커진다(사이드 패널 아님, belie 2026-11-08).
 * 숫자는 일별 기록(GET /api/daily/오늘) 그대로 — DB 목록에서 한 일은 이미 들어 있다. 손으로 더하는 건 현수막 게시(사람이 없는 활동) 하나.
 * 펼친 머리의 날짜 양옆 ‹ › 로 어제·그제 숫자를 그 자리에서 넘겨 본다(belie 2026-11-08). 닫으면 오늘로 돌아온다.
 * 기록 옮기기·자세한 고치기는 일별 기록 탭.
 * DB 추가 입구는 목록 위 「＋ DB 추가」 하나(+ 빈 목록 안내) — 이 패널엔 따로 두지 않는다(2026-11-10 belie 「추천대로」).
 * 현수막은 한 번에 여러 장 붙이므로 게시 수를 칸에 바로 적는다(−/＋ 는 미세 조정, belie 2026-11-08).
 * PC 닫힘 카드는 오른쪽 아래 「오늘 챙길 일」 버튼과 겹치지 않게 그 왼쪽에 두고, 그 창을 열면 창 왼쪽으로 비켜 준다(.ta-pc-card, db-sheet.css).
 */
import Link from "next/link";
import { useEffect, useRef, useState, type TouchEvent as RTouchEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus } from "lucide-react";
import { CHANNEL_ORDER, type Channel } from "@/types";
import ChannelBadge from "@/components/ui/ChannelBadge";
import { useDay, useSaveMetrics } from "@/query/contact-hooks";
import { addDays, todayKST } from "@/util/week";

const STEPS = [["production", "생산"], ["inflow", "유입"], ["contactProgress", "컨택"], ["meetingReservation", "미팅"]] as const;
type Key = (typeof STEPS)[number][0];
const shiftDay = (iso: string, n: number) => addDays(new Date(`${iso}T12:00:00+09:00`), n).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const dayLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${iso}T12:00:00+09:00`));

export function TodayActivity() {
  const today = todayKST();
  // 오늘 기록은 띠·카드와 「못 읽는 계정이면 숨기기」 판단에, 보고 있는 날(date)은 펼친 내용에 쓴다. 같은 날이면 같은 캐시.
  const todayQ = useDay(today);
  const [date, setDate] = useState(today);
  const day = useDay(date);
  const isToday = date === today;
  const save = useSaveMetrics({ silent: true });
  const [open, setOpenRaw] = useState(false), [error, setError] = useState("");
  const setOpen = (v: boolean) => { setOpenRaw(v); if (!v) { setDate(todayKST()); setError(""); } };
  const goDay = (n: number) => { const next = shiftDay(date, n); if (next <= today) { setDate(next); setError(""); setDraft(null); } };
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
  const ch = day.isError ? undefined : day.data?.channels;
  const todayCh = todayQ.data?.channels;
  const todayTotal = (k: Key) => todayCh ? CHANNEL_ORDER.reduce((n, c) => n + (todayCh[c]?.[k] ?? 0), 0) : null;
  const total = (k: Key) => ch ? CHANNEL_ORDER.reduce((n, c) => n + (ch[c]?.[k] ?? 0), 0) : null;
  const banner = ch?.현수막;
  const activeChannels = ch ? CHANNEL_ORDER.filter(c => STEPS.some(([k]) => (ch[c]?.[k] ?? 0) > 0)) : [];
  const stock = day.data ? Math.max(0, day.data.bannerStockBase - (banner?.production ?? 0)) : null;
  // 현수막을 산 적이 없으면 현수막 게시 칸·버튼을 뺀다. 재고 base 는 오늘 게시를 더한 값이라 구매 수로 본다(belie 2026-11-08).
  const showBanner = !!banner && !!day.data && (day.data.bannerOrderQty ?? 0) > 0;
  // 매입DB 유입대기 = 산 DB 중 아직 유입 안 된 수(일별 기록과 같은 셈, belie 2026-11-08). 매입DB 를 산 적이 있을 때만.
  const buy = ch?.매입DB;
  const inflowWait = day.data && buy ? Math.max(0, day.data.inflowWaitBase - buy.inflow) : null;
  const showWait = inflowWait !== null && (inflowWait > 0 || (buy?.production ?? 0) > 0);

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
    // 산 장수보다 많이 붙일 수는 없다 — 늘릴 때만 막고, 줄이는 건 언제나 된다.
    const max = day.data?.bannerStockBase ?? 0;
    if (next > banner.production && next > max) { setError(`재고가 ${Math.max(0, max - banner.production)}개뿐이에요. 산 현수막을 먼저 적어 주세요.`); return; }
    setError("");
    try { await save.mutateAsync({ date, channels: { 현수막: { ...banner, production: next } } as Record<Channel, typeof banner> }); }
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
  const funnel = (row: boolean, viewed = false) => { const num = (k: Key) => { const v = viewed ? total(k) : todayTotal(k); return v === null ? "–" : String(v); };
  return <ol className={row ? "flex items-center gap-1" : "grid gap-1"} aria-label={viewed && !isToday ? `${dayLabel(date)} 숫자` : "오늘 숫자"}>
    {STEPS.map(([k, label], i) => <li key={k} className={`flex flex-1 items-center gap-1 rounded-lg ${row ? "justify-center px-1 py-1.5" : "justify-between px-3 py-2"} ${i === 3 ? "bg-emerald-50" : "bg-slate-50"}`}>
      {row ? <><b className={`text-base tabular-nums ${i === 3 ? "text-emerald-700" : "text-slate-900"}`}>{num(k)}</b><span className="text-xs text-slate-500">{label}</span></>
        : <><span className="text-sm text-slate-600">{label}</span><b className={`text-lg tabular-nums ${i === 3 ? "text-emerald-700" : "text-slate-900"}`}>{num(k)}</b></>}
    </li>)}
  </ol>; };
  const chips = (column: boolean) => <div className={column ? "flex flex-col gap-1.5" : "flex gap-1.5"}>
    <button type="button" className={`rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ${column ? "rounded-lg py-2 text-left" : "shrink-0"}`} onClick={openBanner}>＋ 현수막 게시{stock !== null && <span className="ml-1 text-xs font-normal tabular-nums text-slate-500">재고 {stock}</span>}</button>
  </div>;

  const head = <div {...swipe("down", () => setOpen(false))} className="relative flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3">
    <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 pc:hidden" />
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800">STEP 2</span>
        <h2 className="text-base font-bold text-slate-900">{isToday ? "오늘 활동" : "지난 활동"}</h2>
      </div>
      {/* 날짜 넘기기 — 오늘보다 뒤로는 못 간다. 지난 날이면 「오늘로」 */}
      <div className="mt-1.5 flex items-center gap-1" role="group" aria-label="날짜 넘기기">
        <button type="button" aria-label="하루 전" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" onClick={() => goDay(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className={`min-w-[7.5em] text-center text-sm font-semibold tabular-nums ${isToday ? "text-slate-700" : "text-emerald-800"}`} aria-live="polite">{dayLabel(date)}</span>
        <button type="button" aria-label="하루 뒤" disabled={isToday} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent" onClick={() => goDay(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        {!isToday && <button type="button" className="ml-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200" onClick={() => { setDate(today); setError(""); setDraft(null); }}>오늘로</button>}
      </div>
      <p className="mt-1 break-keep text-xs text-slate-500">DB 목록에서 한 일은 저절로 세져요.{showBanner && " 목록에 없는 활동만 여기서 더해요."}</p>
    </div>
    <button type="button" aria-label="오늘 활동 닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)}>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
  </div>;

  const body = <section aria-label="오늘 활동" className="flex h-full flex-col bg-white pc:h-auto pc:max-h-[min(78dvh,720px)]">
    {head}
    <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 transition-opacity ${day.isPlaceholderData ? "opacity-50" : ""}`} aria-busy={day.isPlaceholderData}>
      {day.isError ? <p role="alert" className="rounded-lg bg-slate-50 px-3 py-3 text-center text-sm text-slate-500">{dayLabel(date)} 기록을 읽지 못했어요. 기수 기간 밖이면 기록이 없어요.</p> : <>
      {funnel(true, true)}
      {/* 네 칸이 모두 0인 채널은 뺀다(belie 2026-11-08). 다 0이면 한 줄 안내 */}
      {ch && !activeChannels.length ? <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-center text-sm text-slate-500">{isToday ? "아직 오늘 기록이 없어요" : "이날은 기록이 없어요"}</p> :
      <table className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-center text-sm">
        <caption className="sr-only">채널별 {isToday ? "오늘" : dayLabel(date)} 숫자</caption>
        <thead><tr className="text-xs text-slate-500"><th className="w-[34%] text-left font-medium">채널</th>{STEPS.map(([k, l]) => <th key={k} className="font-medium">{l}</th>)}</tr></thead>
        <tbody>{(ch ? activeChannels : CHANNEL_ORDER).map(c => <tr key={c}><td className="text-left"><ChannelBadge channel={c} /></td>{STEPS.map(([k]) => <td key={k} className="tabular-nums text-slate-700">{ch ? ch[c]?.[k] ?? 0 : "–"}</td>)}</tr>)}</tbody>
      </table>}
      {showWait && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><ChannelBadge channel="매입DB" /><span className="text-sm font-semibold text-slate-800">유입대기</span></div>
          <div className="mt-0.5 text-xs text-slate-500">산 DB 중 아직 유입 안 된 수</div>
        </div>
        <b className="shrink-0 text-lg tabular-nums text-slate-900">{inflowWait}<span className="ml-0.5 text-sm font-medium text-slate-500">개</span></b>
      </div>}
      {showBanner && <>
      <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">목록에 없는 활동</p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><ChannelBadge channel="현수막" /><span className="text-sm font-semibold text-slate-800">게시</span>
            {stock !== null && <span className={`rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-slate-200 ${stock === 0 ? "text-red-700" : "text-slate-700"}`}>재고 {stock}개</span>}</div>
          <div className="mt-0.5 text-xs text-slate-500">{isToday ? "오늘" : "그날"} 붙인 장수를 적어요</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="현수막 게시 빼기" disabled={!banner || !banner.production || save.isPending} onClick={() => void bump(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 disabled:opacity-40"><Minus size={18} aria-hidden="true" /></button>
          <input ref={bannerInput} type="text" inputMode="numeric" aria-label={`${isToday ? "오늘" : dayLabel(date)} 현수막 게시 수`} disabled={!banner || save.isPending}
            className="h-10 w-16 rounded-lg border border-slate-300 bg-white text-center text-lg font-bold tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100"
            value={draft ?? (banner ? String(banner.production) : "–")}
            onFocus={e => { setDraft(banner ? String(banner.production) : ""); e.currentTarget.select(); }}
            onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            onBlur={commitDraft}
            onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } else if (e.key === "Escape") { e.stopPropagation(); cancelDraft.current = true; e.currentTarget.blur(); } }} />
          {[1, 5, 10].map(n => <button key={n} type="button" aria-label={`현수막 게시 ${n}장 더하기`} disabled={!banner || save.isPending} onClick={() => void bump(n)} className="flex h-10 min-w-10 items-center justify-center rounded-full bg-emerald-700 px-2 text-sm font-bold tabular-nums text-white disabled:opacity-40">＋{n}</button>)}
        </div>
      </div>
      </>}
      <p className="mt-2 break-keep text-xs text-slate-500">현수막 문의·지인 소개·콜드콜도 「＋ DB 추가」로 목록에 올리면 유입·컨택·미팅이 저절로 더해져요.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </>}
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
      <Link href="/contact" className="text-sm font-semibold text-emerald-700">일별 기록에서 고치기 →</Link>
    </div>
  </section>;

  if (todayQ.isError) return null; // 일별 기록을 못 읽는 계정(시트 없음 등)은 패널 없이 목록만
  return <>
    {/* 펼치면 위 머리줄(z-50)·메뉴(55·56)보다 위, 대화상자(200)보다 아래. */}
    {open && <div aria-hidden="true" className="ta-scrim fixed inset-0 z-[60] bg-slate-900/25 pc:bg-slate-900/10" onClick={() => setOpen(false)} />}
    {/* 펼침 — 폰·태블릿은 아래에서 반쯤, PC 는 닫힘 카드 자리(오른쪽 아래, 오른쪽 끝 같음)에서 커진 카드. 한 벌만 그린다. */}
    {open && <div className="ta-sheet fixed inset-x-0 bottom-0 z-[61] h-[60dvh] overflow-hidden rounded-t-2xl shadow-2xl pc:left-auto pc:right-[calc(96px+env(safe-area-inset-right,0px))] pc:h-auto pc:w-[min(480px,calc(100vw-128px))] pc:border-x pc:border-t pc:border-slate-200">{body}</div>}
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
          {showBanner && <div className="mt-2 overflow-x-auto">{chips(false)}</div>}
        </section>
      </div>
      {/* PC 중간 폭(1024~1599px): 표를 덮지 않게 숫자만 한 줄 띠. 목록은 띠 높이만큼 위에서 끝난다(db-sheet.css). */}
      <div className="ta-pc-card ta-pc-pill fixed bottom-0 right-[calc(96px+env(safe-area-inset-right,0px))] z-40 hidden">
        <section aria-label="오늘 활동" className="flex cursor-pointer items-center gap-3 rounded-t-xl border-x border-t border-slate-200 bg-white py-1.5 pl-4 pr-2 shadow-lg" onClick={() => setOpen(true)}>
          <span className="shrink-0 text-sm font-bold text-slate-900">오늘 활동</span>
          <div className="w-72">{funnel(true)}</div>
          <button type="button" aria-expanded={false} className="flex h-9 shrink-0 items-center gap-0.5 rounded-full px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={e => { e.stopPropagation(); setOpen(true); }}>펼치기<ChevronUp size={14} aria-hidden="true" /></button>
        </section>
      </div>
      <div className="ta-pc-card ta-pc-full fixed bottom-0 right-[calc(96px+env(safe-area-inset-right,0px))] z-40 hidden w-72 pc:block">
        <section aria-label="오늘 활동" className="rounded-t-2xl border-x border-t border-slate-200 bg-white px-4 pb-4 pt-3 shadow-lg">
          <button type="button" aria-expanded={false} className="flex w-full items-center justify-between" onClick={() => setOpen(true)}>
            <span className="text-left"><span className="block text-sm font-bold text-slate-900">오늘 활동</span><span className="text-xs text-slate-500">{dayLabel(today)}</span></span>
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700">펼치기<ChevronUp size={14} aria-hidden="true" /></span>
          </button>
          <div className="mt-3">{funnel(false)}</div>
          {showBanner && <div className="mt-3">{chips(true)}</div>}
        </section>
      </div>
    </>}
  </>;
}
