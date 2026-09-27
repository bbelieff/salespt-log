"use client";

export default function PaymentListModeTabs({ value, onChange }: {
  value: "company" | "institution";
  onChange: (mode: "company" | "institution") => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1" role="group" aria-label="계약 목록 기준" data-payment-mode-tabs>
      {(["company", "institution"] as const).map((mode) => (
        <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)}
          className={`h-8 flex-1 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${mode === "institution" ? "focus-visible:ring-red-400" : "focus-visible:ring-blue-400"} ${value === mode ? mode === "institution" ? "bg-white text-red-700 shadow-sm" : "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {mode === "company" ? "업체" : "진행기관"}
        </button>
      ))}
    </div>
  );
}
