export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full bg-brand-500 px-4 py-1 text-sm font-semibold text-white">
        세일즈PT
      </div>
      <h1 className="text-3xl font-bold tracking-tight">영업일지</h1>
      <p className="text-slate-600">
        하루 4개 지표만 기록해도,
        <br />
        대시보드가 저절로 채워집니다.
      </p>
      <a
        href="/contact"
        className="mt-8 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
      >
        시작하기 →
      </a>
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-xs text-slate-500">
        로그인·온보딩 (별도 PR)은 추후 추가됩니다. 지금은 5탭 셸 동작 확인용.
      </div>
    </main>
  );
}
