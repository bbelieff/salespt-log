"use client";
/** 「주 | 월」 — 폰·태블릿 페이지 띠에 넣는 보기 전환(주 = 일정·계약 보라, 월 = 캘린더 하늘). PC 보드는 BoardTitle 안의 같은 버튼을 쓴다. */
export default function ViewSwitch({ view, onView, className = "" }: { view: "week" | "month"; onView: (v: "week" | "month") => void; className?: string }) {
  const on = view === "month" ? "bg-sky-700" : "bg-violet-600";
  return (
    <div role="group" aria-label="보기" className={`flex h-9 w-[88px] shrink-0 items-center gap-0.5 rounded-[11px] bg-slate-900/[0.06] p-[3px] ${className}`}>
      {(["week", "month"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => view !== v && onView(v)} title={v === "week" ? "주 보기(일정·계약)" : "월 보기(캘린더)"}
          className={`flex h-[30px] min-w-0 flex-1 items-center justify-center rounded-lg text-px-13 font-bold ${view === v ? `${on} font-extrabold text-white shadow-sm` : "text-slate-600"}`}>{v === "week" ? "주" : "월"}</button>
      ))}
    </div>
  );
}
