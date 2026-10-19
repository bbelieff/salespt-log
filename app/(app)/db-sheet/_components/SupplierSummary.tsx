"use client";
/**
 * SupplierSummary — DB관리시트 「공급처별 성과」(유입 경로 #10). 공급처마다 들어온 DB → 상담 → 미팅 → 계약을 한 줄로.
 * 계산은 supplier-summary.ts(순수 함수). 줄을 누르면 기존 공급처 필터(onSelect)가 바뀌고 아래 목록이 그 공급처만 남는다.
 * PC(pc: 1024px~) 표 · 모바일 카드. 정본: docs/design/components.md「DB관리시트」.
 */
import { useMemo, useState, type ReactNode } from "react";
import ChannelBadge from "@/components/ui/ChannelBadge";
import type { DbSheetLead } from "@/types/db-sheet";
import {
  SUPPLIER_MIN_SAMPLE, SUPPLIER_TOP_LIMIT, headlineText, pct, periodLabel, summarizeSuppliers, visibleSupplierRows,
  type SupplierHeadline, type SupplierRow,
} from "./supplier-summary";

type Props = {
  leads: DbSheetLead[]; from: string; to: string; selected: string; selectedSuppliers?: readonly string[]; loading: boolean; error: string;
  onSelect(supplier: string): void; onImport(): void; onResetRange(): void; onClose(): void;
};
/** supplier = 누를 수 있는 공급처 줄 · blank = 공급처 미입력(못 누름) · total = 합계(누르면 필터 해제). */
type Kind = "supplier" | "blank" | "total";

const SMALL_SAMPLE = `들어온 DB가 ${SUPPLIER_MIN_SAMPLE}건 미만이라 비율이 크게 흔들릴 수 있어요`;
const TITLE: Record<Kind, string | undefined> = { supplier: undefined, blank: "공급처를 적으면 따로 비교할 수 있어요", total: "전체 공급처 보기" };
// 막대 색 = 그 공급처 채널색(매입DB 파랑 · 직접생산 초록, tokens.md 고정 4색). 여러 채널이 섞이면 회색.
const BAR_TONE: Record<DbSheetLead["channel"] | "mixed", readonly [string, string, string]> = {
  매입DB: ["bg-blue-500", "bg-blue-600", "bg-blue-700"],
  직접생산: ["bg-green-500", "bg-green-600", "bg-green-700"],
  현수막: ["bg-amber-500", "bg-amber-600", "bg-amber-700"],
  "콜·지·기·소": ["bg-purple-500", "bg-purple-600", "bg-purple-700"],
  mixed: ["bg-slate-500", "bg-slate-600", "bg-slate-700"],
};
const HEAD = "px-2 py-2 text-left font-semibold";
const CARD = "sheet-supplier-card block min-h-11 w-full rounded-xl border border-slate-200 p-3 text-left";
const CARD_BG: Record<Kind, string> = { supplier: "bg-white", blank: "bg-white", total: "bg-slate-100" };

type MetricKey = 'total'|'consulted'|'meetings'|'contracts';
const METRIC_LABEL:Record<MetricKey,string>={total:'들어온 DB',consulted:'상담',meetings:'미팅',contracts:'계약'};
function Metric({row,metric,best=false,showLabel=false}:{row:SupplierRow;metric:MetricKey;best?:boolean;showLabel?:boolean}){
 const n=row[metric],ratio=pct(n,row.total),tone=BAR_TONE[row.channels.length===1?row.channels[0]!:'mixed'];
 return <span className="supplier-metric" data-metric={metric} title={`${METRIC_LABEL[metric]} ${n}건 · 유입 대비 ${ratio}`}>
  {showLabel&&<span className="supplier-metric-label">{METRIC_LABEL[metric]}</span>}
  <span className="supplier-metric-values"><strong>{n}<small>건</small></strong>
   {metric==='contracts'?<Rate row={row} best={best} className="supplier-metric-rate"/>:metric==='total'?<span className="supplier-metric-rate">{row.untouched>0?`미연락 ${row.untouched}`:'100%'}</span>:<span className="supplier-metric-rate">{ratio}</span>}
  </span>
  <span className="supplier-metric-track" aria-hidden="true"><span className={tone[metric==='contracts'?2:metric==='meetings'?1:0]} style={{width:`${row.total?n/row.total*100:0}%`}}/></span>
 </span>;
}

function Name({ row, kind, selected = false }: { row: SupplierRow; kind: Kind; selected?: boolean }) {
  const tone = kind === "supplier" ? "font-semibold text-slate-800" : kind === "total" ? "font-bold text-slate-800" : "text-slate-600";
  const mixed = kind !== "total" && row.channels.length > 1;
  return <span className="block min-w-0">
    <span className="flex min-w-0 items-start gap-1.5">
      {mixed
        ? <span className="shrink-0 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-px-10 font-medium text-slate-700"
            aria-label={`채널 ${row.channels.length}개: ${row.channels.join(", ")}`} title={row.channels.join(" · ")}>{row.channels.length}채널</span>
        : kind !== "total" && <span className="shrink-0"><ChannelBadge channel={row.channels[0]!} /></span>}
      <span className={`min-w-0 break-words ${tone}`}>{row.label}</span>
    </span>
    {mixed && (selected || kind === "blank") && <span className="mt-1 flex flex-wrap gap-1" aria-label="공급처의 전체 채널">
      {row.channels.map(channel => <ChannelBadge key={channel} channel={channel} />)}
    </span>}
  </span>;
}

function Rate({ row, best, className }: { row: SupplierRow; best: boolean; className: string }) {
  const small = row.total < SUPPLIER_MIN_SAMPLE;
  return <span className={`${className} text-slate-800`} title={small ? SMALL_SAMPLE : undefined}>
    {best && <span className="supplier-rate-rank mr-1 inline-block rounded bg-slate-800 px-1 py-0.5 align-middle text-px-10 font-bold leading-none text-white">1위</span>}
    {pct(row.contracts, row.total)}
  </span>;
}


type RowProps = { row: SupplierRow; kind: Kind; best?: boolean; selected?: boolean; onToggle?: () => void };

function TableRow({ row, kind, best = false, selected = false, onToggle }: RowProps) {
  return <tr data-selected={selected || undefined} title={TITLE[kind]} onClick={onToggle}
    className={`border-t border-slate-200 ${kind === "total" ? "bg-slate-50" : ""} ${onToggle ? "cursor-pointer hover:bg-slate-50" : ""}`}>
    <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-normal">
      {/* 키보드·낭독용 버튼. 클릭은 줄 전체(tr onClick) 한 곳에서 받는다 — 버튼을 눌러도 그리로 올라간다. */}
      {onToggle
        ? <button type="button" aria-pressed={kind === "supplier" ? selected : undefined} className="block w-full text-left"><Name row={row} kind={kind} selected={selected} /></button>
        : <Name row={row} kind={kind} />}
    </th>
    {(['total','consulted','meetings','contracts'] as const).map(metric=><td key={metric} className="px-2 py-2 align-top"><Metric row={row} metric={metric} best={best}/></td>)}
  </tr>;
}

function Card({ row, kind, best = false, selected = false, onToggle }: RowProps) {
  const body = <>
    <Name row={row} kind={kind} selected={selected}/>
    <span className="supplier-mobile-metrics">{(['total','consulted','meetings','contracts'] as const).map(metric=><Metric key={metric} row={row} metric={metric} best={best} showLabel/>)}</span>
  </>;
  const className = `${CARD} ${CARD_BG[kind]}`;
  return <li>{onToggle
    ? <button type="button" aria-pressed={kind === "supplier" ? selected : undefined} title={TITLE[kind]} className={className} onClick={onToggle}>{body}</button>
    : <div className={className} title={TITLE[kind]}>{body}</div>}</li>;
}

function Headline({ headline }: { headline: SupplierHeadline }) {
  return <p aria-live="polite" aria-label={headlineText(headline)} className="supplier-performance-headline text-slate-700">
    {headline.before}{headline.name !== undefined && <>‘<strong className="font-bold text-slate-900">{headline.name}</strong>’</>}{headline.after}
  </p>;
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">{children}</div>;
}

export function SupplierSummary({ leads, from, to, selected, selectedSuppliers, loading, error, onSelect, onImport, onResetRange, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => summarizeSuppliers(leads, { from, to }), [leads, from, to]);
  const selection = selectedSuppliers ?? (selected ? [selected] : []);
  const visible = visibleSupplierRows(summary.rows, selected, expanded);
  const extra = summary.rows.filter(row => !!row.supplier && selection.includes(row.supplier) && !visible.shown.includes(row));
  const shown = [...visible.shown, ...extra], blank = visible.blank, hidden = Math.max(0, visible.hidden - extra.length);
  const named = summary.rows.length - (blank ? 1 : 0);
  const rowProps = (row: SupplierRow): RowProps => ({
    row, kind: "supplier", best: row.supplier === summary.best, selected: selection.includes(row.supplier),
    onToggle: () => onSelect(selectedSuppliers ? row.supplier : row.supplier === selected ? "" : row.supplier),
  });
  const totalProps: RowProps = { row: summary.total, kind: "total", onToggle: () => onSelect("") };
  let body: ReactNode;
  if (loading) body = <p className="mt-2 text-sm text-slate-500">불러오는 중…</p>;
  // 첫 조회가 실패하면 leads 가 비어 있다 — 「DB가 없어요 · 가져오기」를 보이면 이미 있는 DB를 또 가져오게 된다.
  else if (!leads.length && error) body = <Notice><span>공급처 요약을 불러오지 못했어요. 새로고침해 주세요.</span></Notice>;
  else if (!leads.length) body = <Notice><span>아직 DB가 없어요. DB를 가져오면 공급처별로 상담·미팅·계약을 비교해 드려요.</span><button type="button" className="sheet-btn primary" onClick={onImport}>DB 가져오기</button></Notice>;
  else if (!summary.total.total) body = <Notice><span>이 유입 기간에 들어온 DB가 없어요.</span><button type="button" className="sheet-btn" onClick={onResetRange}>기간 초기화</button></Notice>;
  else body = <>
    <div className="mt-2 hidden overflow-hidden rounded-xl border border-slate-200 bg-white pc:block">
      <table className="supplier-performance-table w-full text-xs tabular-nums">
        <caption className="sr-only">공급처별 들어온 DB · 상담 · 미팅 · 계약</caption>
        <thead><tr className="text-px-11 text-slate-700">
          <th scope="col" className="py-2 pl-3 pr-2 text-left font-semibold">공급처</th>
          <th scope="col" className={HEAD}>들어온 DB</th>
          <th scope="col" className={HEAD} title="컨택진행·상담 후 거절 이력이 있는 DB">상담</th>
          <th scope="col" className={HEAD} title="미팅을 잡은 DB (취소·삭제 제외)">미팅</th>
          <th scope="col" className={`${HEAD} pr-3`} title="계약한 DB (해지 제외) · 계약률 = 계약 ÷ 들어온 DB">계약 · 계약률</th>
        </tr></thead>
        <tbody>
          {shown.map(row => <TableRow key={row.supplier} {...rowProps(row)} />)}
          {blank && <TableRow row={blank} kind="blank" />}
        </tbody>
        <tfoot><TableRow {...totalProps} /></tfoot>
      </table>
    </div>
    <ul className="mt-3 flex flex-col gap-2 pc:hidden">
      {shown.map(row => <Card key={row.supplier} {...rowProps(row)} />)}
      {blank && <Card row={blank} kind="blank" />}
      <Card {...totalProps} />
    </ul>
    {named > SUPPLIER_TOP_LIMIT && (expanded || hidden > 0) && <button type="button" className="sheet-text-btn mt-1" onClick={() => setExpanded(!expanded)}>{expanded ? "접기" : `나머지 ${hidden}곳 더 보기`}</button>}
  </>;
  return <section id="db-supplier-summary" aria-label="공급처별 성과" className="sheet-supplier-summary">
    <div className="supplier-performance-head flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-bold text-slate-800">공급처별 성과</h3>
      <span className="rounded-full border border-slate-200 bg-white px-2 text-px-11 text-slate-600">{periodLabel(from, to)}</span>
      {!loading&&leads.length>0&&summary.total.total>0&&<Headline headline={summary.headline}/>}
      <button type="button" className="sheet-text-btn ml-auto" onClick={onClose}>닫기</button>
    </div>
    {body}
  </section>;
}
