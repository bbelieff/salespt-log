/**
 * SystemStatusStrip — 「시스템 상태」 띠(admin-phase1, 2026-11-16).
 *
 * 예전 관리자 홈의 「DB 파일럿」 띠를 이름만 바꿔 설정 > 진단으로 옮긴 것. 표시 전용.
 * 회색 = DB 미설정 · 초록 = 연결 OK(응답 시간·기록 행수·시트 반영 대기) · 빨강 = 연결 실패.
 */
import type { DbPilotStatus } from "@/service";

export default function SystemStatusStrip({ status }: { status: DbPilotStatus }) {
  const tone = !status.enabled
    ? "border-slate-200 bg-slate-50 text-slate-500"
    : status.ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${tone}`}>
      <span aria-hidden className="text-base">🗄️</span>
      <span className="font-black">시스템 상태</span>
      {!status.enabled && <span>DB 미설정 (DATABASE_URL 없음)</span>}
      {status.enabled && status.ok && (
        <span>
          연결 OK · 응답 {status.latencyMs}ms · 기록 {(status.rows ?? 0).toLocaleString("ko-KR")}행
          {(status.mirrorPending ?? 0) > 0 && ` · 시트 반영 대기 ${status.mirrorPending}행`}
        </span>
      )}
      {status.enabled && !status.ok && <span className="min-w-0 break-words">연결 실패 — {status.error ?? "unknown"}</span>}
    </div>
  );
}
