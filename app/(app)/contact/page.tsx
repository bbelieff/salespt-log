/**
 * 컨택관리 탭 (placeholder).
 * 실제 구현은 PR 2 — 4채널×4지표 입력 + 미팅 슬롯 등록.
 * 시안: docs/design/prototypes/contact-daily-input.html (v7)
 */
export default function ContactPage() {
  return (
    <PlaceholderTab
      title="컨택관리"
      subtitle="4채널 × 4지표 (생산·유입·컨택진행·컨택성공) 입력"
      nextPr="PR 2"
    />
  );
}

function PlaceholderTab({
  title,
  subtitle,
  nextPr,
}: {
  title: string;
  subtitle: string;
  nextPr: string;
}) {
  return (
    <section className="px-4 pt-6">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        <div className="font-semibold text-slate-700">{nextPr} 에서 구현</div>
        <div className="mt-1 text-xs">셸만 먼저 — 5탭 네비게이션 동작 확인용</div>
      </div>
    </section>
  );
}
