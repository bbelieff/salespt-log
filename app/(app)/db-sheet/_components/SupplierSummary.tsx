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
  leads: DbSheetLead[]; from: string; to: string; selected: string; loading: boolean; error: string;
  onSelect(supplier: string): void; onImport(): void; onResetRange(): void; onClose(): void;
};
/** supplier = 누를 수 있는 공급처 줄 · blank = 공급처 미입력(못 누름) · total = 합계(누르면 필터 해제). */
type Kind = "supplier" | "blank" | "total";

const SMALL_SAMPLE = `들어온 DB가 ${SUPPLIER_MIN_SAMPLE}건 미만이라 비율이 크게 흔들릴 수 있어요`;
const TITLE: Record<Kind, string | undefined> = { supplier: undefined, blank: "공급처를 적으면 따로 비교할 수 있어요", total: "전체 공급처 보기" };
// 막대 색 = 그 공급처 채널색(매입DB 파랑 · 직접생산 초록, tokens.md 고정 4색). 여러 채널이 섞이면 회색.
const BAR_TONE: Record<DbSheetLead["channel"] | "mixed", readonly [string, string, string]> = {
  매입DB: ["bg-blue-200", "bg-blue-400", "bg-blue-600"],
  직접생산: ["bg-green-200", "bg-green-400", "bg-green-600"],
  현수막: ["bg-amber-200", "bg-amber-400", "bg-amber-600"],
  "콜·지·기·소": ["bg-purple-200", "bg-purple-400", "bg-purple-600"],
  mixed: ["bg-slate-300", "bg-slate-500", "bg-slate-700"],
};
const HEAD = "px-2 py-2 text-right font-semibold";
const CARD = "sheet-supplier-card block min-h-11 w-full rounded-xl border border-slate-200 p-3 text-left";
const CARD_BG: Record<Kind, string> = { supplier: "bg-white", blank: "bg-white", total: "bg-slate-100" };

function FunnelBar({ row }: { row: SupplierRow }) {
  const tone = BAR_TONE[row.channels.length === 1 ? row.channels[0]! : "mixed"];
  const width = (n: number) => ({ width: `${row.total ? (n / row.total) * 100 : 0}%` });
  return <span className="relative mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
    <span className={`absolute inset-y-0 left-0 rounded-full ${tone[0]}`} style={width(row.consulted)} />
    <span className={`absolute inset-y-0 left-0 rounded-full ${tone[1]}`} style={width(row.meetings)} />
    <span className={`absolute inset-y-0 left-0 rounded-full ${tone[2]}`} style={width(row.contracts)} />
  </span>;
}

function Name({ row, kind }: { row: SupplierRow; kind: Kind }) {
  const tone = kind === "supplier" ? "font-semibold text-slate-800" : kind === "total" ? "font-bold text-slate-800" : "text-slate-500";
  return <span className="flex min-w-0 items-center gap-1.5">
    {kind !== "total" && row.channels.map(channel => <ChannelBadge key={channel} channel={channel} />)}
    <span className={`min-w-0 truncate ${tone}`}>{row.label}</span>
  </span>;
}

function Rate({ row, best, className }: { row: SupplierRow; best: boolean; className: string }) {
  const small = row.total < SUPPLIER_MIN_SAMPLE;
  return <span className={`${className} ${small ? "text-slate-400" : "text-slate-900"}`} title={small ? SMALL_SAMPLE : undefined}>
    {best && <span className="mr-1 inline-block rounded bg-slate-800 px-1 py-0.5 align-middle text-px-10 font-bold leading-none text-white">1위</span>}
    {pct(row.contracts, row.total)}
  </span>;
}

function Count({ n, total }: { n: number; total: number }) {
  return <td className="px-2 py-2 text-right align-top"><span className="block font-semibold text-slate-800">{n}</span><span className="block text-px-11 text-slate-400">{pct(n, total)}</span></td>;
}

type RowProps = { row: SupplierRow; kind: Kind; best?: boolean; selected?: boolean; onToggle?: () => void };

function TableRow({ row, kind, best = false, selected = false, onToggle }: RowProps) {
  return <tr data-selected={selected || undefined} title={TITLE[kind]} onClick={onToggle}
    className={`border-t border-slate-200 ${kind === "total" ? "bg-slate-50" : ""} ${onToggle ? "cursor-pointer hover:bg-slate-50" : ""}`}>
    <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-normal">
      {/* 키보드·낭독용 버튼. 클릭은 줄 전체(tr onClick) 한 곳에서 받는다 — 버튼을 눌러도 그리로 올라간다. */}
      {onToggle
        ? <button type="button" aria-pressed={kind === "supplier" ? selected : undefined} className="block w-full text-left"><Name row={row} kind={kind} /></button>
        : <Name row={row} kind={kind} />}
      <FunnelBar row={row} />
    </th>
    <td className="px-2 py-2 text-right align-top"><span className="block font-semibold text-slate-800">{row.total}</span>{row.untouched > 0 && <span className="block text-px-11 text-slate-400">미연락 {row.untouched}</span>}</td>
    <Count n={row.consulted} total={row.total} /><Count n={row.meetings} total={row.total} /><Count n={row.contracts} total={row.total} />
    <td className="py-2 pl-2 pr-3 text-right align-top"><Rate row={row} best={best} className="font-bold" /></td>
  </tr>;
}

function Card({ row, kind, best = false, selected = false, onToggle }: RowProps) {
  const body = <>
    <span className="flex items-center gap-2"><span className="min-w-0 flex-1"><Name row={row} kind={kind} /></span><Rate row={row} best={best} className="shrink-0 text-lg font-extrabold" /></span>
    <FunnelBar row={row} />
    <span className="mt-2 block text-xs text-slate-600">DB {row.total} · 상담 {row.consulted} · 미팅 {row.meetings} · 계약 {row.contracts}</span>
    {row.untouched > 0 && <span className="block text-px-11 text-slate-400">미연락 {row.untouched}</span>}
  </>;
  const className = `${CARD} ${CARD_BG[kind]}`;
  return <li>{onToggle
    ? <button type="button" aria-pressed={kind === "supplier" ? selected : undefined} title={TITLE[kind]} className={className} onClick={onToggle}>{body}</button>
    : <div className={className} title={TITLE[kind]}>{body}</div>}</li>;
}

function Headline({ headline }: { headline: SupplierHeadline }) {
  return <p aria-live="polite" aria-label={headlineText(headline)} className="mt-1 text-sm text-slate-700">
    {headline.before}{headline.name !== undefined && <>‘<strong className="font-bold text-slate-900">{headline.name}</strong>’</>}{headline.after}
  </p>;
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">{children}</div>;
}

export function SupplierSummary({ leads, from, to, selected, loading, error, onSelect, onImport, onResetRange, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => summarizeSuppliers(leads, { from, to }), [leads, from, to]);
  const { shown, blank, hidden } = visibleSupplierRows(summary.rows, selected, expanded);
  const named = summary.rows.length - (blank ? 1 : 0);
  const rowProps = (row: SupplierRow): RowProps => ({
    row, kind: "supplier", best: row.supplier === summary.best, selected: row.supplier === selected,
    onToggle: () => onSelect(row.supplier === selected ? "" : row.supplier),
  });
  const totalProps: RowProps = { row: summary.total, kind: "total", onToggle: () => onSelect("") };
  let body: ReactNode;
  if (loading) body = <p className="mt-2 text-sm text-slate-500">불러오는 중…</p>;
  // 첫 조회가 실패하면 leads 가 비어 있다 — 「DB가 없어요 · 가져오기」를 보이면 이미 있는 DB를 또 가져오게 된다.
  else if (!leads.length && error) body = <Notice><span>공급처 요약을 불러오지 못했어요. 새로고침해 주세요.</span></Notice>;
  else if (!leads.length) body = <Notice><span>아직 DB가 없어요. DB를 가져오면 공급처별로 상담·미팅·계약을 비교해 드려요.</span><button type="button" className="sheet-btn primary" onClick={onImport}>DB 가져오기</button></Notice>;
  else if (!summary.total.total) body = <Notice><span>이 유입 기간에 들어온 DB가 없어요.</span><button type="button" className="sheet-btn" onClick={onResetRange}>기간 초기화</button></Notice>;
  else body = <>
    <Headline headline={summary.headline} />
    <div className="mt-3 hidden overflow-hidden rounded-xl border border-slate-200 bg-white pc:block">
      <table className="w-full text-xs tabular-nums">
        <caption className="sr-only">공급처별 들어온 DB · 상담 · 미팅 · 계약</caption>
        <thead><tr className="text-px-11 text-slate-500">
          <th scope="col" className="py-2 pl-3 pr-2 text-left font-semibold">공급처</th>
          <th scope="col" className={HEAD}>들어온 DB</th>
          <th scope="col" className={HEAD} title="컨택진행·상담 후 거절 이력이 있는 DB">상담</th>
          <th scope="col" className={HEAD} title="미팅을 잡은 DB (취소·삭제 제외)">미팅</th>
          <th scope="col" className={HEAD} title="계약한 DB (해지 제외)">계약</th>
          <th scope="col" className={`${HEAD} pr-3`} title="계약 ÷ 들어온 DB">계약률</th>
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
    <details className="sheet-supplier-note"><summary>집계 기준</summary><p className="mt-2 text-px-11 leading-relaxed text-slate-400">
      상담 = 컨택진행·상담 후 거절 이력이 있는 DB · 미팅 = 잡은 미팅(취소·삭제 제외) · 계약 = 해지 제외 · 계약률 = 계약 ÷ 들어온 DB<br />
      DB관리시트에 들어온 DB만 세요. 컨택관리에 숫자로만 적은 실적은 빠져서 대시보드 숫자와 다를 수 있어요. 줄을 누르면 그 공급처 DB만 아래 목록에 보여요.
    </p></details>
  </>;
  return <section id="db-supplier-summary" aria-label="공급처별 성과" className="sheet-supplier-summary">
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-bold text-slate-800">공급처별 성과</h3>
      <span className="rounded-full border border-slate-200 bg-white px-2 text-px-11 text-slate-600">{periodLabel(from, to)}</span>
      <button type="button" className="sheet-text-btn ml-auto" onClick={onClose}>닫기</button>
    </div>
    {body}
  </section>;
}
