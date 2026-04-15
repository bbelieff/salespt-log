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
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        부트스트랩 상태. 다음 plan 에서 로그인·온보딩 화면을 붙입니다.
      </div>
    </main>
  );
}
