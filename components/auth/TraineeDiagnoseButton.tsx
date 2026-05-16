/**
 * TraineeDiagnoseButton — TraineeCard 의 [🔍 진단] 버튼 + 결과 modal (2026-05-16).
 *
 * **설계**: 60명 일괄 진단 X — 개별 trainee 단위로 진단·픽스. PR 마다 새 룰 누적
 * (Hashimoto 가드). 클릭 → POST /api/admin/diagnose-sheet → result modal.
 * 각 이슈 옆 [🔧 fix] 버튼 (fixable 인 경우만).
 */
"use client";

import { useState } from "react";

interface DiagnosticResult {
  ruleId: string;
  label: string;
  severity: "info" | "warn" | "error";
  detail: string;
  fixable: boolean;
}

interface Props {
  email: string;
  name: string;
}

export default function TraineeDiagnoseButton({ email, name }: Props) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [fixingRuleId, setFixingRuleId] = useState<string | null>(null);

  async function runDiagnose() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/diagnose-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setResults(data.results as DiagnosticResult[]);
        setOpen(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  async function runFix(ruleId: string) {
    if (!window.confirm(`${name} 시트에 [${ruleId}] fix 를 실행할까요?`)) return;
    setFixingRuleId(ruleId);
    setError(null);
    try {
      const res = await fetch("/api/admin/fix-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ruleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        window.alert(`fix 완료: ${data.summary}\n→ 다시 [진단] 클릭해서 재검증`);
        // 결과를 자동 재로드: 사용자가 다시 누르면 새 상태 반영
        setResults(null);
        setOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setFixingRuleId(null);
    }
  }

  const severityColor: Record<DiagnosticResult["severity"], string> = {
    info: "border-sky-200 bg-sky-50 text-sky-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <>
      <button
        type="button"
        onClick={runDiagnose}
        disabled={busy}
        title="시트 진단 (개별 trainee read-only 스캔)"
        className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "..." : "🔍 진단"}
      </button>
      {open && results !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">
                🔍 {name} 시트 진단
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                ✕ 닫기
              </button>
            </div>
            {results.length === 0 ? (
              <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
                ✅ 모든 룰 통과 — 시트 정상
              </p>
            ) : (
              <div className="space-y-2">
                {results.map((r) => (
                  <div
                    key={r.ruleId}
                    className={`rounded-xl border p-3 ${severityColor[r.severity]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold">
                          {r.severity === "error" ? "🚨" : r.severity === "warn" ? "⚠️" : "ℹ️"}{" "}
                          {r.label}
                        </div>
                        <div className="mt-1 text-[11px] opacity-80">
                          {r.detail}
                        </div>
                        <div className="mt-1 text-[10px] font-mono opacity-60">
                          id: {r.ruleId}
                        </div>
                      </div>
                      {r.fixable && (
                        <button
                          type="button"
                          onClick={() => runFix(r.ruleId)}
                          disabled={fixingRuleId !== null}
                          className="shrink-0 rounded-full bg-gray-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-black disabled:opacity-50"
                        >
                          {fixingRuleId === r.ruleId ? "fix 중..." : "🔧 fix"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
      {!open && error && (
        <span className="ml-2 text-[10px] text-red-600" title={error}>
          ⚠ 에러
        </span>
      )}
    </>
  );
}
