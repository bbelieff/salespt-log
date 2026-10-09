/**
 * DashboardSkeleton — 대시보드 숫자를 불러오는 동안 카드 자리를 먼저 잡아 둔다(belie 2026-10-09).
 * 다 불러오면 같은 자리에 실제 카드가 들어와 화면이 덜컹이지 않는다. 동작 줄이기면 반짝임 없이 회색 상자만.
 */
const Bar = ({ className }: { className: string }) => <div className={`fx-skeleton rounded-md ${className}`} />;

function Card({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <Bar className="mb-3 h-4 w-24" />
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} className={`h-3 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="대시보드 불러오는 중">
      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-2">
        <Bar className="mb-2 h-4 w-32" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white p-3">
              <Bar className="mb-2 h-3 w-10" />
              <Bar className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 pc:grid-cols-2">
        <Card rows={5} />
        <Card rows={6} />
        <Card rows={4} />
        <Card rows={4} />
      </div>
    </div>
  );
}
