/**
 * TrainerMgmtListSections — 명단 표시용 (Section 3 & 4) 분리.
 * 파일 크기 가드 (TrainerMgmtSections 가 ≤500줄 유지하도록).
 */
"use client";

import { type PanelUser, parseAssigned, groupByCohort } from "./TrainerMgmtSections";

/* ─────────────────────── Section 3: 수강생 명단 ─────────────────────── */
export function SectionTraineeList({
  trainees,
  activeTrainers,
}: {
  trainees: PanelUser[];
  activeTrainers: PanelUser[];
}) {
  const grouped = groupByCohort(trainees);
  const nameByEmail = new Map<string, string>();
  for (const t of activeTrainers) {
    nameByEmail.set(t.email.toLowerCase(), t.name || t.email);
  }
  const resolveTrainerName = (e: string) =>
    nameByEmail.get(e.toLowerCase()) ?? e;
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
                  const names = assigned.map(resolveTrainerName);
                  return (
                    <li key={s.email}>
                      <div className="text-gray-800">
                        ㄴ <span className="font-semibold">{s.name || s.email}</span>{" "}
                        <span className="text-gray-400">({s.email})</span>
                      </div>
                      <div className="ml-4 text-[10px] text-gray-500">
                        {names.length > 0 ? `담당: ${names.join(", ")}` : "미배정"}
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

/* ─────────────────────── Section 4: 트레이너 명단 ─────────────────────── */
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
                              ㄴ {s.name || s.email}
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
