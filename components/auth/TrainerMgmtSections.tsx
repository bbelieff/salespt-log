/**
 * TrainerMgmtSections — TrainerMgmtPanel 의 4 섹션 분리 (파일 크기 가드).
 *
 *   SectionPending     — pending 승인/거절
 *   SectionAssign      — 트레이너별 카드 + 수강생 다중 체크박스
 *   SectionTraineeList — 수강생 명단 (기수별 아코디언)
 *   SectionTrainerList — 트레이너 명단 (담당 수강생 아코디언)
 */
"use client";

import { useMemo, useState } from "react";

export interface PanelUser {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  status?: string;
  assignedTrainer?: string;
}

export function parseAssigned(field: string | undefined): string[] {
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

export function groupByCohort(users: PanelUser[]): Array<[string, PanelUser[]]> {
  const map = new Map<string, PanelUser[]>();
  for (const u of users) {
    const key = String(u.cohort).replace(/기\s*$/, "").trim() || "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }
  return Array.from(map.entries()).sort(
    (a, b) => (parseInt(b[0]) || 0) - (parseInt(a[0]) || 0),
  );
}

/* ─────────────────────── Section 1 ─────────────────────── */
export function SectionPending({
  pending,
  busy,
  onApprove,
  onReject,
}: {
  pending: PanelUser[];
  busy: string | null;
  onApprove: (email: string) => void;
  onReject: (email: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">
        트레이너 요청관리
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        승인 대기 중 ({pending.length})명
      </p>
      {pending.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
          대기 중 요청 없음.
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((t) => (
            <li
              key={t.email}
              className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-gray-900">
                  {t.name || t.email}
                </div>
                <div className="truncate text-[11px] text-gray-500">{t.email}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => onApprove(t.email)}
                  className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === `approve:${t.email}` ? "..." : "승인"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => onReject(t.email)}
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
  );
}

/* ─────────────────────── Section 2 ─────────────────────── */
export function SectionAssign({
  trainers,
  trainees,
  busy,
  onSave,
}: {
  trainers: PanelUser[];
  trainees: PanelUser[];
  busy: string | null;
  onSave: (traineeEmail: string, trainerEmails: string[], key: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-black tracking-tight text-gray-900">
        트레이너 담당 부여
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        트레이너 카드를 펼쳐 담당 수강생을 다중 선택하세요. 한 수강생을 여러
        트레이너에 동시 배정 가능 — 토글 즉시 저장.
      </p>
      {trainers.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
          활성 트레이너가 없습니다. 요청관리에서 먼저 승인하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {trainers.map((tr) => (
            <TrainerAssignCard
              key={tr.email}
              trainer={tr}
              trainees={trainees}
              busy={busy}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TrainerAssignCard({
  trainer,
  trainees,
  busy,
  onSave,
}: {
  trainer: PanelUser;
  trainees: PanelUser[];
  busy: string | null;
  onSave: (traineeEmail: string, trainerEmails: string[], key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trainerLc = trainer.email.toLowerCase();
  const assignedCount = useMemo(
    () =>
      trainees.filter((s) =>
        parseAssigned(s.assignedTrainer).includes(trainerLc),
      ).length,
    [trainees, trainerLc],
  );

  function toggle(t: PanelUser) {
    const current = parseAssigned(t.assignedTrainer);
    const next = current.includes(trainerLc)
      ? current.filter((e) => e !== trainerLc)
      : [...current, trainerLc];
    onSave(t.email, next, `assign:${trainer.email}:${t.email}`);
  }

  /** 대상 trainees 에 대해 이 trainer 를 add/remove 일괄 적용. */
  function bulkApply(targets: PanelUser[], state: "add" | "remove") {
    for (const t of targets) {
      const current = parseAssigned(t.assignedTrainer);
      const has = current.includes(trainerLc);
      if (state === "add" && has) continue;
      if (state === "remove" && !has) continue;
      const next =
        state === "add"
          ? [...current, trainerLc]
          : current.filter((e) => e !== trainerLc);
      onSave(t.email, next, `assign:${trainer.email}:${t.email}`);
    }
  }

  const grouped = groupByCohort(trainees);
  const bulkBusy = busy?.startsWith(`assign:${trainer.email}:`) ?? false;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-gray-900">
            {trainer.name || trainer.email}
          </div>
          <div className="truncate text-[11px] text-gray-500">
            {trainer.email} · 담당 {assignedCount}명
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          {/* 전체 일괄 토글 — 트레이너 연습용 시트 등 모두 배정 필요할 때. */}
          {trainees.length > 0 && (
            <div className="mb-3 flex items-center justify-end gap-1.5 border-b border-gray-200 pb-2 text-[11px]">
              <span className="mr-auto text-gray-500">일괄 토글:</span>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulkApply(trainees, "add")}
                className="rounded-full border border-red-200 bg-white px-2.5 py-1 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                전체 선택
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulkApply(trainees, "remove")}
                className="rounded-full border border-gray-300 bg-white px-2.5 py-1 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                전체 해제
              </button>
            </div>
          )}

          {grouped.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">수강생 없음</p>
          ) : (
            <div className="space-y-3">
              {grouped.map(([cohort, list]) => (
                <div key={cohort}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <span>
                      {cohort}기 · {list.length}명
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => bulkApply(list, "add")}
                        className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[9px] font-bold normal-case text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        기수 선택
                      </button>
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => bulkApply(list, "remove")}
                        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[9px] font-bold normal-case text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        기수 해제
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {list.map((s) => {
                      const checked = parseAssigned(s.assignedTrainer).includes(
                        trainerLc,
                      );
                      const key = `assign:${trainer.email}:${s.email}`;
                      return (
                        <label
                          key={s.email}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${checked ? "bg-red-50" : "hover:bg-white"} ${busy === key ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy !== null}
                            onChange={() => toggle(s)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-red-200"
                          />
                          <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">
                            {s.name || s.email}
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {s.email}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Section 3 ─────────────────────── */
export function SectionTraineeList({ trainees }: { trainees: PanelUser[] }) {
  const grouped = groupByCohort(trainees);
  return (
    <section>
      <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">
        수강생 명단 ({trainees.length})
      </h2>
      <div className="space-y-2">
        {grouped.map(([cohort, list]) => (
          <details
            key={cohort}
            className="group overflow-hidden rounded-xl border border-gray-200 bg-white open:bg-gray-50"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
              <span className="text-sm font-bold text-gray-900">
                {cohort}기 · {list.length}명
              </span>
              <svg
                className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-gray-100 p-3">
              <ul className="ml-3 space-y-1 text-xs">
                {list.map((s) => {
                  const assigned = parseAssigned(s.assignedTrainer);
                  return (
                    <li key={s.email}>
                      <div className="text-gray-800">
                        ㄴ <span className="font-semibold">{s.name || s.email}</span>{" "}
                        <span className="text-gray-400">({s.email})</span>
                      </div>
                      <div className="ml-4 text-[10px] text-gray-500">
                        {assigned.length > 0 ? `담당: ${assigned.join(", ")}` : "미배정"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────── Section 4 ─────────────────────── */
export function SectionTrainerList({
  trainers,
  trainees,
}: {
  trainers: PanelUser[];
  trainees: PanelUser[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">
        트레이너 명단 ({trainers.length})
      </h2>
      <div className="space-y-2">
        {trainers.map((tr) => {
          const trainerLc = tr.email.toLowerCase();
          const myTrainees = trainees.filter((s) =>
            parseAssigned(s.assignedTrainer).includes(trainerLc),
          );
          const grouped = groupByCohort(myTrainees);
          return (
            <details
              key={tr.email}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white open:bg-gray-50"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900">
                    {tr.name || tr.email}
                  </div>
                  <div className="truncate text-[11px] text-gray-500">
                    {tr.email} · 담당 {myTrainees.length}명
                  </div>
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="border-t border-gray-100 p-3">
                {grouped.length === 0 ? (
                  <p className="py-2 text-center text-xs text-gray-400">담당 수강생 없음</p>
                ) : (
                  <div className="space-y-3">
                    {grouped.map(([cohort, list]) => (
                      <div key={cohort}>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          {cohort}기
                        </div>
                        <ul className="ml-3 space-y-0.5 text-xs">
                          {list.map((s) => (
                            <li key={s.email} className="text-gray-700">
                              ㄴ {s.name || s.email}{" "}
                              <span className="text-gray-400">({s.email})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
