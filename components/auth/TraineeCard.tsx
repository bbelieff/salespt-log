/**
 * TraineeCard — /admin/users 의 개별 수강생 카드.
 *
 * AdminUserPickerSections.tsx 의 CohortSection / 팀 박스 안에서 사용.
 * 카드 안 액션:
 *   - 정보: 이름·email·다중계정 배지·담당 트레이너
 *   - 팀명 inline input (Enter/blur 시 자동 저장)
 *   - [유보] / [📊 시트 ↗] / [웹앱 →]
 *
 * 500줄 cap 회피로 별도 파일.
 */
"use client";

import { useEffect, useState } from "react";
import { parseAssigned, type Trainee } from "./AdminUserPickerTypes";

function LinkedAccountsBadge({ siblings }: { siblings: string[] }) {
  if (siblings.length === 0) return null;
  return (
    <span
      title={`같은 시트 공유: ${siblings.join(", ")}`}
      className="ml-1 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700"
    >
      🔗 +{siblings.length}
    </span>
  );
}

function siblingEmails(
  u: Trainee,
  linkedBySheet?: Map<string, string[]>,
): string[] {
  if (!linkedBySheet || !u.spreadsheetId) return [];
  const all = linkedBySheet.get(u.spreadsheetId) ?? [];
  const meLc = u.email.toLowerCase();
  return all.filter((e) => e.toLowerCase() !== meLc);
}

export default function TraineeCard({
  u,
  archived,
  viewOnly,
  busy,
  nameByEmail,
  linkedBySheet,
  onPick,
  onReserve,
  onSetTeam,
}: {
  u: Trainee;
  archived: boolean;
  viewOnly: boolean;
  busy: string | null;
  nameByEmail: Map<string, string>;
  linkedBySheet?: Map<string, string[]>;
  onPick: (email: string) => void;
  onReserve: (email: string) => void;
  onSetTeam: (email: string, team: string) => void;
}) {
  const assigned = parseAssigned(u.assignedTrainer);
  const trainerNames =
    assigned.length > 0
      ? assigned.map((e) => nameByEmail.get(e) ?? e).join(", ")
      : "미배정";

  // team input 로컬 state — prop 갱신 시 sync.
  const [team, setTeam] = useState(u.team ?? "");
  useEffect(() => {
    setTeam(u.team ?? "");
  }, [u.team]);

  const trimmed = team.trim();
  const dirty = trimmed !== (u.team ?? "").trim();

  function commit() {
    if (!dirty) return;
    onSetTeam(u.email, trimmed);
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${archived ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-black text-gray-900">
            {u.name || "(이름 없음)"}
          </span>
          <span className="text-[11px] text-gray-400">{u.email}</span>
          <LinkedAccountsBadge siblings={siblingEmails(u, linkedBySheet)} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
          <span>
            <span className="text-gray-400">담당</span>{" "}
            <span className="font-semibold">{trainerNames}</span>
          </span>
          {!viewOnly && (
            <span className="inline-flex items-center gap-1">
              <span className="text-gray-400">팀</span>
              <input
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="미배정"
                className={`rounded border px-1.5 py-0.5 text-[11px] outline-none ${
                  dirty
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-gray-200 bg-white"
                } focus:border-indigo-500`}
                style={{ width: 70 }}
              />
            </span>
          )}
        </div>
      </div>
      {!viewOnly && (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onReserve(u.email)}
            disabled={busy !== null}
            title="명단에서 숨김 (유보로 이동, row 는 살아있음)"
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === u.email ? "..." : "유보"}
          </button>
          {u.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${u.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              title="구글 시트 원본 새 탭으로 열기"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
            >
              📊 시트 ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => onPick(u.email)}
            disabled={busy !== null}
            title="웹앱 (5탭 UI) 으로 진입 — impersonation"
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
          >
            {busy === u.email ? "여는 중..." : "웹앱 →"}
          </button>
        </div>
      )}
    </div>
  );
}
