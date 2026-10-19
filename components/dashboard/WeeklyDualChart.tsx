/**
 * WeeklyDualChart — 코스 주차 추이 (활동량 bar + 계약수 line, 2축).
 *
 * 기수 통계 창만큼 그린다 — 9기 이하·아레나 8주, 숫자 10기+ 12주(ADR-0032). points 길이를 그대로 쓴다.
 * 수료 후에는 서버가 보낸 최근 8주(이번 주 포함) 기록·날짜를 그린다.
 *
 * SSOT: docs/design/components.md §9-6
 *
 * 사용자 결정 2026-05-08: 영업이익 → **계약수** 로 변경.
 *   원: 영업이익 (만원, 음수 가능)
 *   신: 계약수 (건, 0 이상)
 *
 * 좌Y축: 활동량 (slate-300 bar) — 0~max 자동 스케일
 * 우Y축: 계약수 (blue-500 line) — 0~max(계약수) 자동 스케일
 *
 * 시트 출처:
 *   계약수 = 01 영업관리!N{38,72,106,140,174,208,242,276}
 *   활동량 = 대시보드(자동작성) C33:H40 의 마지막(6번째) 컬럼
 */
"use client";

import type { DashboardWeeklyPoint, DashboardView } from "@/types";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { usePlayOnOpen } from "@/components/motion/useMotion";

interface Props {
  points: DashboardWeeklyPoint[]; // 길이 = 기수 통계 창(8 또는 12주)
  period?: DashboardView['weeklyTrendPeriod'];
  onRetry?: () => void;
}

const X0 = 30;
const X1 = 328;
const Y_TOP = 16;
const Y_BOT = 160;


export default function WeeklyDualChart({ points, period, onRetry }: Props) {
  // 열 때마다: 막대가 차례로 올라오고, 계약수 선이 왼쪽부터 그려지고, 점이 톡 나타난다(belie 2026-10-09).
  const play = usePlayOnOpen("weekly-trend");
  const recent = period?.kind === 'recent';
  const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  const title = recent ? '지난 8주간 추이' : '주차 추이';
  const weeks = Math.max(STATS_WEEKS, points.length);
  const step = (X1 - X0) / weeks;
  const BAR_W = Math.min(24, step * 0.65);
  const xAt = (i: number) => X0 + step * (i + 0.5);
  // 코스 주차 padding (부족하면 0으로 채움)
  const data: DashboardWeeklyPoint[] = Array.from(
    { length: weeks },
    (_, i) => points[i] ?? { 주차: i + 1, 계약수: 0, 활동량: 0 },
  );

  // 자동 스케일 (max 기준, 데이터 0이면 1로 fallback)
  const actMax = Math.max(...data.map((d) => d.활동량), 1);
  const contractMax = Math.max(...data.map((d) => d.계약수), 1);
  // 시각상 위쪽 여백 10% — Math.ceil(max * 1.1)
  const actScale = Math.ceil(actMax * 1.1) || 1;
  const contractScale = Math.ceil(contractMax * 1.1) || 1;

  const yAct = (v: number) => Y_BOT - (v / actScale) * (Y_BOT - Y_TOP);
  const yContract = (v: number) =>
    Y_BOT - (v / contractScale) * (Y_BOT - Y_TOP);

  const linePoints = data
    .map((d, i) => `${xAt(i)},${yContract(d.계약수)}`)
    .join(" ");

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* 섹션 제목 + 범례 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-slate-500" />
        <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
        {!recent && <span className="text-xs text-slate-600">코스 {weeks}주 기준</span>}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />
            <span className="text-slate-500">활동량</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-blue-600">계약수</span>
          </span>
        </div>
      </div>
      {recent && <p className="mb-2 text-xs text-slate-600">{md(period.startISO)} ~ {md(period.endISO)} · 금~목 · 이번 주 포함</p>}

      {/* chart-fill: 데스크탑에서만 카드의 남은 높이를 채운다(globals.css ④). 모바일 무변경. */}
      {period?.status === 'unavailable' ? <div role="status" className="py-5 text-center text-sm text-slate-600"><p>최근 8주 기록을 불러오지 못했어요.</p>{onRetry && <button type="button" onClick={onRetry} className="mt-2 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">다시 불러오기</button>}</div> : <>
      <div className="chart-fill flex flex-1 items-center">
      <svg role="img" viewBox="0 0 358 200" preserveAspectRatio="xMidYMid meet" className="weekly-trend-svg w-full" aria-label={recent ? `${title}, ${period.startISO}부터 ${period.endISO}까지` : `코스 ${weeks}주 주차 추이`}>
        <title>{title}</title>
        <desc>{data.map(d => `${d.startISO || `${d.주차}주`}: 활동량 ${d.활동량}건, 계약 ${d.계약수}건`).join('; ')}</desc>
        {/* 가로 그리드 (활동량 50%, 100%) */}
        <line
          x1={X0}
          y1={yAct(actScale * 0.5)}
          x2={X1}
          y2={yAct(actScale * 0.5)}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <line
          x1={X0}
          y1={yAct(actScale)}
          x2={X1}
          y2={yAct(actScale)}
          stroke="#f1f5f9"
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {/* 좌 Y축 라벨 (활동량) */}
        <text x={26} y={Y_TOP + 4} textAnchor="end" fontSize="9" fill="#64748b">
          {actScale}
        </text>
        <text
          x={26}
          y={yAct(actScale * 0.5) + 4}
          textAnchor="end"
          fontSize="9"
          fill="#64748b"
        >
          {Math.round(actScale * 0.5)}
        </text>
        <text x={26} y={Y_BOT + 4} textAnchor="end" fontSize="9" fill="#64748b">
          0
        </text>

        {/* 우 Y축 라벨 (계약수) */}
        <text x={332} y={Y_TOP + 4} fontSize="9" fill="#64748b">
          {contractScale}
        </text>
        <text x={332} y={yContract(contractScale * 0.5) + 4} fontSize="9" fill="#64748b">
          {Math.round(contractScale * 0.5)}
        </text>
        <text x={332} y={Y_BOT + 4} fontSize="9" fill="#64748b">
          0
        </text>

        {/* 활동량 막대 (slate-300) */}
        {data.map((d, i) => {
          const cx = xAt(i);
          const y = yAct(d.활동량);
          return (
            <rect
              key={`bar-${d.주차}`}
              x={cx - BAR_W / 2}
              y={y}
              width={BAR_W}
              height={Math.max(0, Y_BOT - y)}
              fill="#cbd5e1"
              rx={2}
              className={play ? "fx-box fx-grow-y" : undefined}
              style={play ? { animationDelay: `${i * 50}ms` } : undefined}
            />
          );
        })}

        {/* 계약수 라인 (blue-500) */}
        <polyline
          points={linePoints}
          pathLength={1}
          className={play ? "fx-draw" : undefined}
          style={play ? { animationDelay: "350ms" } : undefined}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <circle
            key={`pt-${d.주차}`}
            cx={xAt(i)}
            cy={yContract(d.계약수)}
            r={i === data.length - 1 ? 4.5 : 3.5}
            fill="#3b82f6"
            stroke={i === data.length - 1 ? "#fff" : undefined}
            strokeWidth={i === data.length - 1 ? 1.5 : 0}
            className={play ? "fx-box fx-pop" : undefined}
            style={play ? { animationDelay: `${900 + i * 30}ms` } : undefined}
          />
        ))}

        {/* X축 + 주차 라벨 */}
        <line x1={X0} y1={Y_BOT} x2={X1} y2={Y_BOT} stroke="#e5e7eb" strokeWidth={1} />
        {data.map((d, i) => (
          <text
            key={`xl-${d.주차}`}
            x={xAt(i)}
            y={178}
            textAnchor="middle"
            fontSize="10"
            fill={i === data.length - 1 ? "#1d4ed8" : "#64748b"}
            fontWeight={i === data.length - 1 ? 700 : undefined}
          >
            {recent ? (i === data.length - 1 ? '이번 주' : d.startISO ? md(d.startISO) : `${data.length - i - 1}주 전`) : `${d.주차}주`}
          </text>
        ))}

        {/* 단위 표시 */}
        <text x={2} y={194} fontSize="9" fill="#64748b">
          활동량(건)
        </text>
        <text x={356} y={194} textAnchor="end" fontSize="9" fill="#64748b">
          계약수(건)
        </text>
      </svg>
      </div>
      </>}
    </section>
  );
}
