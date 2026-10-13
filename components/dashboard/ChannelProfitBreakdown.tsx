"use client";

/**
 * ChannelProfitBreakdown — 영업이익 상세 패널 안 「채널별 남은 돈」(2026-10-12 #7).
 *
 * SSOT: docs/design/components.md §9-2. 표시만 한다 — 계산은 ./channel-profit, 기간은 DashboardFinance.
 *  - 4채널 줄은 채널 순서 고정(매입DB→직접생산→현수막→콜·지·기·소). 문장이 고른 채널 줄만 bg-blue-50.
 *  - 「영업기록 없음 ›」(manual 계약) → /payment 에서 영업기록 연결. 「채널 모름」·「확인 중」은 설명만.
 *  - 「추가 비용 ›」 → 같은 페이지 비용 원장(onOpenExpenseLedger). 못 읽었으면 「확인 못 했어요」,
 *    합계 비용에서 빠진다(위 비용 칸과 같은 규칙 — 0원으로 지어내지 않는다).
 *  - 합계 줄 = 위 세 칸(매출·비용·영업이익)과 원 단위까지 같은 값. 칸 숫자는 만원 반올림,
 *    전체 금액은 title·화면 읽기 글자로 함께 둔다.
 * 패널은 칸 버튼의 형제라 이 안의 버튼·링크가 버튼 안에 들어가지 않는다.
 */
import Link from "next/link";
import { CH_COLOR } from "./ChannelPerformance";
import {
  channelHeadlineText,
  channelProfitHeadline,
  formatManShort,
  formatWonFull,
  hasActivity,
  type ChannelProfit,
  type ChannelProfitTable,
} from "./channel-profit";

interface Props {
  table: ChannelProfitTable;
  /** 매출 칸 값(기간). */
  revenue: number;
  /** 기간 DB 비용(세 채널 합). */
  dbCost: number;
  /** 기간 추가 비용(원장). null = 못 읽음. */
  additionalCost: number | null;
  onOpenExpenseLedger: () => void;
  /** 대시보드를 다시 불러오는 중 — 「확인 중」 줄 문구. */
  refreshing?: boolean;
}

const NUM = "whitespace-nowrap py-1 pl-1.5 text-right align-top";
// 굵기는 줄마다 따로 준다 — 같은 칸에 font-normal·font-bold 를 겹치면 CSS 순서로 normal 이 이긴다.
const NAME_BASE = "py-1 pr-1 text-left align-top";
const NAME = `${NAME_BASE} font-normal`;
const SUB = "block text-px-11 font-normal text-gray-400";
// 이름과 「계약 N건」을 한 덩어리로 세운다 — 누르는 자리(24px 이상)가 둘을 함께 덮고, 첫 줄이 숫자 칸과 나란하다.
const ACTION = "flex min-h-6 flex-col items-start break-keep rounded text-left font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2";

function Money({ won, tone = false, dashIfZero = false }: { won: number; tone?: boolean; dashIfZero?: boolean }) {
  if (dashIfZero && won === 0) return <Dash />;
  const color = tone ? (won < 0 ? "text-violet-600" : "text-blue-700") : "text-gray-700";
  const full = formatWonFull(won);
  return (
    <td className={`${NUM} ${color}`} title={full}>
      <span aria-hidden="true">{formatManShort(won)}</span>
      <span className="sr-only">{full}</span>
    </td>
  );
}

function Dash() {
  return (
    <td className={`${NUM} text-gray-400`}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">없음</span>
    </td>
  );
}

function Count({ n, indent = false }: { n: number; indent?: boolean }) {
  return <span className={indent ? `${SUB} pl-4` : SUB}>계약 {n}건</span>;
}

export default function ChannelProfitBreakdown({ table, revenue, dbCost, additionalCost, onOpenExpenseLedger, refreshing = false }: Props) {
  const headline = channelProfitHeadline(table, { revenue, dbCost, additional: additionalCost });
  const text = <p className="mt-2 text-sm font-bold text-slate-800">{channelHeadlineText(headline)}</p>;
  if (headline.kind === "empty") return text;

  const cost = dbCost + (additionalCost ?? 0); // 비용 칸과 같은 규칙
  const best = headline.kind === "best" ? headline.channel : null;
  const extras: Array<{ bucket: ChannelProfit; label: string }> = [];
  if (hasActivity(table.manual)) extras.push({ bucket: table.manual, label: "manual" });
  if (hasActivity(table.unknown)) extras.push({ bucket: table.unknown, label: "unknown" });
  if (hasActivity(table.pending)) extras.push({ bucket: table.pending, label: "pending" });
  const showExtraCost = additionalCost !== 0;
  const firstSeparated = extras.length > 0 ? extras[0]!.label : showExtraCost ? "extra" : null;
  const sep = (label: string) => (label === firstSeparated ? "border-t border-slate-200" : "");

  return (
    <div>
      {text}
      <table data-testid="fin-channel-profit" className="mt-1 w-full text-xs tabular-nums pc:max-w-lg">
        <caption className="sr-only">채널별 남은 돈</caption>
        <thead>
          <tr className="text-gray-400">
            <th scope="col" className="pb-0.5 text-left font-medium">채널</th>
            <th scope="col" className="pb-0.5 pl-1.5 text-right font-medium">매출</th>
            <th scope="col" className="pb-0.5 pl-1.5 text-right font-medium">비용</th>
            <th scope="col" className="pb-0.5 pl-1.5 text-right font-medium">남은 돈</th>
          </tr>
        </thead>
        <tbody>
          {table.channels.map((c) => (
            <tr key={c.key} data-channel={c.key} className={`border-t border-slate-100 ${best === c.key ? "bg-blue-50" : ""}`}>
              <th scope="row" className={NAME}>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CH_COLOR[c.key] }} />
                  <span className="break-keep font-semibold text-gray-700">{c.key}</span>
                </span>
                <Count n={c.contracts} indent />
              </th>
              <Money won={c.revenue} />
              <Money won={c.cost} dashIfZero />
              <Money won={c.left} tone />
            </tr>
          ))}
          {extras.map(({ bucket, label }) => (
            <tr key={label} data-row={label} className={sep(label)}>
              <th scope="row" className={NAME}>
                {label === "manual" ? (
                  <Link
                    href="/payment"
                    aria-label="영업기록 없이 추가한 계약: 실무/수납에서 영업기록 연결하기"
                    className={`${ACTION} hover:text-blue-700 focus-visible:ring-blue-500`}
                  >
                    <span>영업기록 없음 ›</span>
                    <Count n={bucket.contracts} />
                  </Link>
                ) : (
                  <span title={label === "unknown" ? "영업기록과 이어지지 않은 계약이에요(예: 이전 계약 직접등록)" : "방금 바뀐 계약이라 채널을 다시 맞춰 보고 있어요"}>
                    <span className="break-keep font-semibold text-slate-600">
                      {label === "unknown" ? "채널 모름" : refreshing ? "확인 중…" : "확인 못 함"}
                    </span>
                    <Count n={bucket.contracts} />
                  </span>
                )}
              </th>
              <Money won={bucket.revenue} />
              <Dash />
              <Money won={bucket.left} tone />
            </tr>
          ))}
          {showExtraCost && (
            <tr data-row="extra" className={sep("extra")}>
              <th scope="row" className={NAME}>
                <button
                  type="button"
                  onClick={onOpenExpenseLedger}
                  aria-label="추가 비용(채널에 안 나눈 비용): 비용 원장 열기"
                  className={`${ACTION} hover:text-red-600 focus-visible:ring-red-500`}
                >
                  추가 비용 ›
                </button>
              </th>
              <Dash />
              {additionalCost === null ? (
                <td className="break-keep py-1 pl-1.5 text-right align-top text-amber-700">확인 못 했어요</td>
              ) : (
                <Money won={additionalCost} />
              )}
              {additionalCost === null ? <Dash /> : <Money won={-additionalCost} tone />}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr data-row="total" className="border-t-2 border-slate-200 font-bold">
            <th scope="row" className={`${NAME_BASE} font-bold text-slate-800`}>영업이익</th>
            <Money won={revenue} />
            <Money won={cost} />
            <Money won={revenue - cost} tone />
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 break-keep text-px-11 text-gray-400">추가 비용은 채널에 나누지 않았어요 · 만원 단위로 반올림했어요</p>
      {hasActivity(table.unknown) && (
        <p className="break-keep text-px-11 text-gray-400">채널 모름: 영업기록과 이어지지 않은 계약이에요(예: 이전 계약 직접등록)</p>
      )}
      {hasActivity(table.pending) && (
        <p className="break-keep text-px-11 text-gray-400">
          {refreshing ? "확인 중: 방금 바뀐 계약이라 채널을 다시 맞춰 보고 있어요" : "확인 못 함: 새로고침하면 채널을 다시 맞춰 봐요"}
        </p>
      )}
    </div>
  );
}
