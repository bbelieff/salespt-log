/**
 * TrainerMgmtPanel — Admin 트레이너 관리 UI.
 *
 * Section 1: pending 트레이너 승인/거절.
 * Section 2: trainee 별 담당 트레이너 변경 (select).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  status?: string;
  assignedTrainer?: string;
}

export default function TrainerMgmtPanel({
  sessionEmail,
  pendingTrainers,
  activeTrainers,
  trainees,
}: {
  sessionEmail: string;
  pendingTrainers: User[];
  activeTrainers: User[];
  trainees: User[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(url: string, body: Record<string, string>, key: string) {
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

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-12">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {err}
          </div>
        )}

        {/* Section 1 — 트레이너 요청 관리 */}
        <section>
          <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">
            트레이너 요청 관리
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            승인 대기 중 ({pendingTrainers.length})명 · 승인하면 즉시 트레이너 페이지 사용 가능.
          </p>

          {pendingTrainers.length === 0 ? (
            <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
              대기 중 요청 없음.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingTrainers.map((t) => (
                <li
                  key={t.email}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-900">
                      {t.name || t.email}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {t.email}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        call(
                          "/api/admin/approve-trainer",
                          { email: t.email },
                          `approve:${t.email}`,
                        )
                      }
                      className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {busy === `approve:${t.email}` ? "..." : "승인"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (!confirm(`${t.email} 거절하시겠습니까? row가 삭제됩니다.`)) return;
                        call(
                          "/api/admin/reject-trainer",
                          { email: t.email },
                          `reject:${t.email}`,
                        );
                      }}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {busy === `reject:${t.email}` ? "..." : "거절"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 2 — 트레이너 담당 부여 */}
        <section>
          <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">
            트레이너 담당 부여
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            수강생 {trainees.length}명 · 활성 트레이너 {activeTrainers.length}명.
            셀렉터로 담당을 바꿀 수 있습니다.
          </p>

          {trainees.length === 0 ? (
            <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
              등록된 수강생 없음.
            </p>
          ) : (
            <ul className="space-y-2">
              {trainees.map((s) => {
                const current = s.assignedTrainer ?? "";
                const key = `assign:${s.email}`;
                return (
                  <li
                    key={s.email}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-gray-900">
                        {s.cohort || "?"}기 · {s.name || s.email}
                      </div>
                      <div className="truncate text-[11px] text-gray-500">
                        {s.email}
                      </div>
                    </div>
                    <select
                      defaultValue={current}
                      disabled={busy !== null}
                      onChange={(e) =>
                        call(
                          "/api/admin/assign-trainee",
                          { traineeEmail: s.email, trainerEmail: e.target.value },
                          key,
                        )
                      }
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-brand-red focus:ring-2 focus:ring-red-100"
                    >
                      <option value="">— 미배정 —</option>
                      {activeTrainers.map((t) => (
                        <option key={t.email} value={t.email}>
                          {t.name || t.email}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
