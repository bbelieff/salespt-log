/**
 * AdminUserPicker — 수강생 관리 화면 (Admin 전용).
 *
 * Props:
 *   - users: 등록된 수강생 (기수·시작일·종강일 enrich 완료)
 *   - activeTrainers: 활성 트레이너 (담당 이름 매핑용)
 *   - sessionEmail: 현재 로그인한 admin email
 *
 * 카드 정보 (한 row):
 *   이름 / 이메일 / 기수 / 담당 트레이너 (이름들) / 시작일 / 종강일 / [시트 열기]
 * 클릭 시 → POST /api/admin/switch → /dashboard (impersonation 진입)
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

interface Trainee {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  assignedTrainer?: string;
  courseStartISO?: string;
  graduationISO?: string;
}

interface Trainer {
  email: string;
  name: string;
}

function parseAssigned(field: string | undefined): string[] {
  if (!field) return [];
  return Array.from(
    new Set(
      field
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

/** "2026-04-10" → "26/04/10". 빈 값 → null. */
function fmtDateYY(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-");
  return `${y!.slice(-2)}/${m}/${d}`;
}

/** 기수 진행률 (%) + D-day 계산. start~end 사이 today 기준. */
function cohortProgress(
  startISO: string | undefined,
  endISO: string | undefined,
): { pct: number | null; dday: number | null } {
  if (!startISO || !endISO) return { pct: null, dday: null };
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return { pct: null, dday: null };
  }
  const now = Date.now();
  const totalMs = end - start;
  const elapsedMs = Math.max(0, Math.min(totalMs, now - start));
  const pct = Math.round((elapsedMs / totalMs) * 100);
  const dday = Math.ceil((end - now) / 86_400_000);
  return { pct, dday };
}

export default function AdminUserPicker({
  users,
  activeTrainers,
  sessionEmail,
  archivedCohorts = [],
  viewOnly = false,
}: {
  users: Trainee[];
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

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of activeTrainers) {
      m.set(t.email.toLowerCase(), t.name || t.email);
    }
    return m;
  }, [activeTrainers]);

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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master · 수강생 관리
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

      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          수강생 관리
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          기수별 등록된 수강생 ({users.length}명). 시트 열기 클릭 시 그 수강생의
          5탭 UI 진입.
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
          {activeGroups.length === 0 && archivedGroups.length === 0 && (
            <p className="text-sm text-gray-400">검색 결과 없음.</p>
          )}

          {/* 활성 기수 그룹 */}
          {activeGroups.map(([cohort, list]) => (
            <CohortSection
              key={cohort}
              cohort={cohort}
              list={list}
              busy={busy}
              nameByEmail={nameByEmail}
              onPick={pick}
              viewOnly={viewOnly}
            />
          ))}

          {/* 보관된 기수 — collapsed (details) */}
          {archivedGroups.length > 0 && (
            <details className="group rounded-2xl border border-gray-200 bg-gray-50 open:bg-white">
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
                    archived
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────── 기수별 섹션 ─────────────────────────── */
function CohortSection({
  cohort,
  list,
  busy,
  nameByEmail,
  onPick,
  archived = false,
  viewOnly = false,
}: {
  cohort: string;
  list: Trainee[];
  busy: string | null;
  nameByEmail: Map<string, string>;
  onPick: (email: string) => void;
  archived?: boolean;
  viewOnly?: boolean;
}) {
  // 기수 헤더 메타 — 첫 trainee 의 시작/종강일 사용 (같은 기수면 동일).
  const rep = list.find((u) => u.courseStartISO && u.graduationISO);
  const start = fmtDateYY(rep?.courseStartISO);
  const end = fmtDateYY(rep?.graduationISO);
  const { pct, dday } = cohortProgress(
    rep?.courseStartISO,
    rep?.graduationISO,
  );
  return (
    <section>
      <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-bold uppercase tracking-wider text-gray-500">
        <span>
          {cohort}기 · {list.length}명{archived && " (보관)"}
        </span>
        {start && end && (
          <span className="font-normal normal-case text-gray-400">
            개강 <span className="font-semibold text-gray-600">{start}</span>{" "}
            ~ 종강 <span className="font-semibold text-gray-600">{end}</span>
            {pct !== null && (
              <>
                {" · "}진행률{" "}
                <span className="font-semibold text-gray-600">{pct}%</span>
                {dday !== null && (
                  <span className="ml-1 font-semibold text-brand-red">
                    D{dday >= 0 ? "-" : "+"}
                    {Math.abs(dday)}
                  </span>
                )}
              </>
            )}
          </span>
        )}
      </h2>
      <ul className="space-y-2">
        {list.map((u) => {
          const assigned = parseAssigned(u.assignedTrainer);
          const trainerNames =
            assigned.length > 0
              ? assigned.map((e) => nameByEmail.get(e) ?? e).join(", ")
              : "미배정";
          return (
            <li
              key={u.email}
              className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${archived ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-black text-gray-900">
                    {u.name || "(이름 없음)"}
                  </span>
                  <span className="text-[11px] text-gray-400">{u.email}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-gray-600">
                  <span className="text-gray-400">담당</span>{" "}
                  <span className="font-semibold">{trainerNames}</span>
                </div>
              </div>
              {!viewOnly && (
                <button
                  type="button"
                  onClick={() => onPick(u.email)}
                  disabled={busy !== null}
                  className="shrink-0 rounded-full bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
                >
                  {busy === u.email ? "여는 중..." : "시트 열기 →"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
