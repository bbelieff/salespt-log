/**
 * AdminTodoList — 관리자 홈 「오늘 할 일」(admin-phase1, 2026-11-16).
 *
 * 숫자와 그 일을 하는 화면으로 가는 링크만 보여 준다(표시 전용, 데이터는 service getAdminTodoCounts).
 * 숫자가 0 이면 「없음」, 읽지 못했으면(null) 「확인 불가」. 기수 생성 실패분은 있을 때만 줄이 생긴다.
 */
import Link from "next/link";
import type { AdminTodoCounts } from "@/service/admin-pending";

interface Row {
  key: keyof AdminTodoCounts;
  label: string;
  hint: string;
  href: string;
  unit: string;
  /** 0 이면 줄 자체를 숨긴다. */
  hideWhenZero?: boolean;
}

const ROWS: Row[] = [
  { key: "pendingTrainees", label: "승인 대기 수강생", hint: "가입 요청을 승인하거나 거절해요", href: "/admin/users", unit: "명" },
  { key: "pendingTrainers", label: "승인 대기 트레이너", hint: "요청관리에서 승인하거나 거절해요", href: "/admin/trainers", unit: "명" },
  { key: "unassignedTrainees", label: "담당 없는 활성 수강생", hint: "수강생 관리에서 담당을 정해요", href: "/admin/users", unit: "명" },
  { key: "cohortCreateFailures", label: "기수 생성 실패분", hint: "시트 복제가 실패한 건 — 기수 화면에서 다시 시도해요", href: "/admin/cohorts", unit: "건", hideWhenZero: true },
  { key: "newBugReports", label: "새 오류 신고", hint: "최근 7일 안에 들어온 신고", href: "/admin/reports", unit: "건" },
];

export default function AdminTodoList({ counts }: { counts: AdminTodoCounts }) {
  const rows = ROWS.filter((r) => !(r.hideWhenZero && !counts[r.key]));
  return (
    <section aria-labelledby="admin-todo-title" className="surface-panel">
      <h2 id="admin-todo-title" className="section-head">오늘 할 일</h2>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => {
          const n = counts[r.key];
          const todo = (n ?? 0) > 0;
          return (
            <li key={r.key}>
              <Link href={r.href} data-todo={r.key} className="group flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-red-600">{r.label}</span>
                  <span className="block truncate text-xs text-slate-500">{r.hint}</span>
                </span>
                <span
                  className={`shrink-0 text-right text-sm font-black tabular-nums ${todo ? "text-red-600" : "text-slate-400"}`}
                >
                  {n === null ? "확인 불가" : todo ? `${n.toLocaleString("ko-KR")}${r.unit}` : "없음"}
                </span>
                <span aria-hidden className="shrink-0 text-slate-300">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
