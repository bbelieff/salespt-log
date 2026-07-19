/**
 * CohortMgmtPanel — Admin 전용 기수 관리.
 *
 * 각 cohort row:
 *   - 라벨 (예: "7기"), trainee N명
 *   - status: active | archived
 *   - 토글 버튼 "보관" / "활성화"
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CohortStatus, CohortType } from "@/repo/cohorts";
import CohortCreateModal from "./CohortCreateModal";
import ArenaCreateModal from "./ArenaCreateModal";
import CohortPendingRetryButton from "./CohortPendingRetryButton";

interface Cohort {
  label: string;
  status: CohortStatus;
  note: string;
  traineeCount: number;
  type?: CohortType;
}

/** 표시 라벨: 아레나 "A1회" / 일반 "8기". */
function displayLabel(c: { label: string; type?: CohortType }): string {
  return c.type === "arena" ? `${c.label}회` : `${c.label}기`;
}

export default function CohortMgmtPanel({
  sessionEmail,
  cohorts,
  viewOnly = false,
  pendingCreateCount = 0,
}: {
  sessionEmail: string;
  cohorts: Cohort[];
  viewOnly?: boolean;
  /** Drive 복제 실패로 pending 큐에 쌓인 기수-생성 건수(R3-5). admin 재시도 버튼용. */
  pendingCreateCount?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(label: string, next: CohortStatus) {
    setBusy(label);
    setErr(null);
    try {
      const res = await fetch("/api/admin/set-cohort-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, status: next }),
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

  const active = cohorts.filter((c) => c.status === "active");
  const archived = cohorts.filter((c) => c.status === "archived");

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              {viewOnly ? "관리부서 · 기수 조회" : "Master · 기수 관리"}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {sessionEmail}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!viewOnly && (
              <CohortPendingRetryButton pendingCount={pendingCreateCount} />
            )}
            {!viewOnly && <CohortCreateModal />}
            {!viewOnly && <ArenaCreateModal />}
            <Link
              href="/admin"
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              ← 마스터 메뉴
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl pc:max-w-5xl space-y-10 px-6 py-8">
        {viewOnly && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            🔒 조회 권한 — 관리부서 모드. 변경 액션은 admin 만 수행 가능합니다.
          </div>
        )}
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {err}
          </div>
        )}

        <section>
          <h2 className="mb-2 text-lg font-black tracking-tight text-gray-900">
            활성 기수 ({active.length})
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            현재 운영 중인 기수. 수강생 관리·트레이너 명단에 노출.
          </p>
          {active.length === 0 ? (
            <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
              활성 기수 없음.
            </p>
          ) : (
            <ul className="space-y-2">
              {active.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900">
                      {displayLabel(c)} · {c.traineeCount}명
                    </div>
                    {c.note && (
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {c.note}
                      </div>
                    )}
                  </div>
                  {!viewOnly && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (
                          !confirm(
                            `${displayLabel(c)} 를 보관 처리 하시겠습니까?\n\n` +
                              `· 수강생 관리·트레이너 명단의 "활성 기수" 그룹에서 숨김.\n` +
                              `· "보관 기수" 섹션에서 언제든 다시 활성화 가능.`,
                          )
                        )
                          return;
                        toggle(c.label, "archived");
                      }}
                      className="shrink-0 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    >
                      {busy === c.label ? "..." : "보관 처리"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-black tracking-tight text-gray-900">
            보관 기수 ({archived.length})
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            보관된 기수. 수강생 관리·트레이너 명단에서 별도 collapsed 섹션으로 표시.
          </p>
          {archived.length === 0 ? (
            <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
              보관된 기수 없음.
            </p>
          ) : (
            <ul className="space-y-2">
              {archived.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-100 p-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-700">
                      {displayLabel(c)} · {c.traineeCount}명{" "}
                      <span className="ml-1 rounded bg-gray-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        archived
                      </span>
                    </div>
                  </div>
                  {!viewOnly && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => toggle(c.label, "active")}
                      className="shrink-0 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {busy === c.label ? "..." : "활성화"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
