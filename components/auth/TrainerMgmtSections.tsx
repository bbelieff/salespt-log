/**
 * TrainerMgmtSections — TrainerMgmtPanel 의 4 섹션 분리 (파일 크기 가드).
 *
 *   SectionPending     — pending 승인/거절
 *   SectionAssign      — 트레이너별 카드 + 수강생 다중 체크박스
 *   SectionTraineeList — 수강생 명단 (기수별 아코디언)
 *   SectionTrainerList — 트레이너 명단 (담당 수강생 아코디언)
 */
"use client";

import SortableList from "./SortableList";
import TrainerAssignCard from "./TrainerAssignCard";

export interface PanelUser {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  status?: string;
  assignedTrainer?: string;
  /** 아레나 회장이 맡은 cohort(예 "A1-1"). 빈값=일반. 그룹키·👑 마커용. */
  captainOf?: string;
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

/** 그룹키 = captainOf(아레나 회장, 옛 기수로 저장돼도 통일) || cohort, 기 제거.
 * 입력(listAllUsers)이 cohortSortTuple 로 이미 정렬 → 여기선 재정렬 금지하고
 * 삽입순(=정렬순) 보존. 정렬 단일출처 원칙(arena-grouping §1). */
export function groupByCohort(users: PanelUser[]): Array<[string, PanelUser[]]> {
  const map = new Map<string, PanelUser[]>();
  for (const u of users) {
    const key = String(u.captainOf || u.cohort).replace(/기\s*$/, "").trim() || "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }
  return Array.from(map.entries());
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
  onRemoveTrainer,
  onMoveToManagement,
  onReorder,
  viewOnly = false,
}: {
  trainers: PanelUser[];
  trainees: PanelUser[];
  busy: string | null;
  onSave: (traineeEmail: string, trainerEmails: string[], key: string) => void;
  onRemoveTrainer?: (email: string) => void;
  onMoveToManagement?: (email: string) => void;
  /** PR C-2: 트레이너 카드 드래그 정렬 결과. emails = 새 순서. 미제공이면 dnd 비활성. */
  onReorder?: (emails: string[]) => void | Promise<void>;
  viewOnly?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-black tracking-tight text-gray-900">
        트레이너 담당 부여
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        트레이너 카드를 펼쳐 담당 수강생을 다중 선택하세요. 한 수강생을 여러
        트레이너에 동시 배정 가능 — 토글 즉시 저장. 좌측 [⋮⋮] 핸들로 카드 순서 변경.
      </p>
      {trainers.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
          활성 트레이너가 없습니다. 요청관리에서 먼저 승인하세요.
        </p>
      ) : (
        <div className="space-y-2">
          <SortableList
            items={trainers}
            getId={(t) => t.email}
            onReorder={onReorder}
            disabled={viewOnly}
            renderItem={(tr, drag) => (
              <TrainerAssignCard
                key={tr.email}
                trainer={tr}
                trainees={trainees}
                busy={busy}
                onSave={onSave}
                onRemoveTrainer={onRemoveTrainer}
                onMoveToManagement={onMoveToManagement}
                viewOnly={viewOnly}
                dragRef={drag?.ref}
                dragStyle={drag?.style}
                dragAttributes={drag?.attributes}
                dragListeners={drag?.listeners}
                isDragging={drag?.isDragging}
              />
            )}
          />
        </div>
      )}
    </section>
  );
}


/* ─────────────────────── Section 3 ─────────────────────── */
export function SectionTraineeList({
  trainees,
  activeTrainers,
}: {
  trainees: PanelUser[];
  activeTrainers: PanelUser[];
}) {
  const grouped = groupByCohort(trainees);
  // email → 이름 매핑 (담당 표시용). 이름 없으면 email 그대로.
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
                {cohort === "—" ? "미분류" : `${cohort}기`} · {list.length}명
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
                        ㄴ <span className="font-semibold">{s.name || s.email}</span>
                        {s.captainOf ? <span title="회장"> 👑</span> : null}{" "}
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

// Section 4 (관리부서 명단) → ./TrainerMgmtManagement 분리 (파일 크기 가드).
export { SectionManagement } from "./TrainerMgmtManagement";
