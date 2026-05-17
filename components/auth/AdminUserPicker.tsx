/**
 * AdminUserPicker — 수강생 관리 화면 (Admin 전용).
 * 카드: 이름·email·기수·담당·시작/종강일·[시트] → click → impersonation.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Trainee,
  type Trainer,
  CohortSection,
  ReservedSection,
  PendingTraineesSection,
} from "./AdminUserPickerSections";
import { type PrepItem } from "./TraineePrepBulkForm";
import UnifiedPrepCard from "./UnifiedPrepCard";
import InstallFormulasButton from "./InstallFormulasButton";
import MigrateCacheButton from "./MigrateCacheButton";
import BulkReserveButton from "./BulkReserveButton";

export default function AdminUserPicker({
  users,
  reservedUsers = [],
  pendingUsers = [],
  activeTrainers,
  sessionEmail,
  archivedCohorts = [],
  viewOnly = false,
}: {
  users: Trainee[];
  /** 유보 처리된 trainees (registry B="유보"). enrich 안 됨 — cohort/이름 raw. */
  reservedUsers?: Trainee[];
  /** 승인 대기 trainees (status=pending). admin 이 승인/거절. */
  pendingUsers?: Trainee[];
  activeTrainers: Trainer[];
  sessionEmail: string;
  archivedCohorts?: string[];
  /** 관리부서 멤버 = read-only (시트 열기 버튼 숨김 + 액션 차단). */
  viewOnly?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  /** 공통 액션 helper — body POST 후 me 캐시 무효화 + 라우터 refresh. */
  async function postAction(
    url: string,
    body: Record<string, unknown>,
    targetEmail: string,
  ): Promise<boolean> {
    setBusy(targetEmail);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
      setBusy(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      setBusy(null);
      return false;
    }
  }

  async function reserve(email: string) {
    await postAction(
      "/api/admin/set-trainee-reserved",
      { email, reserved: true },
      email,
    );
  }
  /** 수강생 팀명 변경 — inline input Enter/blur 시 호출. */
  async function setTeam(email: string, team: string) {
    await postAction(
      "/api/admin/set-trainee-team",
      { email, team },
      `team:${email}`,
    );
  }

  /** PR C-1: 박스 내 드래그 정렬 결과 → 1..N 의 sortOrder 일괄 매핑.
   *  서버는 setUserSortOrders 로 M 컬럼만 batchUpdate. busy 표시는 가벼운
   *  토큰 ("reorder") — 카드별 busy 상태와 별개로 화면 잠그지 않음. */
  async function reorder(emails: string[]) {
    if (emails.length === 0) return;
    const orders = emails.map((email, idx) => ({ email, sortOrder: idx + 1 }));
    setBusy("reorder");
    setError(null);
    try {
      const res = await fetch("/api/admin/set-user-sort-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(null);
    }
  }
  async function restore(email: string) {
    await postAction(
      "/api/admin/set-trainee-reserved",
      { email, reserved: false },
      email,
    );
  }
  async function purge(email: string, name: string) {
    if (
      !window.confirm(
        `정말 "${name || email}" 를 영구 퇴출하시겠어요?\n등록 row 가 삭제됩니다 (시트 자체는 유지).`,
      )
    ) {
      return;
    }
    await postAction("/api/admin/remove-trainee", { email }, email);
  }

  /** 신규 수강생 prep row 등록 — 시트 URL + (기수, 이름). */
  async function addPrep(
    cohort: string,
    name: string,
    spreadsheetUrl: string,
  ) {
    await postAction(
      "/api/admin/add-trainee-prep",
      { cohort, name, spreadsheetUrl },
      `prep:${cohort}:${name}`,
    );
  }

  /** 일괄 prep row 등록 — paste 파싱된 items. 응답 요약 alert. */
  async function addPrepBulk(items: PrepItem[]) {
    setBusy(`bulk:${items.length}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/bulk-add-trainee-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      const { created = 0, updated = 0, failed = [] } = data;
      const summary =
        `등록 완료 — 신규 ${created}명 / 업데이트 ${updated}명` +
        (failed.length > 0
          ? `\n실패 ${failed.length}건: ${failed
              .map(
                (f: { cohort: string; name: string; error: string }) =>
                  `${f.cohort}기 ${f.name} (${f.error})`,
              )
              .join(", ")}`
          : "");
      window.alert(summary);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(null);
    }
  }

  /** 승인 대기 → 활성. 트레이너 승인과 동일한 패턴. */
  async function approve(email: string) {
    await postAction("/api/admin/approve-trainee", { email }, email);
  }
  /** 모든 승인 대기 수강생 한 번에 승인. */
  async function approveAll() {
    const n = pendingUsers.length;
    if (n === 0) return;
    if (!window.confirm(`승인 대기 ${n}명 전체를 활성화합니다. 계속할까요?`)) {
      return;
    }
    setBusy(`approve-all:${n}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/approve-all-pending-trainees", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        const { approved = 0, failed = [] } = data;
        window.alert(
          `${approved}명 승인 완료` +
            (failed.length > 0
              ? `, ${failed.length}건 실패: ${failed
                  .map((f: { email: string; error: string }) => `${f.email}(${f.error})`)
                  .join(", ")}`
              : ""),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(null);
    }
  }
  /** 승인 대기 → 거절(row 삭제). confirm 후 진행. */
  async function reject(email: string, name: string) {
    if (
      !window.confirm(
        `"${name || email}" 의 가입 요청을 거절하시겠어요?\n등록 row 가 삭제됩니다.`,
      )
    ) {
      return;
    }
    await postAction("/api/admin/reject-trainee", { email }, email);
  }

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of activeTrainers) {
      m.set(t.email.toLowerCase(), t.name || t.email);
    }
    return m;
  }, [activeTrainers]);

  /** spreadsheetId → 그 시트에 연결된 모든 email 리스트. 다중 계정 배지 표시.
      users(활성) + reservedUsers(유보) + pendingUsers(승인 대기) 전부 포함 —
      섹션이 달라도 같은 시트면 묶어서 인지하게. */
  const linkedBySheet = useMemo(() => {
    const m = new Map<string, string[]>();
    const add = (u: Trainee) => {
      if (!u.spreadsheetId) return;
      const arr = m.get(u.spreadsheetId) ?? [];
      arr.push(u.email);
      m.set(u.spreadsheetId, arr);
    };
    users.forEach(add);
    reservedUsers.forEach(add);
    pendingUsers.forEach(add);
    return m;
  }, [users, reservedUsers, pendingUsers]);

  const archivedSet = useMemo(
    () => new Set(archivedCohorts.map((c) => c.trim())),
    [archivedCohorts],
  );

  /** active + archived 두 그룹으로 분리 후 각각 기수별 정렬. */
  const { activeGroups, archivedGroups } = useMemo(() => {
    const filtered = users.filter((u) => {
      if (!q.trim()) return true;
      const k = q.trim().toLowerCase();
      return (
        u.name.toLowerCase().includes(k) ||
        u.email.toLowerCase().includes(k) ||
        String(u.cohort).includes(k)
      );
    });
    const activeMap = new Map<string, Trainee[]>();
    const archivedMap = new Map<string, Trainee[]>();
    for (const u of filtered) {
      const k = String(u.cohort).replace(/기\s*$/, "").trim() || "—";
      const bucket = archivedSet.has(k) ? archivedMap : activeMap;
      const arr = bucket.get(k) ?? [];
      arr.push(u);
      bucket.set(k, arr);
    }
    const sortFn = (a: [string, Trainee[]], b: [string, Trainee[]]) =>
      (parseInt(b[0]) || 0) - (parseInt(a[0]) || 0);
    return {
      activeGroups: Array.from(activeMap.entries()).sort(sortFn),
      archivedGroups: Array.from(archivedMap.entries()).sort(sortFn),
    };
  }, [users, q, archivedSet]);

  /**
   * trainee 카드의 트레이너 multi-select 변경 핸들러.
   * /admin/trainers 의 TrainerAssignCard 와 동일한 API (/api/admin/assign-trainee)
   * 호출 → assignedTrainer 컬럼 전체 update. 트레이너 측·수강생 측 어느 쪽에서
   * 토글하든 last-write-wins 자동 보장 (단일 source = trainee row 의 G 컬럼).
   * (2026-05-13 양방향 배정 도입)
   */
  async function assignTrainers(traineeEmail: string, trainerEmails: string[]) {
    await postAction(
      "/api/admin/assign-trainee",
      { traineeEmail, trainerEmails },
      `assign:${traineeEmail}`,
    );
  }

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
      // impersonation 시 trainee 데이터 캐시 모두 invalidate (사고 #2026-05-13 재발 방지).
      queryClient.clear();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master · 수강생 관리
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-gray-900">
              {sessionEmail}
            </div>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            ← 마스터 메뉴
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              수강생 관리
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              기수별 등록된 수강생 ({users.length}명)
            </p>
          </div>
          {!viewOnly && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {/* 2026-05-17 [A5]: 카드별 유보 버튼 → 헤더 통합 */}
              <BulkReserveButton
                trainees={users.map((u) => ({
                  email: u.email,
                  name: u.name,
                  cohort: u.cohort ?? "",
                }))}
                onDone={() => {
                  queryClient.invalidateQueries();
                  router.refresh();
                }}
              />
              <MigrateCacheButton />
              <InstallFormulasButton />
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="이름 / 기수 / 이메일 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-6 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-8">
          {activeGroups.length === 0 &&
            archivedGroups.length === 0 &&
            reservedUsers.length === 0 &&
            pendingUsers.length === 0 && (
              <p className="text-sm text-gray-400">검색 결과 없음.</p>
            )}

          {!viewOnly && (
            <UnifiedPrepCard
              busy={busy !== null}
              onSubmitSingle={addPrep}
              onSubmitBulk={addPrepBulk}
            />
          )}

          <PendingTraineesSection
            list={pendingUsers}
            busy={busy}
            onApprove={approve}
            onApproveAll={approveAll}
            onReject={reject}
            linkedBySheet={linkedBySheet}
            viewOnly={viewOnly}
          />

          {activeGroups.map(([cohort, list]) => (
            <CohortSection
              key={cohort}
              cohort={cohort}
              list={list}
              busy={busy}
              nameByEmail={nameByEmail}
              onPick={pick}
              onReserve={reserve}
              onSetTeam={setTeam}
              onReorder={viewOnly ? undefined : reorder}
              onAssignTrainers={assignTrainers}
              activeTrainers={activeTrainers}
              linkedBySheet={linkedBySheet}
              viewOnly={viewOnly}
            />
          ))}

          {archivedGroups.length > 0 && (
            <details className="group overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 open:bg-white">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 hover:bg-gray-100">
                <span className="text-sm font-bold text-gray-700">
                  📦 보관된 기수 ({archivedGroups.reduce((s, [, l]) => s + l.length, 0)}명)
                </span>
                <svg className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                    onReserve={reserve}
                    onSetTeam={setTeam}
                    onAssignTrainers={assignTrainers}
                    activeTrainers={activeTrainers}
                    linkedBySheet={linkedBySheet}
                    archived
                    viewOnly={viewOnly}
                  />
                ))}
              </div>
            </details>
          )}

          {/* 유보 수강생 — collapsed. 정규 명단·기수 그룹에서 빠진 trainee.
              관리자는 여기서 "복귀" 또는 "퇴출"(row 삭제) 선택 가능. */}
          {reservedUsers.length > 0 && (
            <ReservedSection
              list={reservedUsers}
              busy={busy}
              nameByEmail={nameByEmail}
              onRestore={restore}
              onPurge={purge}
              linkedBySheet={linkedBySheet}
              viewOnly={viewOnly}
            />
          )}
        </div>
      </div>
    </main>
  );
}
