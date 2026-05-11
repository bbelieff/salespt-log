/**
 * TrainerLanding — 트레이너 메인.
 * 담당 수강생 목록 + 마스터 시트 링크 + 클릭 시 impersonation 진입.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

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
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(email: string) {
    setBusy(email);
    const res = await fetch("/api/admin/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
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
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Trainer
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {trainerName} · {sessionEmail}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          담당 수강생 ({trainees.length})
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          이름을 누르면 그 수강생의 시트로 들어갑니다.
        </p>

        <a
          href={masterSheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-red-300 hover:text-red-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
          마스터 시트 열기
        </a>

        {isAdmin && (
          <a
            href="/admin"
            className="ml-2 mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            관리자 페이지 →
          </a>
        )}

        <div className="mt-8">
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
                    {u.cohort}기
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-gray-900 group-hover:text-red-600">
                    {u.name}
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
      </div>
    </main>
  );
}
