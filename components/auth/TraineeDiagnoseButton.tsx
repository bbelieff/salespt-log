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

/**
 * 룰별 평문 설명 (2026-05-17 [B1] — 사용자가 모달 결과 보고 무슨 의미인지 알게).
 * 룰 추가 시 여기도 같이 update.
 */
const RULE_EXPLANATION: Record<string, { what: string; why: string; action: string }> = {
  "formula-needs-restore": {
    what: "영업관리 탭의 I열 (4지표 자동 집계 수식) 이 누락됐거나 옛 패턴 ($C{r}) 입니다.",
    why: "이 수식이 비어있으면 일일 합계·주차별 funnel 이 0 으로 표시됩니다.",
    action: "[fix] 클릭 → installFormulas 자동 복원 (사용자 raw 입력은 보존).",
  },
  "meetings-formulas-missing": {
    what: "04 업체관리 탭의 N/O/Q 열 (표시 수식) 이 누락됐습니다.",
    why: "미팅 카드 생성해도 영업관리 I/J 열에 미팅 표시 문자열이 안 채워집니다.",
    action: "[fix] 클릭 → 빈 cell 에만 수식 install (raw 값은 보존).",
  },
  "metric-vs-meeting-mismatch": {
    what: "영업관리 H열 합계와 04 업체관리의 실제 미팅 row 수가 다릅니다.",
    why: "사용자가 미팅카드 만든 횟수 != 시트의 H 컬럼 카운트 — 사고 흔적.",
    action: "자동 fix 불가. 시트에서 H 컬럼 ↔ 04 업체관리 row 수동 비교 필요.",
  },
  "o1-o2-validity": {
    what: "시트 O1 (수강시작일) / O2 (종강총회일) 값이 비었거나 offset 이 50/57 일이 아닙니다.",
    why: "주차 계산·D-day 가 어긋남.",
    action: "시트 O1/O2 직접 열어서 날짜 수정 (7기+: O2=O1+50일, 6기 legacy: +57일).",
  },
  "revenue-mismatch": {
    what: "대시보드 D21 (시트 수식 매출) ≠ 02 계약수납관리 row 수임비 합 (실제 데이터).",
    why: "대시보드 KPI 와 수납탭이 다른 매출액을 표시 → 사용자 혼란.",
    action: "자동 fix 불가. 시트 D21 수식의 SUM 범위 / row 누락 직접 확인 필요.",
  },
  "sheet-merges-conflict": {
    what: "데이터 쓰기 영역(영업관리 E~H × row 10~277, 미팅/수납 data row)과 교차하는 multi-row 셀병합이 있습니다.",
    why: "이런 병합이 있으면 웹의 쓰기가 마스터 cell 로 redirect 되어 다른 row 를 덮어쓸 수 있음. C열 날짜 4-row 묶음 같은 정상 병합은 제외됨.",
    action: "자동 해제 불가 (시각 디자인 파괴 위험). 시트에서 detail 의 A1 좌표 직접 확인 후 해제 판단.",
  },
};

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
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-gray-900">
                  🔍 {name} 시트 진단
                </h3>
                <div className="mt-0.5 break-all text-[11px] text-gray-500">
                  {email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800"
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
                {results.map((r) => {
                  const exp = RULE_EXPLANATION[r.ruleId];
                  return (
                    <div
                      key={r.ruleId}
                      className={`rounded-xl border p-3 ${severityColor[r.severity]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">
                            {r.severity === "error" ? "🚨" : r.severity === "warn" ? "⚠️" : "ℹ️"}{" "}
                            {r.label}
                          </div>
                          {exp ? (
                            <div className="mt-2 space-y-1.5 rounded-lg bg-white/70 p-2 text-xs text-gray-800">
                              <div>
                                <b className="text-gray-900">무엇이</b>: {exp.what}
                              </div>
                              <div>
                                <b className="text-gray-900">왜 문제</b>: {exp.why}
                              </div>
                              <div>
                                <b className="text-gray-900">해결</b>: {exp.action}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-xs">{r.detail}</div>
                          )}
                          {exp && (
                            <div className="mt-1.5 text-[11px] opacity-70">
                              상세: {r.detail}
                            </div>
                          )}
                          <div className="mt-1 font-mono text-[10px] opacity-50">
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
                  );
                })}
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
