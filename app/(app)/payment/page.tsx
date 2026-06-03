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

import PageContainer from "@/components/PageContainer";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractPayment } from "@/types";
import {
  usePatchContractPayment,
  useRemoveContractPayment,
  useContractPayments,
} from "@/query/contract-payment-hooks";
import ContractRow from "./_components/ContractRow";
import TopHeader from "@/components/TopHeader";
import DriveLinkBar from "./_components/DriveLinkBar";

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 데스크탑(pc:1024) 여부 — 마스터-디테일 분기용. SSR/하이드레이션은 모바일 기준으로 시작. */
function usePcBreakpoint(): boolean {
  const [isPc, setIsPc] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsPc(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isPc;
}

interface ConfirmTarget {
  row: number;
  label: string;
}

interface PostDeleteNavTarget {
  미팅날짜: string;
  업체명: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const list = useContractPayments();
  const patch = usePatchContractPayment();
  const remove = useRemoveContractPayment();

  const [pendingRow, setPendingRow] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  /** 2026-05-17 [3]: 삭제 확인 모달의 cascade 옵션 (계약→예약 revert). */
  const [cascadeOpt, setCascadeOpt] = useState(true);
  /** 2026-05-17 [3]: 삭제 후 바로가기 팝업 (cascade 발생 시). */
  const [postDeleteNav, setPostDeleteNav] = useState<PostDeleteNavTarget | null>(
    null,
  );
  // C 마스터-디테일 (데스크탑만). 선택 row — 기본은 첫 카드(아래 selectedCp fallback).
  const isPc = usePcBreakpoint();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

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
      showToast(`저장하지 못했어요: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const makeDeleteRequest = (cp: ContractPayment) => {
    if (cp.row) {
      setConfirmTarget({
        row: cp.row,
        label: cp.업체명 || `시트 row ${cp.row}`,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    const cascade = cascadeOpt;
    setConfirmTarget(null);
    setPendingRow(target.row);
    try {
      const res = await remove.mutateAsync({ row: target.row, cascade });
      if (cascade && res.미팅날짜 && res.meetingId) {
        // cascade 성공 + 매칭 미팅 발견 → 바로가기 팝업 노출
        setPostDeleteNav({
          미팅날짜: res.미팅날짜,
          업체명: target.label,
        });
        showToast(`삭제 + ${res.cascade ?? "cascade"} ✓`);
      } else {
        showToast(
          cascade
            ? `삭제 ✓ — ${res.cascade ?? "cascade 결과 없음"}`
            : "삭제되었습니다 🗑",
        );
      }
    } catch (e) {
      showToast(`삭제하지 못했어요: ${(e as Error).message}`);
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

  // [3] 진행기관 콤보박스 후보 — 그동안 입력한 모든 슬롯 진행기관 distinct (시트 드롭다운처럼).
  const institutionOptions = Array.from(
    new Set(
      rows
        .flatMap((cp) => [cp.수납1.진행기관, cp.수납2.진행기관, cp.수납3.진행기관])
        .map((s) => (s ?? "").trim())
        .filter(Boolean),
    ),
  ).sort();

  // C: 선택 계약 — selectedRow 없거나 목록에 없으면 첫 카드로 폴백(기본 선택=첫 카드).
  const selectedCp = rows.find((r) => r.row === selectedRow) ?? rows[0];

  return (
    <>
      <TopHeader
        pageEmoji="💰"
        pageTitle="실무/수납"
      />

      <main className="px-4 pb-[80px] pt-3">
      <PageContainer width="wide">
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

        {/* Drive + 플러그 바로가기 */}
        <DriveLinkBar />

        {/* 안내 */}
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          일정·계약 탭에서 미팅을 <b>계약</b>으로 처리하면 여기에 자동으로 추가돼요.
        </div>

        {/* 리스트 */}
        {list.isLoading ? (
          <div className="text-sm text-slate-500">불러오고 있어요</div>
        ) : list.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            아직 계약이 없어요. 일정·계약 탭에서 미팅을 ‘계약’으로 처리하면 자동으로 추가돼요.
          </div>
        ) : isPc ? (
          /* 데스크탑(pc): 마스터-디테일 — 좌 컴팩트 목록 / 우 sticky 상세 */
          <div className="grid grid-cols-3 items-start gap-4">
            <div className="col-span-1 space-y-2">
              {rows.map((cp, i) => (
                <ContractRow
                  key={cp.row}
                  cp={cp}
                  ordinal={i + 1}
                  pending={pendingRow === cp.row}
                  institutionOptions={institutionOptions}
                  selectable
                  selected={selectedCp?.row === cp.row}
                  onSelect={() => setSelectedRow(cp.row ?? null)}
                  onSave={handleSave}
                  onDeleteRequest={() => makeDeleteRequest(cp)}
                />
              ))}
            </div>
            <div className="sticky top-24 col-span-2">
              {selectedCp && (
                <ContractRow
                  key={`detail-${selectedCp.row}`}
                  cp={selectedCp}
                  ordinal={
                    rows.findIndex((r) => r.row === selectedCp.row) + 1
                  }
                  pending={pendingRow === selectedCp.row}
                  institutionOptions={institutionOptions}
                  forceOpen
                  onSave={handleSave}
                  onDeleteRequest={() => makeDeleteRequest(selectedCp)}
                />
              )}
            </div>
          </div>
        ) : (
          /* 모바일(<pc): 기존 아코디언 (회귀 금지) */
          <div>
            {rows.map((cp, i) => (
              <ContractRow
                key={cp.row}
                cp={cp}
                ordinal={i + 1}
                pending={pendingRow === cp.row}
                institutionOptions={institutionOptions}
                onSave={handleSave}
                onDeleteRequest={() => makeDeleteRequest(cp)}
              />
            ))}
          </div>
        )}
      </PageContainer>
      </main>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-[200] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 삭제 확인 모달 — 2026-05-17 [3]: cascade 옵션 추가 */}
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
              이 계약수납을 지울까요?
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              <b>{confirmTarget.label}</b> 계약수납 기록을 지워요.
              <br />
              입력한 내용이 모두 사라져요.
            </p>
            <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
              <input
                type="checkbox"
                checked={cascadeOpt}
                onChange={(e) => setCascadeOpt(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                <b>이 계약의 미팅도 ‘예약’ 상태로 되돌리기</b>
                <br />
                <span className="text-gray-500">
                  일정·계약 탭의 해당 미팅이 계약 전(예약)으로 돌아가고,
                  <br />
                  수임비·계약조건이 비워져요.
                </span>
              </span>
            </label>
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

      {/* 삭제 후 바로가기 팝업 — 2026-05-17 [3] */}
      {postDeleteNav && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPostDeleteNav(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-gray-900">
              지웠어요 · 미팅도 되돌렸어요
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              <b>{postDeleteNav.업체명}</b> 미팅이
              <br />
              예약 상태로 돌아갔어요 ({postDeleteNav.미팅날짜}).
              <br />
              그 미팅 카드로 이동할까요?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPostDeleteNav(null)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                현재 화면 유지
              </button>
              <button
                type="button"
                onClick={() => {
                  setPostDeleteNav(null);
                  router.push("/schedule");
                }}
                className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
              >
                📅 일정·계약으로 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
