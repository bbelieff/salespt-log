/**
 * SectionManagement — 관리부서 명단 섹션 (파일 크기 가드로 분리).
 * 트레이너 카드의 [관리부서] 버튼 클릭 시 이 섹션으로 이동된 인원 표시.
 */
"use client";

import type { PanelUser } from "./TrainerMgmtSections";

export function SectionManagement({
  staff,
  busy,
  onMoveToTrainer,
  onRemove,
}: {
  staff: PanelUser[];
  busy: string | null;
  onMoveToTrainer?: (email: string) => void;
  onRemove?: (email: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-black tracking-tight text-gray-900">
        관리부서 명단 ({staff.length})
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        담당 배정 대상에서 제외된 인원. 언제든 트레이너로 다시 이동 가능.
      </p>
      {staff.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
          관리부서 인원 없음.
        </p>
      ) : (
        <ul className="space-y-2">
          {staff.map((m) => {
            const disabled =
              busy === `dept:${m.email}` || busy === `remove:${m.email}`;
            return (
              <li
                key={m.email}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900">
                    {m.name || m.email}
                  </div>
                  <div className="truncate text-[11px] text-gray-500">{m.email}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {onMoveToTrainer && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onMoveToTrainer(m.email)}
                      className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      title="트레이너로 다시 이동"
                    >
                      {busy === `dept:${m.email}` ? "..." : "트레이너로"}
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemove(m.email)}
                      className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy === `remove:${m.email}` ? "..." : "삭제"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
