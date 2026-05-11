/**
 * AdminUserPicker — Admin이 작업할 사용자 선택.
 *
 * Props:
 *   - users: 등록된 모든 사용자
 *   - sessionEmail: 현재 로그인한 admin email
 *
 * 클릭 → POST /api/admin/switch → router.push("/dashboard")
 */
"use client";

import { useMemo, useState } from "react";
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

export default function AdminUserPicker({
  users,
  sessionEmail,
}: {
  users: User[];
  sessionEmail: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const filtered = users.filter((u) => {
      if (!q.trim()) return true;
      const k = q.trim().toLowerCase();
      return (
        u.name.toLowerCase().includes(k) ||
        u.email.toLowerCase().includes(k) ||
        String(u.cohort).includes(k)
      );
    });
    const map = new Map<string, User[]>();
    for (const u of filtered) {
      const k = String(u.cohort).replace(/기\s*$/, "").trim();
      const arr = map.get(k) ?? [];
      arr.push(u);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort(
      (a, b) => (parseInt(b[0]) || 0) - (parseInt(a[0]) || 0),
    );
  }, [users, q]);

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
      // impersonation 후 헤더의 me 데이터(cohort/name/D-day)가 옛 사용자 그대로
      // 남는 버그 방지 — React Query me 캐시 강제 무효화.
      await queryClient.invalidateQueries({ queryKey: ["me"] });
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
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master · Admin
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {sessionEmail}
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
          작업할 수강생을 선택하세요
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          선택한 수강생의 시트를 조회·편집할 수 있습니다. 언제든 헤더에서 전환 가능.
        </p>

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
          {grouped.length === 0 && (
            <p className="text-sm text-gray-400">검색 결과 없음.</p>
          )}
          {grouped.map(([cohort, list]) => (
            <section key={cohort}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                {cohort}기 · {list.length}명
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {list.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => pick(u.email)}
                    disabled={busy !== null}
                    className="group rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md disabled:opacity-50"
                  >
                    <div className="text-sm font-bold text-gray-900 group-hover:text-red-600">
                      {u.name}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-gray-400">
                      {u.email}
                    </div>
                    {busy === u.email && (
                      <div className="mt-1 text-[10px] font-semibold text-red-600">
                        전환 중...
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
