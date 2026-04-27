/**
 * 캘린더 탭 (placeholder).
 * 실제 구현은 PR 3 — 월간 6×7 그리드, 셀 안 미팅 박스, 선택 날짜 하단 카드.
 * 시안: docs/design/prototypes/calendar-monthly.html (v3)
 */
export default function CalendarPage() {
  return (
    <section className="px-4 pt-6">
      <h1 className="text-xl font-bold text-slate-900">캘린더</h1>
      <p className="mt-1 text-sm text-slate-500">월간 미팅 시각화 (읽기 전용 + 점프)</p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        <div className="font-semibold text-slate-700">PR 3 에서 구현</div>
        <div className="mt-1 text-xs">셸만 먼저 — 5탭 네비게이션 동작 확인용</div>
      </div>
    </section>
  );
}
