/**
 * AdminUserPicker 의 sub-component 들.
 * 메인 파일(AdminUserPicker.tsx)이 500줄 cap 을 넘어 분리.
 *
 * - Trainee/Trainer 타입 + parseAssigned/fmtDateYY/cohortProgress 공용 유틸
 * - CohortSection: 기수별 카드 리스트 (활성/보관 둘 다 사용)
 * - ReservedSection: 유보 처리된 trainee 만 모은 collapsible
 */
"use client";

export interface Trainee {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  assignedTrainer?: string;
  courseStartISO?: string;
  graduationISO?: string;
}

export interface Trainer {
  email: string;
  name: string;
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

/** "2026-04-10" → "26/04/10". 빈 값 → null. */
export function fmtDateYY(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-");
  return `${y!.slice(-2)}/${m}/${d}`;
}

/** 기수 진행률 (%) + D-day 계산. start~end 사이 today 기준. */
export function cohortProgress(
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

/* ─────────────────────────── 기수별 섹션 ─────────────────────────── */
export function CohortSection({
  cohort,
  list,
  busy,
  nameByEmail,
  onPick,
  onReserve,
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
                  <LinkedAccountsBadge siblings={siblingEmails(u, linkedBySheet)} />
                </div>
                <div className="mt-1.5 text-[11px] text-gray-600">
                  <span className="text-gray-400">담당</span>{" "}
                  <span className="font-semibold">{trainerNames}</span>
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
                  <button
                    type="button"
                    onClick={() => onPick(u.email)}
                    disabled={busy !== null}
                    className="rounded-full bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
                  >
                    {busy === u.email ? "여는 중..." : "시트 열기 →"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
    <details className="group rounded-2xl border border-amber-200 bg-amber-50/40 open:bg-white">
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
    </details>
  );
}

/* BulkPrepForm + parsePrepText 는 ./TraineePrepBulkForm.tsx 로 분리 (500줄 cap). */

/* ──────────────── 신규 수강생 사전 등록 폼 (단일) ──────────────── */
//
// admin 이 시트 URL + (기수, 이름) 입력 → registry prep row 생성.
// 본인이 self-claim 시 (기수, 이름) 매칭으로 즉시 활성. Drive 자동 검색·시트
// 이름 일치 의존 없음 — 사용자가 시트 이름을 자유롭게 (예: `(new)` suffix).
export function TraineePrepForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (
    cohort: string,
    name: string,
    spreadsheetUrl: string,
  ) => Promise<void>;
}) {
  return (
    <details className="rounded-2xl border border-sky-200 bg-sky-50/50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-sky-800 hover:bg-sky-100">
        ➕ 신규 수강생 사전 등록 (시트 URL → 자동 매핑)
      </summary>
      <form
        className="space-y-2 border-t border-sky-200 px-4 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const cohort = String(fd.get("cohort") ?? "").trim();
          const name = String(fd.get("name") ?? "").trim();
          const url = String(fd.get("spreadsheetUrl") ?? "").trim();
          if (!cohort || !name || !url) return;
          await onSubmit(cohort, name, url);
          (e.currentTarget as HTMLFormElement).reset();
        }}
      >
        <p className="text-[11px] text-gray-500">
          시트 URL 을 입력하면 자동으로 spreadsheetId 추출. 본인이 같은 기수·이름
          으로 로그인하면 즉시 활성 (Drive 검색 우회).
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_1fr]">
          <input
            name="cohort"
            type="text"
            inputMode="numeric"
            placeholder="기수"
            required
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <input
            name="name"
            type="text"
            placeholder="이름 (예: 손기학)"
            required
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
        </div>
        <input
          name="spreadsheetUrl"
          type="text"
          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? "등록 중..." : "사전 등록"}
        </button>
      </form>
    </details>
  );
}

/* ──────────────── 승인 대기 수강생 섹션 (pending) ──────────────── */
//
// 트레이너 SectionPending(components/auth/TrainerMgmtSections.tsx) 와 동일한
// 패턴 — admin 이 [승인]/[거절] 클릭. 거절은 registry row 영구 삭제(reject API
// 가 pending 일 때만 허용 — 활성 수강생 실수 삭제 가드).
export function PendingTraineesSection({
  list,
  busy,
  onApprove,
  onReject,
  linkedBySheet,
  viewOnly = false,
}: {
  list: Trainee[];
  busy: string | null;
  onApprove: (email: string) => void;
  onReject: (email: string, name: string) => void;
  linkedBySheet?: Map<string, string[]>;
  viewOnly?: boolean;
}) {
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-700">
        ⏳ 승인 대기 수강생 · {list.length}명
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
