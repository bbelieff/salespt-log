/**
 * TrainerCohortView — 트레이너 페이지 (수강생 관리의 read-only 권한축소판).
 *
 * /admin/users 와 **같은 배치·같은 컴포넌트**를 쓴다(2026-11-12): 카테고리 상자
 * (CohortCategoryBoxes — 수강생/아레나/테스트) > 접힌 기수 칩(PC 3열) > 팀 > TraineeCard,
 * 보관한 기수는 접힌 상자. 트레이너 권한으로 제한:
 *   - 기본 내 담당만 표시(전체 보기 토글 가능). **본인 담당(또는 「활성 수강생 조회」 권한)** 카드에만
 *     [주간목표]/[웹앱] 버튼 (TraineeCard 의 `trainerEmailLc` + TrainerOpenContext).
 *   - 끌어 정렬·팀 변경·담당 변경 등 관리자 조작은 전부 없음 — 늘 `viewOnly` 이고
 *     onReorder·onAssignTrainers 를 넘기지 않는다. 등록·승인·유보·일괄 도구도 이 화면엔 없다.
 */
"use client";

import { useMemo, useState } from "react";
import { matchesTrainee } from "./trainee-search";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import PageContainer from "@/components/PageContainer";
import { useMe } from "@/query/me-hook";
import { useQueryClient } from "@tanstack/react-query";
import { cohortGroupKey, cohortGroupCompare, cohortCategory } from "@/types";
import { apiErrorMessage } from "@/lib/util/api-error-message";
import CohortCategoryBoxes from "./CohortCategoryBoxes";
import {
  COHORT_GRID,
  CohortSection,
  parseAssigned,
  type Trainee,
  type Trainer,
} from "./AdminUserPickerSections";
import { TrainerOpenContext } from "./AdminUserPickerTypes";

export default function TrainerCohortView({
  sessionEmail,
  trainees,
  activeTrainers,
  archivedCohorts = [],
  openActive = false,
}: {
  sessionEmail: string;
  trainerName: string;
  /** 전체 활성 trainee (enrich 된 cohort/개강일/종강일 포함). */
  trainees: Trainee[];
  /** 담당 이름 lookup + (현재 viewOnly 라 dropdown 미사용). */
  activeTrainers: Trainer[];
  /** admin OR 관리부서 일 때 "← 마스터 메뉴" 노출. */
  canBackToAdmin: boolean;
  archivedCohorts?: string[];
  /** 트레이너관리 「활성 수강생 조회」 권한 — 담당 아닌 활성 수강생에게도 [웹앱]·[주간목표](2026-11-06). */
  openActive?: boolean;
}) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** "내 수강생만 보기" 토글. 기본 true (내 담당만). */
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  // 검색(2026-11-10): 검색 중엔 내 담당·전체 토글과 상관없이 전체 명단에서 찾고, 기수·보관 상자를 펼친다.
  const [q, setQ] = useState("");
  const searching = q.trim() !== "";

  const trainerEmailLc = sessionEmail.toLowerCase();
  /** 활성 기수(아레나·테스트·보관 기수 제외) 수강생 중 관리자·트레이너 본인 페이지(0기 GM·0기 코스텝)가 아닌 사람. */
  const canOpen = useMemo(() => {
    const staff = new Set(activeTrainers.map((t) => t.email.toLowerCase()));
    const archived = new Set(archivedCohorts.map((c) => c.trim()));
    return (u: Trainee) => openActive && !staff.has(u.email.toLowerCase()) &&
      !archived.has(cohortGroupKey(u.cohort, u.captainOf)) && cohortCategory(cohortGroupKey(u.cohort, u.captainOf)) === "수강생";
  }, [openActive, activeTrainers, archivedCohorts]);

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
    if (searching) return trainees.filter((u) => matchesTrainee(u, q));
    if (!showOnlyMine) return trainees;
    return trainees.filter((u) =>
      parseAssigned(u.assignedTrainer).includes(trainerEmailLc),
    );
  }, [trainees, showOnlyMine, trainerEmailLc, searching, q]);

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
        setError(apiErrorMessage(data, res.status));
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

  /** active vs archived 기수 분리 + 기수 정렬 (visibleTrainees 기준) — AdminUserPicker 와 같은 규칙. */
  const { activeGroups, archivedGroups } = useMemo(() => {
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
    return {
      activeGroups: Array.from(activeMap.entries()).sort(sortFn),
      archivedGroups: Array.from(archivedMap.entries()).sort(sortFn),
    };
  }, [visibleTrainees, archivedSet]);

  return (
    <TrainerOpenContext.Provider value={canOpen}>
    <main className="min-h-dvh bg-slate-50">
      <PageContainer width="xwide" className="space-y-4 px-4 py-4">
        <section>
          {/* 수강생출신 트레이너 — 본인 아레나 일지 전환 토글(P14). */}
          <h1 className="text-lg font-black tracking-tight text-slate-900">
            수강생 명단
          </h1>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {showOnlyMine
                ? `내 담당 ${myCount}명`
                : `전체 ${trainees.length}명 (내 담당 ${myCount}명)`}
              {" · 담당 카드에서 주간목표·웹앱 가능."}
            </p>
            <button
              type="button"
              onClick={() => setShowOnlyMine((v) => !v)}
              className="app-header-pill shrink-0 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
              title={showOnlyMine ? "전체 명단으로 돌아가기" : `내 담당 ${myCount}명만 표시`}
            >
              {showOnlyMine ? "전체 수강생 보기" : "내 수강생만 보기"}
            </button>
          </div>
        </section>

        <input
          type="search"
          aria-label="수강생 검색"
          placeholder="이름 / 기수 / 이메일 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />
        {searching && visibleTrainees.length === 0 && <p className="text-sm text-slate-400">검색 결과 없음.</p>}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {activeGroups.length === 0 && archivedGroups.length === 0 && (
          showOnlyMine && trainees.length > 0 ? (
            <p className="text-sm text-slate-400">
              담당 수강생이 없습니다. 전체 명단은 [전체 수강생 보기]로 확인하세요.
            </p>
          ) : (
            <p className="text-sm text-slate-400">등록된 수강생이 없습니다.</p>
          )
        )}

        {/* 활성 기수 — /admin/users 와 같은 카테고리 상자·접힌 기수 칩. 관리자 조작(정렬·담당 변경)은 넘기지 않는다. */}
        <CohortCategoryBoxes
          activeGroups={activeGroups}
          busy={busy}
          nameByEmail={nameByEmail}
          onPick={pick}
          onReserve={noop}
          onSetTeam={noop}
          activeTrainers={activeTrainers}
          linkedBySheet={linkedBySheet}
          viewOnly
          trainerEmailLc={trainerEmailLc}
          searching={searching}
        />

        {/* 보관된 기수 — collapsed (details) */}
        {archivedGroups.length > 0 && (
          <details key={searching ? "search" : "browse"} open={searching || undefined} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 open:bg-white">
            <summary className="disclosure-summary flex cursor-pointer items-center justify-between gap-2 px-4 py-3 hover:bg-slate-100">
              <span className="text-sm font-bold text-slate-700">
                📦 보관된 기수 ({archivedGroups.reduce((s, [, l]) => s + l.length, 0)}명)
              </span>
              <DisclosureChevron className="text-slate-400" />
            </summary>
            <div className={`${COHORT_GRID} border-t border-slate-200 px-4 py-4`}>
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
                  collapsed
                  forceOpen={searching}
                />
              ))}
            </div>
          </details>
        )}
      </PageContainer>
    </main>
    </TrainerOpenContext.Provider>
  );
}
