/**
 * /admin/users Tier 0 — 권한 통과 즉시 렌더되는 정적 골격.
 * 데이터 의존 0(props 없음) — Tier 1(UsersRoster)의 fast fetch 가 끝나기 전까지의
 * "빈 화면" 구간을 없애는 게 유일한 목적 (BBE-249, A 설계서 §① Tier 0).
 */
export default function UsersSkeleton() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master · 수강생 관리
            </div>
            <div className="mt-0.5 h-4 w-40 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-6 w-24 shrink-0 animate-pulse rounded-full bg-gray-100" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl pc:max-w-5xl px-6 py-8">
        <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 h-11 w-full animate-pulse rounded-xl bg-gray-100" />

        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl border border-gray-200 bg-white"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
