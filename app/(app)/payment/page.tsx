/**
 * 계약수납 탭 (PR 11 contract-payment-tab UI).
 * 정본: docs/plans/active/11-contract-payment-tab.md
 *
 * 시트: 02 계약수납관리 (A~AA)
 *   - C/D/E 자동 연동 (계약일/업체명/수임비) — 일정·계약 탭 계약 액션 시 자동 생성
 *   - F~L 7 체크박스 (서류 6 + 플러그이관 1)
 *   - M~Q / R~V / W~AA: 3 분할 수납
 *
 * URL: /payment 유지 (Architecture C — Plan 결정)
 */
"use client";

import { useState } from "react";
import type { ContractPayment } from "@/types";
import {
  usePatchContractPayment,
  useRemoveContractPayment,
  useContractPayments,
} from "@/query/contract-payment-hooks";
import ContractRow from "./_components/ContractRow";
import TopHeader from "@/components/TopHeader";

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface ConfirmTarget {
  row: number;
  label: string;
}

export default function PaymentPage() {
  const list = useContractPayments();
  const patch = usePatchContractPayment();
  const remove = useRemoveContractPayment();

  const [pendingRow, setPendingRow] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleSave = async (next: ContractPayment) => {
    if (!next.row) return;
    setPendingRow(next.row);
    try {
      await patch.mutateAsync({ row: next.row, data: next });
      showToast("✓ 저장 완료");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setPendingRow(target.row);
    try {
      await remove.mutateAsync(target.row);
      showToast("삭제되었습니다 🗑");
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const rows = list.data?.rows ?? [];
  // 단위는 모두 원. 단어 약속:
  //   수임비합     = sum(cp.수임비)            — 04 업체관리!L에서 동기화된 계약 금액
  //   수납액합     = sum(슬롯별 수납액 = Q+W+AC) — "수수료" (= 실제 입금된 부가 수수료) 합
  //   승인금액합   = sum(슬롯별 승인금액)        — 진행 중인 수납 약정 총액 (목표)
  //   총매출       = 수임비합 + 수납액합        — v2 SSOT (수수료=수납액합)
  //   수납진척     = 수납액합 / 승인금액합
  const totalReceived = rows.reduce(
    (s, cp) => s + cp.수납1.수납액 + cp.수납2.수납액 + cp.수납3.수납액,
    0,
  );
  const totalApproved = rows.reduce(
    (s, cp) =>
      s + cp.수납1.승인금액 + cp.수납2.승인금액 + cp.수납3.승인금액,
    0,
  );
  const totalContract = rows.reduce((s, cp) => s + (cp.수임비 || 0), 0);
  const totalRevenue = totalContract + totalReceived;
  const overallPct =
    totalApproved > 0 ? Math.round((totalReceived / totalApproved) * 100) : 0;

  return (
    <>
      <TopHeader
        pageEmoji="💰"
        pageTitle="계약수납"
        pageSubtitle="02 계약수납관리"
      />

      <main className="px-4 pb-[80px] pt-3">
        {/* 전체 요약 카드 (25:45:30 비율 — prototype v9) */}
        <div className="mb-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div
            className="grid gap-3 text-center"
            style={{ gridTemplateColumns: "2.5fr 4.5fr 3fr" }}
          >
            <div>
              <div className="mb-1 text-xs text-gray-500">계약</div>
              <div
                className="text-xl font-bold text-gray-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {rows.length}
                <span className="text-sm font-medium text-gray-500">건</span>
              </div>
            </div>
            <div className="border-x border-gray-100">
              <div className="mb-1 text-xs text-gray-500">총매출</div>
              <div
                className="text-xl font-bold text-gray-900"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ₩{fmtMoney(totalRevenue)}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                수임비 + 수수료
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-gray-500">수납 진척</div>
              <div
                className={`text-xl font-bold ${
                  overallPct >= 100
                    ? "text-green-600"
                    : overallPct === 0
                      ? "text-gray-400"
                      : "text-blue-600"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {overallPct}%
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
            <span className="text-gray-500">누적 수납 / 승인</span>
            <span
              className="font-medium text-gray-700"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              ₩{fmtMoney(totalReceived)}
              <span className="mx-1 text-gray-400">/</span>
              ₩{fmtMoney(totalApproved)}
            </span>
          </div>
        </div>

        {/* 안내 */}
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          💡 일정·계약 탭에서 미팅을 <b>💵 계약</b>으로 처리하면 여기 자동 추가됩니다.
        </div>

        {/* 리스트 */}
        {list.isLoading ? (
          <div className="text-sm text-slate-500">불러오는 중…</div>
        ) : list.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            ⚠ 불러오기 실패: {(list.error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            아직 계약이 없습니다 — 일정·계약 탭에서 💵 계약 액션 시 자동 추가
          </div>
        ) : (
          <div>
            {rows.map((cp, i) => (
              <ContractRow
                key={cp.row}
                cp={cp}
                ordinal={i + 1}
                pending={pendingRow === cp.row}
                onSave={handleSave}
                onDeleteRequest={() => {
                  if (cp.row) {
                    setConfirmTarget({
                      row: cp.row,
                      label: cp.업체명 || `시트 row ${cp.row}`,
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-[200] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-gray-900">
              계약수납 삭제
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              {`'${confirmTarget.label}' 계약수납 row를 비울까요? (시트 row ${confirmTarget.row} 전체 clear)`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
