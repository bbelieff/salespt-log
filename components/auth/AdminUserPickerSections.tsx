/**
 * AdminUserPicker 의 sub-component 들.
 * 메인 파일(AdminUserPicker.tsx)이 500줄 cap 을 넘어 분리.
 *
 * - CohortSection: 기수별 카드 리스트 (활성/보관 둘 다 사용)
 * - ReservedSection: 유보 처리된 trainee 만 모은 collapsible
 * - PendingTraineesSection: 승인 대기 수강생
 *
 * **순환 의존 차단** (2026-05-13): Trainee/Trainer 타입 + parseAssigned 등
 * 공용 헬퍼는 ./AdminUserPickerTypes.ts 로 분리. 이 파일은 TraineeCard 를
 * import 하고 TraineeCard 는 Types 를 import → 사이클 없음.
 */
"use client";

import TraineeCard from "./TraineeCard";
import PersistentDetails from "./PersistentDetails";
import {
  type Trainee,
  type Trainer,
  parseAssigned,
  fmtDateYY,
  cohortProgress,
} from "./AdminUserPickerTypes";

// 호환성을 위한 re-export — 옛 import 경로 유지.
export { parseAssigned, fmtDateYY, cohortProgress };
export type { Trainee, Trainer };

/**
 * 같은 spreadsheetId 를 공유하는 다른 계정 이메일 리스트 반환 (자기 자신 제외).
 * 같은 시트에 여러 계정이 연결되어 있을 때 카드에 표시용.
 */
function siblingEmails(
  u: Trainee,
  linkedBySheet?: Map<string, string[]>,
): string[] {
  if (!linkedBySheet || !u.spreadsheetId) return [];
  const all = linkedBySheet.get(u.spreadsheetId) ?? [];
  const meLc = u.email.toLowerCase();
  return all.filter((e) => e.toLowerCase() !== meLc);
}

/** "🔗 +N (email1, email2)" 작은 배지 — 시트 공유 표시. */
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

/** team 별로 trainees 그룹화. 미배정(team="") 은 별도 분리.
 *  반환: { unassigned: [], teamGroups: [[name, list], ...] (등록 순서 보존) } */
function groupByTeam(list: Trainee[]): {
  unassigned: Trainee[];
  teamGroups: Array<[string, Trainee[]]>;
} {
  const unassigned: Trainee[] = [];
  const map = new Map<string, Trainee[]>();
  for (const u of list) {
    const t = (u.team ?? "").trim();
    if (!t) {
      unassigned.push(u);
      continue;
    }
    const arr = map.get(t) ?? [];
    arr.push(u);
    map.set(t, arr);
  }
  return { unassigned, teamGroups: Array.from(map.entries()) };
}

/* ─────────────────────────── 기수별 섹션 ─────────────────────────── */
export function CohortSection({
  cohort,
  list,
  busy,
  nameByEmail,
  onPick,
  onReserve,
  onSetTeam,
  linkedBySheet,
  archived = false,
  viewOnly = false,
}: {
  cohort: string;
  list: Trainee[];
  busy: string | null;
  nameByEmail: Map<string, string>;
  onPick: (email: string) => void;
  /** "유보" 버튼 클릭 핸들러. admin 만 노출 (viewOnly=false). */
  onReserve: (email: string) => void;
  /** 팀명 변경 핸들러 — Enter 또는 blur 시 호출. 빈 문자열 = 미배정. */
  onSetTeam: (email: string, team: string) => void;
  /** 같은 spreadsheetId 의 모든 email 리스트 — 다중 계정 배지 표시용. */
  linkedBySheet?: Map<string, string[]>;
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
  // 기수 박스: 배경에서 더 잘 구분되게 slate 톤 + 진한 테두리. open 상태일 때
  // 헤더 영역에 좌측 indigo accent bar 로 무게감. (2026-05-13 시인성 개선)
  return (
    <PersistentDetails
      persistKey={`cohort:${cohort}${archived ? ":archived" : ""}`}
      defaultOpen
      className="group rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-sm open:bg-white open:shadow-md"
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-t-xl border-l-4 border-indigo-500 bg-slate-50 px-4 py-3 group-open:bg-white hover:bg-slate-100">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-indigo-500 transition-transform group-open:rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-base font-black tracking-tight text-gray-900">
          {cohort}기
        </span>
        <span className="text-xs font-bold text-indigo-700">
          · {list.length}명
        </span>
        {archived && (
          <span className="ml-0.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
            보관
          </span>
        )}
        {start && end && (
          <span className="ml-1 text-xs font-medium text-gray-500">
            개강 <span className="font-bold text-gray-800">{start}</span>{" "}
            ~ 종강 <span className="font-bold text-gray-800">{end}</span>
            {pct !== null && (
              <>
                {" · "}진행률{" "}
                <span className="font-bold text-gray-800">{pct}%</span>
                {dday !== null && (
                  <span className="ml-1 rounded-md bg-red-50 px-1.5 py-0.5 font-black text-brand-red">
                    D{dday >= 0 ? "-" : "+"}
                    {Math.abs(dday)}
                  </span>
                )}
              </>
            )}
          </span>
        )}
      </summary>
      <CohortBody
        cohort={cohort}
        list={list}
        archived={archived}
        viewOnly={viewOnly}
        busy={busy}
        nameByEmail={nameByEmail}
        linkedBySheet={linkedBySheet}
        onPick={onPick}
        onReserve={onReserve}
        onSetTeam={onSetTeam}
      />
    </PersistentDetails>
  );
}

/** CohortSection 의 body — team 별 그룹화. 미배정 카드 먼저, team 박스 다음. */
function CohortBody({
  cohort,
  list,
  archived,
  viewOnly,
  busy,
  nameByEmail,
  linkedBySheet,
  onPick,
  onReserve,
  onSetTeam,
}: {
  /** PersistentDetails key 구성 (`team:<cohort>:<teamName>`) 에 사용 */
  cohort: string;
  list: Trainee[];
  archived: boolean;
  viewOnly: boolean;
  busy: string | null;
  nameByEmail: Map<string, string>;
  linkedBySheet?: Map<string, string[]>;
  onPick: (email: string) => void;
  onReserve: (email: string) => void;
  onSetTeam: (email: string, team: string) => void;
}) {
  const { unassigned, teamGroups } = groupByTeam(list);
  return (
    <div className="space-y-2 border-t border-gray-100 px-4 py-3">
      {/* 미배정 trainees — 박스 없이 개별 카드. */}
      {unassigned.map((u) => (
        <TraineeCard
          key={u.email}
          u={u}
          archived={archived}
          viewOnly={viewOnly}
          busy={busy}
          nameByEmail={nameByEmail}
          linkedBySheet={linkedBySheet}
          onPick={onPick}
          onReserve={onReserve}
          onSetTeam={onSetTeam}
        />
      ))}
      {/* 팀 박스들 — 같은 팀 trainees 를 collapsible 로 묶음. */}
      {teamGroups.map(([teamName, members]) => (
        <PersistentDetails
          key={teamName}
          persistKey={`team:${cohort}:${teamName}${archived ? ":archived" : ""}`}
          defaultOpen
          className="rounded-xl border border-indigo-200 bg-indigo-50/30 open:bg-white"
        >
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50">
            🏷️ {teamName} · {members.length}명
          </summary>
          <div className="space-y-2 border-t border-indigo-100 px-3 py-2">
            {members.map((u) => (
              <TraineeCard
                key={u.email}
                u={u}
                archived={archived}
                viewOnly={viewOnly}
                busy={busy}
                nameByEmail={nameByEmail}
                linkedBySheet={linkedBySheet}
                onPick={onPick}
                onReserve={onReserve}
                onSetTeam={onSetTeam}
              />
            ))}
          </div>
        </PersistentDetails>
      ))}
    </div>
  );
}

/* ─────────────────────────── 유보 수강생 섹션 ─────────────────────────── */
export function ReservedSection({
  list,
  busy,
  nameByEmail,
  onRestore,
  onPurge,
  linkedBySheet,
  viewOnly = false,
}: {
  list: Trainee[];
  busy: string | null;
  nameByEmail: Map<string, string>;
  onRestore: (email: string) => void;
  onPurge: (email: string, name: string) => void;
  linkedBySheet?: Map<string, string[]>;
  viewOnly?: boolean;
}) {
  return (
    <PersistentDetails
      persistKey="reserved"
      defaultOpen={false}
      className="group rounded-2xl border border-amber-200 bg-amber-50/40 open:bg-white"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 hover:bg-amber-50">
        <span className="text-sm font-bold text-amber-800">
          🗂️ 유보 수강생 ({list.length}명)
        </span>
        <svg
          className="h-4 w-4 text-amber-500 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="space-y-2 border-t border-amber-200 px-4 py-4">
        <p className="mb-2 text-[11px] text-gray-500">
          명단에서 숨겨진 수강생. 복귀 시 정규 기수 그룹으로 돌아갑니다.
          퇴출은 registry row 영구 삭제 (개인 시트·권한은 그대로 유지).
        </p>
        {list.map((u) => {
          const assigned = parseAssigned(u.assignedTrainer);
          const trainerNames =
            assigned.length > 0
              ? assigned.map((e) => nameByEmail.get(e) ?? e).join(", ")
              : "미배정";
          return (
            <div
              key={u.email}
              className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-black text-gray-900">
                    {u.name || "(이름 없음)"}
                  </span>
                  <span className="text-[11px] text-gray-400">{u.email}</span>
                  <LinkedAccountsBadge siblings={siblingEmails(u, linkedBySheet)} />
                </div>
                <div className="mt-1.5 text-[11px] text-gray-600">
                  <span className="text-gray-400">담당</span>{" "}
                  <span className="font-semibold">{trainerNames}</span>
                </div>
              </div>
              {!viewOnly && (
                <div className="flex shrink-0 items-center gap-1.5">
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
                    onClick={() => onRestore(u.email)}
                    disabled={busy !== null}
                    className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-[11px] font-bold text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    {busy === u.email ? "..." : "복귀"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPurge(u.email, u.name)}
                    disabled={busy !== null}
                    title="registry row 영구 삭제"
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    퇴출
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PersistentDetails>
  );
}

/* TraineePrepForm 은 UnifiedPrepCard 로 통합됨 (PR feat/admin-users-ui-compact). */

/* ──────────────── 승인 대기 수강생 섹션 (pending) ──────────────── */
//
// 트레이너 SectionPending(components/auth/TrainerMgmtSections.tsx) 와 동일한
// 패턴 — admin 이 [승인]/[거절] 클릭. 거절은 registry row 영구 삭제(reject API
// 가 pending 일 때만 허용 — 활성 수강생 실수 삭제 가드).
export function PendingTraineesSection({
  list,
  busy,
  onApprove,
  onApproveAll,
  onReject,
  linkedBySheet,
  viewOnly = false,
}: {
  list: Trainee[];
  busy: string | null;
  onApprove: (email: string) => void;
  /** "모두 승인" — 한 번에 처리. confirm 후 실행. */
  onApproveAll?: () => void;
  onReject: (email: string, name: string) => void;
  linkedBySheet?: Map<string, string[]>;
  viewOnly?: boolean;
}) {
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
        <span>⏳ 승인 대기 수강생 · {list.length}명</span>
        {!viewOnly && onApproveAll && list.length > 1 && (
          <button
            type="button"
            onClick={onApproveAll}
            disabled={busy !== null}
            className="rounded-full bg-green-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            모두 승인 ({list.length})
          </button>
        )}
      </h2>
      <ul className="space-y-2">
        {list.map((u) => (
          <li
            key={u.email}
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-black text-gray-900">
                  {u.name || "(이름 없음)"}
                </span>
                <span className="text-[11px] text-gray-400">{u.email}</span>
                <LinkedAccountsBadge siblings={siblingEmails(u, linkedBySheet)} />
              </div>
              <div className="mt-1.5 text-[11px] text-gray-600">
                <span className="text-gray-400">기수</span>{" "}
                <span className="font-semibold">{u.cohort || "—"}</span>
              </div>
            </div>
            {!viewOnly && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onApprove(u.email)}
                  disabled={busy !== null}
                  className="rounded-full bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === u.email ? "..." : "승인"}
                </button>
                <button
                  type="button"
                  onClick={() => onReject(u.email, u.name)}
                  disabled={busy !== null}
                  className="rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  거절
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
