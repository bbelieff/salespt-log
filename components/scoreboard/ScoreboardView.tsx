/**
 * ScoreboardView — 전광판 클라이언트 뷰 (arena-scoreboard-v2).
 *
 * 상단 [관리자 대시보드]/[캡쳐 모드] 토글.
 *  - 대시보드: 기수 평균 표(주차 상세) + 5지표 개인 랭킹 표, 밀도 높게.
 *  - 캡쳐: 탭(메인 종합/미팅/계약/매출/앱사용량/공유왕). 메인=CohortSummaryBoard,
 *    지표탭=AwardPodium(색만 변경 재사용). 공통 헤더 "아레나 시즌N · M주차 · {지표}왕"
 *    — 시즌 번호는 **SSOT(resolveCurrentSeason)** 가 준 data.season 만 쓴다(AR-2b, 하드코딩 금지).
 * 탭 전환은 hydration 후 useState — 스트리밍 중 display:none 아님.
 */
"use client";

import { useState } from "react";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { seasonDisplayLabel } from "@/service/arena-season-config";
import AwardPodium, { type PodiumColor } from "./AwardPodium";
import CohortSummaryBoard from "./CohortSummaryBoard";

const METRICS = ["생산", "유입", "컨택", "미팅", "계약"] as const;
type Metric = (typeof METRICS)[number];

interface ViewMetricRow {
  생산: number;
  유입: number;
  컨택: number;
  미팅: number;
  계약: number;
}
interface ViewCohort {
  cohort: string;
  paidMembers: number;
  weekly: Array<{ week: number } & ViewMetricRow>;
  total: ViewMetricRow;
}
interface ViewEntry {
  name: string;
  cohort: string;
  value: number;
  rank: number;
}
export interface ScoreboardViewData {
  byCohort: ViewCohort[];
  rankings: Record<string, ViewEntry[]>;
  seasonWeek: number;
  /** 현재 시즌 번호(0=미상). 서버가 resolveCurrentSeason 으로 채움 — 표기 하드코딩 금지. */
  season: number;
}

// 지표 탭 정의 — 색만 바꿔 AwardPodium 재사용.
const RANK_TABS: { key: string; color: PodiumColor; unit: string }[] = [
  { key: "미팅", color: "blue", unit: "건" },
  { key: "계약", color: "purple", unit: "건" },
  { key: "매출", color: "teal", unit: "원" },
  { key: "앱사용량", color: "amber", unit: "회" },
  { key: "공유왕", color: "rose", unit: "점" },
];

const CAPTION: Record<string, string> = {
  메인: "입금자 평균 · 부부 1시트=1명 · 계약 평균 순",
  미팅: `${STATS_WEEKS}주 누적 미팅 수 · 입금자 1시트=1명`,
  계약: `${STATS_WEEKS}주 누적 계약 수 · 입금자 1시트=1명`,
  매출: "대시보드 총매출 · 입금자 1시트=1명",
  앱사용량: `${STATS_WEEKS}주 기록 활동량(생산+유입+컨택+미팅+계약) · 입금자 1시트=1명`,
  공유왕: "게시판 공유글 점수(수동 집계) · 입금자 1시트=1명",
};

export default function ScoreboardView({ data }: { data: ScoreboardViewData }) {
  const [mode, setMode] = useState<"dashboard" | "capture">("dashboard");
  const [tab, setTab] = useState<string>("메인");

  // 주차 미상(0)이면 주차 칸을 비운다 — 옛 코드는 여기에 "시즌1" 을 넣어 개막 전 헤더가
  // "아레나 시즌1 · 시즌1" 로 찍혔다(표기 결함). 시즌 라벨은 CaptureMode 가 SSOT 로 만든다.
  const weekLabel = data.seasonWeek > 0 ? `${data.seasonWeek}주차` : "";

  return (
    <div>
      {/* 모드 전환 */}
      <div className="mb-4 inline-flex rounded-full bg-gray-100 p-1">
        {(["dashboard", "capture"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              mode === m
                ? "bg-white text-gray-900 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "dashboard" ? "관리자 대시보드" : "캡쳐 모드"}
          </button>
        ))}
      </div>

      {mode === "dashboard" ? (
        <DashboardMode data={data} />
      ) : (
        <CaptureMode
          data={data}
          tab={tab}
          setTab={setTab}
          weekLabel={weekLabel}
        />
      )}
    </div>
  );
}

// ── 관리자 대시보드: 모든 데이터 한 화면 ──────────────────────────────
function DashboardMode({ data }: { data: ScoreboardViewData }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-black text-gray-800">기수 종합</h2>
        <CohortSummaryBoard cohorts={data.byCohort} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-black text-gray-800">
          기수별 주차 상세
        </h2>
        <div className="space-y-4">
          {data.byCohort.map((c) => (
            <div key={c.cohort}>
              <div className="mb-1 flex items-baseline gap-2">
                <h3 className="text-xs font-black text-gray-700">
                  {c.cohort}기
                </h3>
                <span className="text-[11px] text-gray-400">
                  입금자 {c.paidMembers}명
                </span>
              </div>
              {c.paidMembers === 0 ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] text-gray-400">
                  입금자 없음
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[560px] border-collapse text-center text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="px-2 py-1 text-left font-bold">지표</th>
                        {c.weekly.map((w) => (
                          <th key={w.week} className="px-1.5 py-1 font-bold">
                            {w.week}주
                          </th>
                        ))}
                        <th className="px-1.5 py-1 font-black text-gray-700">
                          총합
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((m) => (
                        <tr key={m} className="border-t border-gray-50">
                          <td className="px-2 py-1 text-left font-bold text-gray-700">
                            {m}
                          </td>
                          {c.weekly.map((w) => (
                            <td
                              key={w.week}
                              className="px-1.5 py-1 tabular-nums text-gray-700"
                            >
                              {w[m].toFixed(1)}
                            </td>
                          ))}
                          <td className="px-1.5 py-1 font-black tabular-nums text-gray-900">
                            {c.total[m].toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-black text-gray-800">개인 랭킹</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {RANK_TABS.map((t) => (
            <RankingTable
              key={t.key}
              title={`${t.key}왕`}
              unit={t.unit}
              entries={data.rankings[t.key] ?? []}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function RankingTable({
  title,
  unit,
  entries,
}: {
  title: string;
  unit: string;
  entries: ViewEntry[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <div className="bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-700">
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-gray-400">데이터 없음</div>
      ) : (
        <ul>
          {entries.map((e) => (
            <li
              key={`${e.name}-${e.rank}`}
              className="flex items-center gap-2 border-t border-gray-50 px-3 py-1.5 text-xs"
            >
              <span className="w-5 font-black text-gray-400">{e.rank}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-gray-900">
                {e.name}
                <span className="ml-1 text-[10px] font-bold text-gray-400">
                  {e.cohort}기
                </span>
              </span>
              <span className="font-black tabular-nums text-gray-800">
                {Math.round(e.value).toLocaleString("ko-KR")}
                <span className="ml-0.5 text-[10px] text-gray-400">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 캡쳐 모드: 한 탭 = 한 캡쳐 ────────────────────────────────────────
function CaptureMode({
  data,
  tab,
  setTab,
  weekLabel,
}: {
  data: ScoreboardViewData;
  tab: string;
  setTab: (t: string) => void;
  weekLabel: string;
}) {
  const active = RANK_TABS.find((t) => t.key === tab);
  const headTitle = tab === "메인" ? "종합" : `${tab}왕`;
  // 시즌 표기 = SSOT(data.season, resolveCurrentSeason 산출). 하드코딩 금지 — A2 등록 시
  // 자동으로 "아레나 시즌2" 가 된다. 미상(0)이면 번호 없이 "아레나".
  const seasonLabel = seasonDisplayLabel(data.season);

  return (
    <div>
      {/* 탭 바 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["메인", ...RANK_TABS.map((t) => t.key)].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === k
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {k === "메인" ? "메인" : `${k}왕`}
          </button>
        ))}
      </div>

      {/* 캡쳐 카드 — 고정폭(모바일 캡쳐 친화) */}
      <div className="mx-auto max-w-md rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 text-center">
          <p className="text-xs font-bold text-gray-400">
            {seasonLabel}
            {weekLabel && ` · ${weekLabel}`}
          </p>
          <h2 className="text-xl font-black text-gray-900">{headTitle}</h2>
        </div>

        {tab === "메인" ? (
          <CohortSummaryBoard cohorts={data.byCohort} />
        ) : active ? (
          <AwardPodium
            metric={tab}
            unit={active.unit}
            color={active.color}
            entries={data.rankings[tab] ?? []}
          />
        ) : null}

        <p className="mt-4 text-center text-[11px] text-gray-400">
          {CAPTION[tab] ?? ""}
        </p>
      </div>
    </div>
  );
}
