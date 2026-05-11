/**
 * TrainerLanding — 트레이너 메인.
 * 담당 수강생 목록 + 마스터 시트 링크 + 클릭 시 impersonation 진입.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

interface User {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
}

export default function TrainerLanding({
  sessionEmail,
  trainerName,
  trainees,
  masterSheetUrl,
  isAdmin,
}: {
  sessionEmail: string;
  trainerName: string;
  trainees: User[];
  masterSheetUrl: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(email: string) {
    setBusy(email);
    const res = await fetch("/api/admin/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      // 헤더 me 캐시 무효화 — impersonation 대상 데이터로 즉시 갱신.
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/dashboard");
      router.refresh();
    } else {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Trainer
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-gray-900">
              {trainerName} · {sessionEmail}
            </div>
          </div>
          {/* admin 이면 마스터 메뉴 진입, 그 외엔 로그아웃 — 한 줄에 깔끔하게. */}
          {isAdmin ? (
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

      <div className="mx-auto max-w-2xl space-y-10 px-6 py-8">
        {/* 마스터 시트 — 기수 전체 현황 외부 링크 (env SHEETS_COHORT_MASTER_ID).
            URL 미설정 시 카드 자체를 숨김. */}
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
            <svg className="h-4 w-4 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </a>
        )}

        {/* 담당 수강생 — 클릭 시 impersonate → /dashboard (5탭 UI) */}
        <section id="my-trainees">
          <h1 className="text-xl font-black tracking-tight text-gray-900">
            내 수강생 경영일지 확인
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            이름을 누르면 그 수강생의 시트(5탭)로 진입합니다.
          </p>

          <div className="mt-6">
            {trainees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
                아직 배정된 수강생이 없습니다. 관리자에게 문의해 주세요.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trainees.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => pick(u.email)}
                    disabled={busy !== null}
                    className="group rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md disabled:opacity-50"
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {u.cohort ? `${u.cohort}기` : "—"}
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-gray-900 group-hover:text-red-600">
                      {u.name || u.email}
                    </div>
                    {busy === u.email && (
                      <div className="mt-1 text-[10px] font-semibold text-red-600">
                        열기 중...
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
