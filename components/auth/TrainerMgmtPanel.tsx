/**
 * TrainerMgmtPanel — Admin 트레이너 관리 UI 컨테이너.
 *
 * 섹션 순서 (사용자 요구):
 *   1) SectionPending     — 트레이너 요청관리 (pending 승인/거절)
 *   2) SectionAssign      — 트레이너 담당부여 (트레이너 카드 + 다중 체크)
 *   3) SectionTraineeList — 수강생 명단
 *   4) SectionManagement  — 관리부서 명단
 */
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createKeyedSaveCoalescer } from "@/util/save-coalesce";
import {
  type PanelUser,
  SectionPending,
  SectionAssign,
  SectionManagement,
  SectionTraineeList,
} from "./TrainerMgmtSections";

export default function TrainerMgmtPanel({
  sessionEmail,
  pendingTrainers,
  activeTrainers,
  managementStaff,
  trainees,
  viewOnly = false,
}: {
  sessionEmail: string;
  pendingTrainers: PanelUser[];
  activeTrainers: PanelUser[];
  managementStaff: PanelUser[];
  trainees: PanelUser[];
  /** 관리부서 read-only — 액션 버튼 모두 숨김. */
  viewOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(url: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? `HTTP ${res.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // 담당 트레이너 배정 — 수강생(traineeEmail) 단위 좌표(BBE-253, BBE-243 패턴 재사용).
  // ①latestAssigned: 서버 확정을 기다리지 않는 "클라이언트가 아는 최신 의도" — 같은
  //   수강생을 (같은/다른 트레이너 카드에서) 연타해도 항상 이 값을 기준으로 다음 상태를
  //   계산해, 시트에서 다시 읽어오기 전(prop 이 아직 stale)에 두 번째 토글이 첫 번째
  //   토글을 덮어써 유실되는 사고를 막는다.
  // ②assignCoalescer: 수강생별 저장 큐 — 같은 수강생에 대한 요청은 항상 직렬(동시에
  //   둘 이상 in-flight 금지) + 좌표(마지막 의도만 서버로), 다른 수강생끼리는 서로 안 막음.
  const latestAssigned = useRef(new Map<string, string[]>()).current;
  const assignCoalescer = useRef(createKeyedSaveCoalescer<string, void>()).current;

  function resolveAssigned(email: string, fallback: string[]): string[] {
    if (!latestAssigned.has(email)) latestAssigned.set(email, fallback);
    return latestAssigned.get(email)!;
  }

  // busy 표시는 기존과 동일하게 call() 내부에 위임(단일 문자열 — 여러 수강생이 동시에
  // in-flight 면 마지막 것만 스피너로 보일 수 있으나, §완주기준(유실 0·롤백 0)은 아래
  // 좌표 큐가 데이터 정합으로 보장하므로 표시용 busy 정확도는 이 카드 스코프 밖(후속).
  function saveAssignment(traineeEmail: string, trainerEmails: string[], key: string) {
    latestAssigned.set(traineeEmail, trainerEmails); // 동기 — 바로 다음 토글이 이 값을 본다
    void assignCoalescer.trigger(traineeEmail, () =>
      call(
        "/api/admin/assign-trainee",
        { traineeEmail, trainerEmails: latestAssigned.get(traineeEmail)! },
        key,
      ),
    );
  }

  /** PR C-2: 트레이너 카드 드래그 정렬 결과 → registry M(sortOrder) 일괄 update.
   *  /admin/users 의 reorder() 와 동일 endpoint 재사용 (공유 M 컬럼, 다른 row 집합). */
  async function reorderTrainers(emails: string[]) {
    if (emails.length === 0) return;
    const orders = emails.map((email, idx) => ({ email, sortOrder: idx + 1 }));
    setBusy("reorder-trainers");
    setErr(null);
    try {
      const res = await fetch("/api/admin/set-user-sort-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? `HTTP ${res.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master · 트레이너 관리
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {sessionEmail}
            </div>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            ← 마스터 메뉴
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl pc:max-w-5xl space-y-12 px-6 py-8">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {err}
          </div>
        )}

        {viewOnly && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            🔒 조회 권한 — 관리부서 모드. 변경 액션은 admin 만 수행 가능합니다.
          </div>
        )}

        {/* 1. 트레이너 요청관리 — pending row 노출은 모두에게, 액션 버튼은 admin 만. */}
        {!viewOnly && (
          <SectionPending
            pending={pendingTrainers}
            busy={busy}
            onApprove={(email) =>
              call("/api/admin/approve-trainer", { email }, `approve:${email}`)
            }
            onReject={(email) => {
              if (!confirm(`${email} 거절하시겠습니까? row가 삭제됩니다.`)) return;
              call("/api/admin/reject-trainer", { email }, `reject:${email}`);
            }}
          />
        )}

        {/* 2. 트레이너 담당부여 (admin) — viewOnly 면 액션 핸들러 미전달. */}
        <SectionAssign
          trainers={activeTrainers}
          trainees={trainees}
          busy={busy}
          onReorder={viewOnly ? undefined : reorderTrainers}
          resolveAssigned={resolveAssigned}
          onSave={viewOnly ? () => {} : saveAssignment}
          onMoveToManagement={
            viewOnly
              ? undefined
              : (email) => {
                  if (
                    !confirm(
                      `${email} 을 관리부서로 이동시키시겠습니까?\n\n` +
                        `· 담당 매핑은 자동 정리됩니다.\n` +
                        `· 언제든 트레이너로 다시 이동 가능합니다.`,
                    )
                  )
                    return;
                  call(
                    "/api/admin/set-trainer-dept",
                    { email, department: "management" },
                    `dept:${email}`,
                  );
                }
          }
          onRemoveTrainer={
            viewOnly
              ? undefined
              : (email) => {
                  if (
                    !confirm(
                      `${email} 트레이너를 퇴출시키시겠습니까?\n\n` +
                        `· 그가 담당하던 모든 수강생의 배정에서 자동 제거됩니다.\n` +
                        `· trainer row 자체가 삭제됩니다.`,
                    )
                  )
                    return;
                  call("/api/admin/remove-trainer", { email }, `remove:${email}`);
                }
          }
          viewOnly={viewOnly}
        />

        {/* 3. 수강생 명단 (조회 only) */}
        <SectionTraineeList
          trainees={trainees}
          activeTrainers={activeTrainers}
        />

        {/* 4. 관리부서 명단 — viewOnly 면 액션 버튼 숨김. */}
        <SectionManagement
          staff={managementStaff}
          busy={busy}
          onMoveToTrainer={
            viewOnly
              ? undefined
              : (email) =>
                  call(
                    "/api/admin/set-trainer-dept",
                    { email, department: "trainer" },
                    `dept:${email}`,
                  )
          }
          onRemove={
            viewOnly
              ? undefined
              : (email) => {
                  if (!confirm(`${email} row 를 삭제하시겠습니까?`)) return;
                  call("/api/admin/remove-trainer", { email }, `remove:${email}`);
                }
          }
        />
      </div>
    </main>
  );
}
