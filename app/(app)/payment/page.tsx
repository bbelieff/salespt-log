/**
 * 수납 탭 (PR 09) — 일별 실적 입력.
 * 시트: 영업관리!Q~T (매입DB 행에만)
 *
 * 흐름:
 *   useDailyRevenue(date) → GET /api/payment/[date]
 *   draft 변경 → [💾 저장] → useSaveDailyRevenue.mutateAsync({date, revenue})
 *
 * 검증:
 *   - paymentCount > approvalCount → UI에서 자동 클램프
 *   - paymentCount=0 인데 paymentAmount>0 → 저장 시 경고 (서버측에서 0 강제)
 */
"use client";

import { useEffect, useState } from "react";
import {
  useDailyRevenue,
  useSaveDailyRevenue,
} from "@/query/contact-hooks";
import MetricStepper from "@/components/ui/MetricStepper";

const TODAY_ISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

interface Draft {
  approvalCount: number;
  paymentCount: number;
  paymentAmount: number;
  agencyNote: string;
}

const EMPTY_DRAFT: Draft = {
  approvalCount: 0,
  paymentCount: 0,
  paymentAmount: 0,
  agencyNote: "",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function PaymentPage() {
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [toast, setToast] = useState("");

  const dayQuery = useDailyRevenue(date);
  const save = useSaveDailyRevenue();

  // 서버 데이터 로드 시 draft 동기화
  useEffect(() => {
    if (!dayQuery.data) return;
    setDraft({
      approvalCount: dayQuery.data.approvalCount,
      paymentCount: dayQuery.data.paymentCount,
      paymentAmount: dayQuery.data.paymentAmount,
      agencyNote: dayQuery.data.agencyNote,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayQuery.data?.date]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const setApproval = (n: number) =>
    setDraft((d) => {
      const approval = Math.max(0, n);
      const payment = Math.min(d.paymentCount, approval);
      const amount = payment > 0 ? d.paymentAmount : 0;
      return {
        ...d,
        approvalCount: approval,
        paymentCount: payment,
        paymentAmount: amount,
      };
    });

  const setPayment = (n: number) =>
    setDraft((d) => {
      const payment = Math.max(0, Math.min(n, d.approvalCount));
      const amount = payment > 0 ? d.paymentAmount : 0;
      return { ...d, paymentCount: payment, paymentAmount: amount };
    });

  const setAmount = (n: number) =>
    setDraft((d) => ({ ...d, paymentAmount: Math.max(0, n) }));

  const setNote = (v: string) =>
    setDraft((d) => ({ ...d, agencyNote: v }));

  const handleSave = async () => {
    if (draft.paymentCount > 0 && draft.paymentAmount === 0) {
      showToast("⚠ 수납건수가 있는데 금액이 0입니다 — 확인 후 저장하세요");
      return;
    }
    try {
      await save.mutateAsync({
        date,
        revenue: draft,
      });
      showToast("✅ 저장 완료");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    }
  };

  const moveDate = (delta: number) => setDate((cur) => shiftDate(cur, delta));

  if (dayQuery.isLoading) {
    return (
      <section className="px-4 pt-6 text-sm text-slate-500">
        불러오는 중…
      </section>
    );
  }
  if (dayQuery.isError) {
    return (
      <section className="px-4 pt-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠ 불러오기 실패: {(dayQuery.error as Error).message}
        </div>
      </section>
    );
  }

  const monthDay = `${parseInt(date.slice(5, 7), 10)}월 ${parseInt(date.slice(8, 10), 10)}일`;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between px-2 py-3">
          <button
            type="button"
            onClick={() => moveDate(-1)}
            className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
            aria-label="전날"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <div className="text-base font-bold text-gray-900">
              💰 수납 · {monthDay}
              {date === TODAY_ISO && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                  오늘
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-gray-400">
              영업관리 시트 Q~T (매입DB 행)
            </div>
          </div>
          <button
            type="button"
            onClick={() => moveDate(1)}
            className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
            aria-label="다음날"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="px-4 pb-[160px] pt-4">
        <div className="space-y-3">
          <FieldRow
            label="승인건수"
            hint="오늘 승인 받은 건수 (Q열)"
            field={
              <MetricStepper
                value={draft.approvalCount}
                onChange={setApproval}
                ariaLabel="승인건수"
              />
            }
          />
          <FieldRow
            label="수납건수"
            hint="오늘 수납된 건수 · 승인건수 이하 (R열)"
            field={
              <MetricStepper
                value={draft.paymentCount}
                onChange={setPayment}
                max={draft.approvalCount}
                ariaLabel="수납건수"
                capped={draft.paymentCount >= draft.approvalCount}
                cappedHint="승인건수 이하만 가능"
              />
            }
          />
          <FieldRow
            label="수납금액"
            hint="단위: 만원 (S열)"
            field={
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.paymentAmount}
                  disabled={draft.paymentCount === 0}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-base font-semibold focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <span className="text-sm font-semibold text-gray-600">
                  만원
                </span>
                {draft.paymentAmount > 0 && (
                  <span className="ml-auto text-xs text-gray-500">
                    = {fmtMoney(draft.paymentAmount * 10000)}원
                  </span>
                )}
              </div>
            }
          />
          <FieldRow
            label="비고"
            hint="기관·접수내용 (T열)"
            field={
              <textarea
                rows={3}
                value={draft.agencyNote}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 신협 → 부동산 (○○대표), 입금 확인됨"
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            }
          />

          <div className="rounded-2xl bg-green-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-green-800">
                💰 오늘 수납
              </span>
              <span className="text-lg font-bold text-green-700">
                {fmtMoney(draft.paymentAmount)}만원
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              승인 {draft.approvalCount}건 · 수납 {draft.paymentCount}건
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-[64px] left-0 right-0 z-[49] bg-gradient-to-t from-white via-white to-transparent px-4 pb-3 pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          {save.isPending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              시트 저장중...
            </>
          ) : (
            <>💾 저장하기</>
          )}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-[152px] left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

function FieldRow({
  label,
  hint,
  field,
}: {
  label: string;
  hint: string;
  field: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="mb-2">
        <div className="text-sm font-bold text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{hint}</div>
      </div>
      {field}
    </div>
  );
}
