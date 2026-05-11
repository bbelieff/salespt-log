/**
 * TrainerMgmtPanel — Admin 트레이너 관리 UI 컨테이너.
 *
 * 섹션은 ./TrainerMgmtSections.tsx 로 분리 (파일 크기 가드 — 500줄 cap).
 *   1) SectionPending     — pending 트레이너 승인/거절
 *   2) SectionAssign      — 트레이너별 카드 + 수강생 다중 체크박스
 *   3) SectionTraineeList — 수강생 명단 (기수별 아코디언)
 *   4) SectionTrainerList — 트레이너 명단 (담당 수강생 아코디언)
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type PanelUser,
  SectionPending,
  SectionAssign,
  SectionManagement,
  SectionTraineeList,
  SectionTrainerList,
} from "./TrainerMgmtSections";

export default function TrainerMgmtPanel({
  sessionEmail,
  pendingTrainers,
  activeTrainers,
  managementStaff,
  trainees,
}: {
  sessionEmail: string;
  pendingTrainers: PanelUser[];
  activeTrainers: PanelUser[];
  managementStaff: PanelUser[];
  trainees: PanelUser[];
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

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
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

      <div className="mx-auto max-w-3xl space-y-12 px-6 py-8">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {err}
          </div>
        )}

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

        <SectionAssign
          trainers={activeTrainers}
          trainees={trainees}
          busy={busy}
          onSave={(traineeEmail, trainerEmails, key) =>
            call(
              "/api/admin/assign-trainee",
              { traineeEmail, trainerEmails },
              key,
            )
          }
          onMoveToManagement={(email) => {
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
          }}
          onRemoveTrainer={(email) => {
            if (
              !confirm(
                `${email} 트레이너를 퇴출시키시겠습니까?\n\n` +
                  `· 그가 담당하던 모든 수강생의 배정에서 자동 제거됩니다.\n` +
                  `· trainer row 자체가 삭제됩니다.`,
              )
            )
              return;
            call("/api/admin/remove-trainer", { email }, `remove:${email}`);
          }}
        />

        <SectionManagement
          staff={managementStaff}
          busy={busy}
          onMoveToTrainer={(email) =>
            call(
              "/api/admin/set-trainer-dept",
              { email, department: "trainer" },
              `dept:${email}`,
            )
          }
          onRemove={(email) => {
            if (!confirm(`${email} row 를 삭제하시겠습니까?`)) return;
            call("/api/admin/remove-trainer", { email }, `remove:${email}`);
          }}
        />

        {/* 순서: 트레이너 명단 먼저 → 수강생 명단 */}
        <SectionTrainerList trainers={activeTrainers} trainees={trainees} />

        <SectionTraineeList trainees={trainees} activeTrainers={activeTrainers} />
      </div>
    </main>
  );
}
