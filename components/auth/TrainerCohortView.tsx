/**
 * TrainerCohortView — 트레이너 페이지 (수강생 관리의 read-only 권한축소판).
 *
 * /admin/users 의 기수박스 > 팀박스 > TraineeCard 계층을 그대로 재사용하되
 * 트레이너 권한으로 제한:
 *   - 전체 trainee 명단(활성/보관) 표시. **본인 담당에만** [시트]/[웹앱] 버튼 노출
 *     (TraineeCard 의 `trainerEmailLc` prop 으로 분기).
 *   - 핸들/유보/팀 입력/담당 토글 등 admin 액션은 전부 비활성 (`viewOnly` + dnd 미연결).
 *   - 검색/등록/동기화 UI 미포함 (admin 전용).
 *
 * 이전 TrainerLanding (단순 grid 목록) 를 대체 (2026-05-15).
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMe } from "@/query/me-hook";
import TrainerPlayerToggle from "./TrainerPlayerToggle";
import { useQueryClient } from "@tanstack/react-query";
import { cohortGroupKey, cohortGroupCompare } from "@/types";
import {
  CohortSection,
  parseAssigned,
  type Trainee,
  type Trainer,
} from "./AdminUserPickerSections";

export default function TrainerCohortView({
  sessionEmail,
  trainerName,
  trainees,
  activeTrainers,
  masterSheetUrl,
  canBackToAdmin,
  archivedCohorts = [],
}: {
  sessionEmail: string;
  trainerName: string;
  /** 전체 활성 trainee (enrich 된 cohort/개강일/종강일 포함). */
  trainees: Trainee[];
  /** 담당 이름 lookup + (현재 viewOnly 라 dropdown 미사용). */
  activeTrainers: Trainer[];
  masterSheetUrl: string;
  /** admin OR 관리부서 일 때 "← 마스터 메뉴" 노출. */
  canBackToAdmin: boolean;
  archivedCohorts?: string[];
}) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** "내 수강생만 보기" 토글. 기본 false (전체 명단). */
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const trainerEmailLc = sessionEmail.toLowerCase();

  /** 본인 담당 수강생 수 — 토글 라벨에 표시. */
  const myCount = useMemo(
    () =>
      trainees.filter((u) =>
        parseAssigned(u.assignedTrainer).includes(trainerEmailLc),
      ).length,
    [trainees, trainerEmailLc],
  );

  /** showOnlyMine 토글에 따라 전체 명단 or 본인 담당만. */
  const visibleTrainees = useMemo(() => {
    if (!showOnlyMine) return trainees;
    return trainees.filter((u) =>
      parseAssigned(u.assignedTrainer).includes(trainerEmailLc),
    );
  }, [trainees, showOnlyMine, trainerEmailLc]);

  /**
   * 웹앱 버튼 — 2026-05-17 정정: 시트 버튼처럼 새 탭으로 열기.
   *  AdminUserPicker.pick() 과 동일 — impersonation cookie set + window.open.
   */
  async function pick(email: string) {
    setBusy(email);
    setError(null);
    try {
      const res = await fetch("/api/admin/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      queryClient.clear();
      window.open("/dashboard", "_blank", "noopener,noreferrer");
      setBusy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      setBusy(null);
    }
  }

  // viewOnly 라 호출되지 않지만 CohortSection prop 시그니처상 필요한 no-op.
  const noop = () => {};

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of activeTrainers) {
      m.set(t.email.toLowerCase(), t.name || t.email);
    }
    return m;
  }, [activeTrainers]);

  const linkedBySheet = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const u of trainees) {
      if (!u.spreadsheetId) continue;
      const arr = m.get(u.spreadsheetId) ?? [];
      arr.push(u.email);
      m.set(u.spreadsheetId, arr);
    }
    return m;
  }, [trainees]);

  const archivedSet = useMemo(
    () => new Set(archivedCohorts.map((c) => c.trim())),
    [archivedCohorts],
  );

  /** active vs archived 기수 분리 + 기수번호 desc 정렬 (visibleTrainees 기준). */
  const { activeGroups, generalActive, arenaSeasons, archivedGroups } = useMemo(() => {
    const activeMap = new Map<string, Trainee[]>();
    const archivedMap = new Map<string, Trainee[]>();
    for (const u of visibleTrainees) {
      const k = cohortGroupKey(u.cohort, u.captainOf);
      const bucket = archivedSet.has(k) ? archivedMap : activeMap;
      const arr = bucket.get(k) ?? [];
      arr.push(u);
      bucket.set(k, arr);
    }
    const sortFn = (a: [string, Trainee[]], b: [string, Trainee[]]) =>
      cohortGroupCompare(a[0], b[0]);
    const active = Array.from(activeMap.entries()).sort(sortFn);
    // 아레나(A{n}-{m})는 시즌(A{n}) 컨테이너로 묶고, 일반 숫자기수는 박스 밖(§P11).
    const isArena = (c: string) => /^A\d+-\d+/.test(c);
    const seasonMap = new Map<string, [string, Trainee[]][]>();
    for (const grp of active.filter(([c]) => isArena(c))) {
      const sn = grp[0].split("-")[0]!;
      const arr = seasonMap.get(sn) ?? [];
      arr.push(grp);
      seasonMap.set(sn, arr);
    }
    return {
      activeGroups: active,
      generalActive: active.filter(([c]) => !isArena(c)),
      arenaSeasons: Array.from(seasonMap.entries()),
      archivedGroups: Array.from(archivedMap.entries()).sort(sortFn),
    };
  }, [visibleTrainees, archivedSet]);

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Trainer
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-gray-900">
              {trainerName} · {sessionEmail}
            </div>
          </div>
          {canBackToAdmin ? (
            <Link
              href="/admin"
              className="shrink-0 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              ← 마스터 메뉴
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="shrink-0 whitespace-nowrap text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
            >
              로그아웃
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl pc:max-w-5xl space-y-8 px-6 py-8">
        {/* 마스터 시트 — 기수 전체 현황 외부 링크 (URL 미설정 시 숨김). */}
        {masterSheetUrl && (
          <a
            href={masterSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">📊</div>
              <div>
                <div className="text-sm font-bold text-gray-900 group-hover:text-red-600">
                  마스터 시트 열기
                </div>
                <div className="mt-0.5 text-[11px] text-gray-400">
                  기수 전체 현황 (외부 시트)
                </div>
              </div>
            </div>
            <svg
              className="h-4 w-4 text-gray-400 group-hover:text-red-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        )}

        <section>
          {/* 수강생출신 트레이너 — 본인 아레나 일지 전환 토글(P14). */}
          {me.data?.ownArenaSheetId && <TrainerPlayerToggle mode="manager" />}
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            수강생 명단
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {showOnlyMine
                ? `내 담당 ${myCount}명`
                : `전체 ${trainees.length}명 (내 담당 ${myCount}명)`}
              . 본인 담당 카드만 <b>📊 시트</b> · <b>웹앱 →</b> 활성화.
            </p>
            <button
              type="button"
              onClick={() => setShowOnlyMine((v) => !v)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                showOnlyMine
                  ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              title={showOnlyMine ? "전체 명단으로 돌아가기" : `내 담당 ${myCount}명만 표시`}
            >
              {showOnlyMine ? `✓ 내 수강생만 (${myCount})` : "내 수강생만 보기"}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {activeGroups.length === 0 && archivedGroups.length === 0 && (
          <p className="text-sm text-gray-400">등록된 수강생이 없습니다.</p>
        )}

        {/* 활성 기수 — 일반 숫자기수(박스 밖) + 아레나 시즌 컨테이너 박스 */}
        {generalActive.map(([cohort, list]) => (
          <CohortSection
            key={cohort}
            cohort={cohort}
            list={list}
            busy={busy}
            nameByEmail={nameByEmail}
            onPick={pick}
            onReserve={noop}
            onSetTeam={noop}
            activeTrainers={activeTrainers}
            linkedBySheet={linkedBySheet}
            viewOnly
            trainerEmailLc={trainerEmailLc}
          />
        ))}
        {arenaSeasons.map(([season, groups]) => (
          <div
            key={season}
            className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-3"
          >
            <div className="mb-2 px-1 text-sm font-black text-purple-800">
              아레나 시즌{season.replace(/^A/, "")}
            </div>
            <div className="space-y-4">
              {groups.map(([cohort, list]) => (
                <CohortSection
                  key={cohort}
                  cohort={cohort}
                  list={list}
                  busy={busy}
                  nameByEmail={nameByEmail}
                  onPick={pick}
                  onReserve={noop}
                  onSetTeam={noop}
                  activeTrainers={activeTrainers}
                  linkedBySheet={linkedBySheet}
                  viewOnly
                  trainerEmailLc={trainerEmailLc}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 보관된 기수 — collapsed (details) */}
        {archivedGroups.length > 0 && (
          <details className="group overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 open:bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 hover:bg-gray-100">
              <span className="text-sm font-bold text-gray-700">
                📦 보관된 기수 ({archivedGroups.reduce((s, [, l]) => s + l.length, 0)}명)
              </span>
              <svg
                className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="space-y-6 border-t border-gray-200 px-4 py-4">
              {archivedGroups.map(([cohort, list]) => (
                <CohortSection
                  key={cohort}
                  cohort={cohort}
                  list={list}
                  busy={busy}
                  nameByEmail={nameByEmail}
                  onPick={pick}
                  onReserve={noop}
                  onSetTeam={noop}
                  activeTrainers={activeTrainers}
                  linkedBySheet={linkedBySheet}
                  archived
                  viewOnly
                  trainerEmailLc={trainerEmailLc}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
