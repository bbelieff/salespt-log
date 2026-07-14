/** 채널 탭(4) + 채널별 4지표 입력 패널(6:4 그리드). 정본: prototypes/contact-daily-input.html v7 §2-2·§2-3. */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHANNEL_ORDER, type Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import { useDBOverview } from "@/query/db-hooks";
import { loadChannelOrder, moveChannel, saveChannelOrder } from "../_lib/channel-order";
import { CHANNEL_META } from "../_lib/channel-meta";


const COLOR_CLASS: Record<
  "blue" | "green" | "amber" | "purple",
  { bg50: string; bg100: string; bg500: string; text700: string; under: string; hover: string; border: string }
> = {
  blue: {
    bg50: "bg-blue-50",
    bg100: "bg-blue-100",
    bg500: "bg-blue-500",
    text700: "text-blue-700",
    under: "bg-blue-500",
    hover: "hover:bg-blue-600",
    border: "border-blue-200",
  },
  green: {
    bg50: "bg-green-50",
    bg100: "bg-green-100",
    bg500: "bg-green-500",
    text700: "text-green-700",
    under: "bg-green-500",
    hover: "hover:bg-green-600",
    border: "border-green-200",
  },
  amber: {
    bg50: "bg-amber-50",
    bg100: "bg-amber-100",
    bg500: "bg-amber-500",
    text700: "text-amber-700",
    under: "bg-amber-500",
    hover: "hover:bg-amber-600",
    border: "border-amber-200",
  },
  purple: {
    bg50: "bg-purple-50",
    bg100: "bg-purple-100",
    bg500: "bg-purple-500",
    text700: "text-purple-700",
    under: "bg-purple-500",
    hover: "hover:bg-purple-600",
    border: "border-purple-200",
  },
};

const METRICS: Array<{
  key: keyof ChannelDailyRowMetrics;
  label: string;
  upstream?: keyof ChannelDailyRowMetrics;
}> = [
  { key: "production", label: "생산" },
  { key: "inflow", label: "유입" },
  { key: "contactProgress", label: "컨택진행" },
  { key: "meetingReservation", label: "미팅예약", upstream: "contactProgress" },
];

interface Props {
  active: Channel;
  draft: Record<Channel, ChannelDailyRowMetrics>;
  /** 선택 날짜 (YYYY-MM-DD) — 생산 첫 행 읽기전용 파생값 계산용. */
  date: string;
  /** 매입DB 유입대기 base = 생산누적 − 유입누적 + 오늘 저장 유입. UI: max(0, base − draft.유입). */
  inflowWaitBase: number;
  /** 선택 날짜·활성 채널의 저장된 유입(F) — 직접생산 생산수 라이브 계산용(ADR-0024). */
  savedInflow: number;
  /** 현수막 재고 base = Σ주문장수 − Σ게시누적 + 오늘 저장 게시. UI: max(0, base − draft.게시)(ADR-0025). */
  bannerStockBase: number;
  onSelectChannel: (ch: Channel) => void;
  onStep: (key: keyof ChannelDailyRowMetrics, delta: number) => void;
  onSetVal: (key: keyof ChannelDailyRowMetrics, value: number) => void;
  /** 교차탭 이동 도착 시 잠깐 강조할 지표 행 (예: DB관리→컨택 시 "production"). */
  highlightKey?: keyof ChannelDailyRowMetrics;
}

// 합계·탭 배지는 유입~미팅예약만 (생산 첫 행은 합산 제외).
function totalOf(m: ChannelDailyRowMetrics): number {
  return m.inflow + m.contactProgress + m.meetingReservation;
}

const numF = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0) || 0;
const strF = (r: Record<string, unknown>, k: string) => String(r[k] ?? "");

/** 생산 첫 행 채널별 파생 표시(매입DB·콜). 직접생산·현수막은 별도 렌더. */
function firstRowText(
  ch: Channel,
  date: string,
  ov: import("@/service").DBOverview | undefined,
): string {
  if (!ov) return "—";
  if (ch === "매입DB") {
    const acc = ov.purchases
      .filter((p) => strF(p as never, "구매일") <= date)
      .reduce((s, p) => s + numF(p as never, "주문개수"), 0);
    return acc > 0 ? `구매 누적 ${acc}건` : "구매 기록 없음";
  }
  if (ch === "직접생산") {
    const live = ov.productions.filter(
      (p) => strF(p as never, "시작일") <= date && date <= strF(p as never, "종료일"),
    );
    return live.length > 0
      ? `생산기간 진행중 ${live.length}건`
      : "진행 중 기간 없음";
  }
  // 콜·지·기·소: 오늘 발굴(접수) 수 (현수막은 게시 스테퍼라 firstRowText 미사용).
  const n = ov.leads.filter((l) => strF(l as never, "접수일") === date).length;
  return `발굴 ${n}건`;
}

export default function ChannelTabsAndPanel({
  active,
  draft,
  date,
  inflowWaitBase,
  savedInflow,
  bannerStockBase,
  onSelectChannel,
  onStep,
  onSetVal,
  highlightKey,
}: Props) {
  const ch = CHANNEL_META[active];
  const cls = COLOR_CLASS[ch.color];
  const cell = draft[active];
  const overview = useDBOverview();
  // 현수막 재고(라이브) = max(0, base − 오늘 게시 draft). 0 이면 게시 + 클램프(ADR-0025).
  const bannerStock = Math.max(0, bannerStockBase - (cell?.production ?? 0));
  const firstRow =
    active === "매입DB"
      ? `유입대기 ${Math.max(0, inflowWaitBase - (cell?.inflow ?? 0))}건`
      : firstRowText(active, date, overview.data);

  // 콜·지·기·소 유입 표시값 = 오늘 발굴(접수) 수 = 생산(ADR-0029 파생). 생산 행 "발굴 N건"과 **동일 소스**.
  // 잠긴 행·오늘합계·탭 배지가 **모두 이 값**을 써야 화면이 "생산과 동일"을 실제로 지킨다(draft 는 저장 안 됨).
  // DBOverview 로딩 전엔 저장된 값(draft)으로 폴백 — 0 으로 단정 표시하면 생산 행("—")과 어긋난다.
  const leadInflow = overview.data
    ? overview.data.leads.filter((l) => strF(l as never, "접수일") === date).length
    : draft["콜·지·기·소"].inflow;

  // 직접생산: 선택 날짜 포함 활성 레코드(유일). 생산수 = 동기화 M ± 오늘 draft 라이브.
  const directProductions = overview.data?.productions ?? [];
  const directIdx = directProductions.findIndex(
    (p) => strF(p as never, "시작일") <= date && date <= strF(p as never, "종료일"),
  );
  const directActive = directIdx >= 0 ? directProductions[directIdx] : undefined;
  const directLiveCount = directActive
    ? Math.max(0, numF(directActive as never, "생산개수") - savedInflow + (cell?.inflow ?? 0))
    : 0;

  // 사용자별 채널 순서 (localStorage) — hydration mismatch 방지 위해 mount 후 적용.
  const [order, setOrder] = useState<Channel[]>(() => [...CHANNEL_ORDER]);
  const [dragFrom, setDragFrom] = useState<Channel | null>(null);
  const [dragOver, setDragOver] = useState<Channel | null>(null);

  useEffect(() => {
    setOrder(loadChannelOrder());
  }, []);

  const handleDrop = (target: Channel) => {
    if (!dragFrom || dragFrom === target) {
      setDragFrom(null);
      setDragOver(null);
      return;
    }
    const next = moveChannel(order, dragFrom, target);
    setOrder(next);
    saveChannelOrder(next);
    setDragFrom(null);
    setDragOver(null);
  };

  // 합계 계산은 순서 무관 — CHANNEL_ORDER로 4채널 모두 sum
  const channelSum = (key: keyof ChannelDailyRowMetrics): number =>
    CHANNEL_ORDER.reduce((acc, c) => acc + draft[c][key], 0);

  return (
    <div className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* 채널 탭 — 길게 누른 후 드래그하여 순서 변경 (자동 저장) */}
      <div className="flex border-b border-gray-100">
        {order.map((c) => {
          const meta = CHANNEL_META[c];
          const colorCls = COLOR_CLASS[meta.color];
          const isActive = c === active;
          // 배지도 유입 행·합계와 같은 값을 써야 한다(콜지기소 유입 = 라이브 파생, ADR-0029).
          const total =
            c === "콜·지·기·소"
              ? leadInflow + draft[c].contactProgress + draft[c].meetingReservation
              : totalOf(draft[c]);
          const isDragOver = dragOver === c && dragFrom !== c;
          const isDragging = dragFrom === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelectChannel(c)}
              draggable
              onDragStart={(e) => {
                setDragFrom(c);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", c);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== c) setDragOver(c);
              }}
              onDragLeave={() => {
                if (dragOver === c) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(c);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={`relative flex-1 px-1 py-2.5 transition-all ${
                isActive ? colorCls.bg50 : "bg-white hover:bg-gray-50"
              } ${isDragging ? "opacity-40" : ""} ${
                isDragOver ? "ring-2 ring-inset ring-blue-300" : ""
              }`}
              aria-pressed={isActive}
              aria-grabbed={isDragging}
              title="드래그하여 순서 변경"
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`text-xs font-bold ${
                    isActive ? colorCls.text700 : "text-gray-500"
                  }`}
                >
                  {c}
                </span>
                {total > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] font-semibold leading-none ${
                      isActive ? `${colorCls.bg100} ${colorCls.text700}` : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {total}
                  </span>
                ) : (
                  <span className="text-[11px] leading-none text-gray-300">·</span>
                )}
              </div>
              {isActive && (
                <span
                  className={`absolute bottom-[-1px] left-[12%] right-[12%] h-[3px] rounded-t-sm ${colorCls.under}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 채널 헤더 (배지 + 설명) */}
      <div className={`flex items-center gap-2 border-b ${cls.border} ${cls.bg50} px-3 py-2`}>
        <span className={ch.badgeClass}>{active}</span>
        <span className="break-keep text-xs text-gray-500">{ch.desc}</span>
      </div>

      {/* 입력 헤더 + 생산 첫 행 — 우측 '⭐ 오늘 합계' 제목 셀이 헤더+생산행 높이를 세로 병합 */}
      <div className="flex items-stretch border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500">채널 입력</div>
          <div className="border-t border-gray-100 px-3 py-3">
            {active === "직접생산" ? (
              directActive ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 pr-1">
                    <div className="truncate text-sm font-medium text-gray-800">
                      진행중 · 생산 #{directIdx + 1}
                      <span className="ml-1 text-gray-500">
                        ({strF(directActive as never, "소재") || "소재없음"})
                      </span>
                    </div>
                    <div className="break-keep text-xs text-gray-400">
                      {strF(directActive as never, "시작일")}~
                      {strF(directActive as never, "종료일")} ·{" "}
                      <Link href="/db?channel=직접생산" className="text-green-600 underline">
                        DB생산에서 보기
                      </Link>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num-mono text-sm font-bold text-green-700">
                      생산 {directLiveCount}건
                    </div>
                    <div className="text-[11px] text-gray-400">유입 집계</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-500">진행 중 생산 없음</span>
                  <Link
                    href="/db?channel=직접생산"
                    className="shrink-0 text-xs text-green-600 underline"
                  >
                    생산목록 추가
                  </Link>
                </div>
              )
            ) : active === "현수막" ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 pr-1">
                  <div className="text-sm font-medium text-gray-800">게시</div>
                  <div className="break-keep text-xs text-gray-400">현수막재고 {bannerStock}개</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="stepper-btn bg-gray-100 text-gray-600 hover:bg-gray-200"
                    onClick={() => onStep("production", -1)}
                    aria-label="게시 감소"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="stepper-val"
                    value={cell.production}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) onSetVal("production", Math.max(0, n));
                    }}
                    aria-label="게시 수치"
                  />
                  <button
                    type="button"
                    className={`stepper-btn ${
                      bannerStock <= 0
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : `${cls.bg500} text-white ${cls.hover}`
                    }`}
                    onClick={() => onStep("production", 1)}
                    aria-disabled={bannerStock <= 0 ? true : undefined}
                    aria-label="게시 증가"
                  >
                    ＋
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1 text-sm font-medium text-gray-800">
                    {active === "매입DB" ? "유입대기" : "생산"}
                    <span className="rounded bg-gray-100 px-1 py-px text-[11px] font-bold text-gray-500">
                      🔒 DB자동
                    </span>
                  </div>
                  <div className="line-clamp-2 break-keep text-xs text-gray-400">
                    {active === "매입DB"
                      ? "구매 누적 − 유입 누적 (유입할수록 감소)"
                      : "DB생산 탭에서 기록 · 자동 반영"}
                  </div>
                </div>
                <div className="shrink-0 num-mono text-sm font-semibold text-gray-700">
                  {firstRow}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* ⭐ 오늘합계 제목 셀 — 헤더+생산행에 걸쳐 세로 병합(슬림 80px). 한 줄·세로 가운데(상하 균등). */}
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-l-2 bg-indigo-100 px-1 text-center">
          <span className="whitespace-nowrap text-xs font-bold text-indigo-700">⭐ 오늘합계</span>
        </div>
      </div>

      {/* 유입·컨택진행·미팅예약 (스테퍼) — 좌 라벨+도움말·스테퍼, 우 오늘 합계(슬림 64px) */}
      {METRICS.filter((m) => m.key !== "production").map((m, mi, arr) => {
        // 유입 합계: 콜지기소 몫은 draft(저장 안 되는 값) 대신 라이브 파생값 leadInflow 로 대체(ADR-0029).
        const total =
          m.key === "inflow"
            ? CHANNEL_ORDER.reduce(
                (acc, c) => acc + (c === "콜·지·기·소" ? leadInflow : draft[c].inflow),
                0,
              )
            : channelSum(m.key);
        const upstreamVal = m.upstream ? cell[m.upstream] : Infinity;
        const atLimit = m.upstream && cell[m.key] >= upstreamVal;
        const plusClass = atLimit
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : `${cls.bg500} text-white ${cls.hover}`;
        const help = ch.helps[m.key as keyof typeof ch.helps];
        const isHighlight = highlightKey === m.key;
        // 콜·지·기·소 유입 = 생산(03 접수 건수) 파생 — 스테퍼 없이 🔒DB자동 (ADR-0029).
        const isLeadInflow = active === "콜·지·기·소" && m.key === "inflow";
        return (
          <div
            key={m.key}
            className={`flex items-stretch ${mi < arr.length - 1 ? "border-b border-gray-50" : ""} ${
              isHighlight ? "animate-pulse rounded-lg ring-2 ring-inset ring-blue-400" : ""
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3">
              {/* 라벨 + 보조 도움말(1줄 truncate — 공간은 합계·스테퍼 우선) */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-medium text-gray-800">
                  {m.label}
                  {isLeadInflow && (
                    <span className="rounded bg-gray-100 px-1 py-px text-[11px] font-bold text-gray-500">
                      🔒 DB자동
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-gray-400">
                  {isLeadInflow ? "생산과 동일 · 자동" : help}
                </div>
              </div>
              {isLeadInflow ? (
                /* 파생값 — 입력 불가. 생산 행("발굴 N건")과 같은 라이브 소스라 항상 생산과 일치. */
                <div className="shrink-0 num-mono text-sm font-semibold text-gray-700">
                  {leadInflow}
                </div>
              ) : (
                /* 스테퍼 */
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="stepper-btn bg-gray-100 text-gray-600 hover:bg-gray-200"
                    onClick={() => onStep(m.key, -1)}
                    aria-label={`${m.label} 감소`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="stepper-val"
                    value={cell[m.key]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) onSetVal(m.key, Math.max(0, n));
                    }}
                    aria-label={`${m.label} 수치`}
                  />
                  <button
                    type="button"
                    className={`stepper-btn ${plusClass}`}
                    onClick={() => onStep(m.key, 1)}
                    aria-disabled={atLimit ? true : undefined}
                    aria-label={`${m.label} 증가`}
                  >
                    ＋
                  </button>
                </div>
              )}
            </div>
            {/* 오늘 합계 (슬림 80px, 채널색, 지표명 중복 제거) — 본질 정보라 항상 노출 */}
            <div className="flex w-20 shrink-0 flex-col items-center justify-center border-l-2 bg-indigo-50 py-2 text-center">
              <div
                className={`num-mono text-2xl font-extrabold leading-none ${
                  total > 0 ? cls.text700 : "text-gray-300"
                }`}
              >
                {total}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
