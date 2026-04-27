/**
 * 일정·계약 탭 (placeholder).
 * 실제 구현은 PR 3 — 주간 뷰, 5상태 미팅 카드, 4가지 인라인 액션.
 * 시안: docs/design/prototypes/schedule-weekly.html (v2)
 */
export default function SchedulePage() {
  return (
    <section className="px-4 pt-6">
      <h1 className="text-xl font-bold text-slate-900">일정·계약</h1>
      <p className="mt-1 text-sm text-slate-500">
        주간 미팅 처리 (예약/계약/완료/변경/취소)
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        <div className="font-semibold text-slate-700">PR 3 에서 구현</div>
        <div className="mt-1 text-xs">셸만 먼저 — 5탭 네비게이션 동작 확인용</div>
      </div>
    </section>
  );
}
