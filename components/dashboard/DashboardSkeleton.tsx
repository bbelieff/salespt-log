/**
 * DashboardSkeleton — 대시보드 숫자를 불러오는 동안 구역 자리를 먼저 잡아 둔다(belie 2026-10-09).
 * 다 불러오면 같은 자리에 실제 구역이 들어와 화면이 덜컹이지 않는다. 동작 줄이기면 반짝임 없이 회색 막대만.
 * 화면 마감 v2 (2026-11-10): 구역은 상자 대신 「제목 + 아래 선」, 매출·비용·영업이익 자리는 맨 위 요약 띠 안
 * (HeroFinanceSkeleton — page 의 .surface-hero 안에서 그린다).
 */
const Bar = ({ className }: { className: string }) => <div className={`fx-skeleton rounded-md ${className}`} />;

function Section({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      <div className="mb-3 border-b border-slate-200/70 pb-2"><Bar className="h-4 w-24" /></div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} className={`h-3 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
        ))}
      </div>
    </div>
  );
}

/** 맨 위 요약 띠 안의 매출·비용·영업이익 자리 — 칸은 상자 없이 세로 선(.stat-split)으로 나눈다. */
export function HeroFinanceSkeleton() {
  return (
    <div aria-hidden="true">
      <Bar className="mb-2 h-4 w-32" />
      <div className="stat-split grid grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-3 pr-3">
            <Bar className="mb-2 h-3 w-10" />
            <Bar className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="대시보드 불러오는 중">
      <div className="grid gap-6 pc:grid-cols-3 pc:gap-8">
        <Section rows={5} />
        <div className="space-y-6"><Section rows={4} /><Section rows={2} /></div>
        <Section rows={6} />
      </div>
    </div>
  );
}
