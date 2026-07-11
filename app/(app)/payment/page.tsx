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
import { useGuardedNav } from "@/components/DirtyGuard";
import { useRouter } from "next/navigation";
import { isCarryoverContract, isTerminatedContract, TERMINATED_IN_CONTRACT_COUNT, type ContractPayment } from "@/types";
import {
  usePatchContractPayment,
  useRemoveContractPayment,
  useTerminateContract,
  useContractPayments,
} from "@/query/contract-payment-hooks";
import { useMe } from "@/query/me-hook";
import ContractRow from "./_components/ContractRow";
import TerminationModal from "./_components/TerminationModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import PriorContractSection from "./_components/PriorContractSection";
import CompanySearchBar from "./_components/CompanySearchBar";
import PaymentSortControl from "./_components/PaymentSortControl";
import { sortContracts, type PaymentSortKey } from "./_lib/payment-progress";
import TopHeader from "@/components/TopHeader";
import DriveLinkBar from "./_components/DriveLinkBar";
import { ACCENT, contractAccentFamily } from "./_lib/contractAccent";

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
  const terminate = useTerminateContract();
  // 시작일(courseStart=O1 SSOT) — 매출 아레나/이월 분리·이월 뱃지 판정용(동적).
  const me = useMe();
  const courseStartISO = me.data?.courseStartISO ?? "";

  const [pendingRow, setPendingRow] = useState<number | null>(null);
  // 업체 검색 — 표시 필터 전용(부분일치, 대소문자·공백 무시). 데이터 로직 무변경.
  const [companyQuery, setCompanyQuery] = useState("");
  const [sortKey, setSortKey] = useState<PaymentSortKey>("date-asc");
  const [toast, setToast] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  /** 계약해지 모달 대상 (contract-termination). */
  const [terminateTarget, setTerminateTarget] = useState<ContractPayment | null>(null);
  /** 2026-05-17 [3]: 삭제 확인 모달의 cascade 옵션 (계약→예약 revert). */
  const [cascadeOpt, setCascadeOpt] = useState(true);
  /** 2026-05-17 [3]: 삭제 후 바로가기 팝업 (cascade 발생 시). */
  const [postDeleteNav, setPostDeleteNav] = useState<PostDeleteNavTarget | null>(
    null,
  );
  // C 마스터-디테일 (데스크탑만). 선택 row — 기본은 첫 카드(아래 selectedCp fallback).
  const isPc = usePcBreakpoint();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  // 마스터-디테일 선택 행 전환도 미저장 가드 — 펼친 카드 dirty 면 모달.
  const guardedNav = useGuardedNav();

  // 캘린더 → /payment?focus=<todoId> 이동 시 그 ToDo 행 자동 펼침+하이라이트.
  // Next 15 useSearchParams Suspense 회피 → mount 시 window.location 직접 파싱.
  const [focusTodoId, setFocusTodoId] = useState<string | null>(null);
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("focus");
    if (f) setFocusTodoId(f);
  }, []);

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

  const handleTerminate = async (input: { 사유: string; 반환액: number; 숨김: boolean }) => {
    if (!terminateTarget?.row) return;
    const row = terminateTarget.row;
    setPendingRow(row);
    try {
      await terminate.mutateAsync({ row, ...input });
      setTerminateTarget(null);
      showToast(input.숨김 ? "계약을 해지하고 목록에서 숨겼어요" : "계약을 해지 처리했어요");
    } catch (e) {
      showToast(`해지하지 못했어요: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const allRows = list.data?.rows ?? [];
  // 해지+숨김(soft delete) 카드는 목록·합계 표시에서 제외하되, 반환액 차감은 유지(스펙).
  const rows = allRows.filter((cp) => !cp.해지숨김);
  // 단위는 모두 원. 단어 약속:
  //   수임비합     = sum(cp.수임비)            — 04 업체관리!L에서 동기화된 계약 금액
  //   수납액합     = sum(슬롯별 수납액 = Q+W+AC) — "수수료" (= 실제 입금된 부가 수수료) 합
  //   승인금액합   = sum(슬롯별 승인금액)        — 진행 중인 수납 약정 총액 (목표)
  //   총매출       = 수임비합 + 수납액합        — v2 SSOT (수수료=수납액합)
  //   수납진척     = 수납액합 / 승인금액합
  // 이월(시작일 이전 또는 깃발) 계약은 아레나 비집계 — 합계(매출·수수료·승인)에서 제외.
  // 경계는 isCarryoverContract(동적, 하드코딩X). 카드 목록은 회색 표시(carryover-profit §1).
  const billable = rows.filter((cp) => !isCarryoverContract(cp, courseStartISO));
  const totalReceived = billable.reduce(
    (s, cp) => s + cp.수납1.수납액 + cp.수납2.수납액 + cp.수납3.수납액,
    0,
  );
  const totalApproved = billable.reduce(
    (s, cp) =>
      s + cp.수납1.승인금액 + cp.수납2.승인금액 + cp.수납3.승인금액,
    0,
  );
  const totalContract = billable.reduce((s, cp) => s + (cp.수임비 || 0), 0);
  // 반환액(계약해지)은 숨김(soft delete) 계약 포함 전체에서 차감 — 대시보드 computeContractRevenue 와 동일 정의.
  const totalRefunded = allRows
    .filter((cp) => !isCarryoverContract(cp, courseStartISO))
    .reduce((s, cp) => s + (cp.반환액 || 0), 0);
  const totalRevenue = totalContract + totalReceived - totalRefunded;
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

  // 업체 검색 필터 — 합계·진행기관 후보는 전체(rows) 기준 유지(표시만 필터).
  const normq = (x: string) => x.toLowerCase().replace(/\s+/g, "");
  const filteredRows = companyQuery.trim()
    ? rows.filter((cp) => normq(cp.업체명 ?? "").includes(normq(companyQuery)))
    : rows;
  // 정렬(필터 결과에 적용) — 렌더·선택폴백·ordinal 모두 sortedRows 기준 일관(§P8).
  const visibleRows = sortContracts(filteredRows, sortKey);

  // C: 선택 계약 — selectedRow 없거나 (검색)목록에 없으면 첫 카드로 폴백.
  const selectedCp =
    visibleRows.find((r) => r.row === selectedRow) ?? visibleRows[0];
  // 선택 카드↔패널을 하나의 윤곽선으로 잇는 상태색(진행상태 기반).
  const selFamily = selectedCp ? contractAccentFamily(selectedCp) : "slate";
  const selAccent = ACCENT[selFamily];

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
                {TERMINATED_IN_CONTRACT_COUNT
                  ? rows.length
                  : rows.filter((cp) => !isTerminatedContract(cp)).length}
                <span className="text-sm font-medium text-gray-500">건</span>
              </div>
              {allRows.filter(isTerminatedContract).length > 0 && (
                <div className="mt-0.5 text-[11px] text-red-500">
                  해지 {allRows.filter(isTerminatedContract).length}건
                </div>
              )}
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
                {totalRefunded > 0 ? "수임비 + 수수료 − 반환" : "수임비 + 수수료"}
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

        {/* 이전 계약업체 등록 + 아레나/이월 매출 분리 (arena-start-revenue-split) */}
        <PriorContractSection contracts={rows} courseStartISO={courseStartISO} />

        {/* 안내 */}
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          일정·계약 탭에서 미팅을 <b>계약</b>으로 처리하면 여기에 자동으로 추가돼요.
        </div>

        {/* 업체 검색 — 첫 업체 카드 위 sticky (CompanySearchBar) + 정렬 컨트롤 */}
        {!list.isLoading && !list.isError && rows.length > 0 && (
          <div className="mb-3 space-y-2">
            <CompanySearchBar
              value={companyQuery}
              onChange={setCompanyQuery}
              matchCount={visibleRows.length}
              total={rows.length}
            />
            <PaymentSortControl value={sortKey} onChange={setSortKey} />
          </div>
        )}

        {/* 리스트 */}
        {list.isLoading ? null : list.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            아직 계약이 없어요. 일정·계약 탭에서 미팅을 ‘계약’으로 처리하면 자동으로 추가돼요.
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            검색 결과가 없어요. <b>✕</b> 를 눌러 전체 목록으로 돌아갈 수 있어요.
          </div>
        ) : isPc ? (
          /* 데스크탑(pc): 마스터-디테일 — 선택 카드와 우측 패널이 같은 상태색
             하나의 윤곽선(탭처럼)으로 이어짐. grid 3.5:6.5 (gap 0 → seam 연결).
             (요약카드 139줄과 동일한 인라인 gridTemplateColumns 패턴.) */
          <div
            className="grid items-start"
            style={{ gridTemplateColumns: "3.5fr 6.5fr" }}
          >
            <div className="min-w-0 space-y-2">
              {visibleRows.map((cp, i) => {
                const isSel = selectedCp?.row === cp.row;
                return (
                  <div
                    key={cp.row}
                    className={
                      isSel
                        ? // 선택: 상태색 2px, 우측 테두리 제거 + 좌측만 라운드,
                          // -mr-0.5 로 패널 왼쪽 테두리에 맞물림, z 위로.
                          `relative z-10 -mr-0.5 overflow-hidden rounded-l-xl border-2 border-r-0 bg-white shadow-md transition-all duration-200 ${selAccent.border}`
                        : // 비선택: 회색 + 패널과 간격(mr-1)으로 대비.
                          "mr-1 overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200"
                    }
                  >
                    <ContractRow
                      cp={cp}
                      ordinal={i + 1}
                      pending={pendingRow === cp.row}
                      institutionOptions={institutionOptions}
                      bare
                      selectable
                      selected={isSel}
                      accentFamily={isSel ? selFamily : undefined}
                      onSelect={() => guardedNav(() => setSelectedRow(cp.row ?? null))}
                      onSave={handleSave}
                      onDeleteRequest={() => makeDeleteRequest(cp)}
                      onTerminateRequest={() => setTerminateTarget(cp)}
                      focusTodoId={focusTodoId}
                      highlight={companyQuery}
                      courseStartISO={courseStartISO}
                    />
                  </div>
                );
              })}
            </div>
            {selectedCp && (
              <div
                className={`sticky top-24 min-w-0 overflow-hidden rounded-r-xl border-2 bg-white shadow-md transition-all duration-200 ${selAccent.border}`}
              >
                <ContractRow
                  key={`detail-${selectedCp.row}`}
                  cp={selectedCp}
                  ordinal={visibleRows.findIndex((r) => r.row === selectedCp.row) + 1}
                  pending={pendingRow === selectedCp.row}
                  institutionOptions={institutionOptions}
                  bare
                  forceOpen
                  accentFamily={selFamily}
                  onSave={handleSave}
                  onDeleteRequest={() => makeDeleteRequest(selectedCp)}
                  onTerminateRequest={() => setTerminateTarget(selectedCp)}
                  focusTodoId={focusTodoId}
                  highlight={companyQuery}
                  courseStartISO={courseStartISO}
                />
              </div>
            )}
          </div>
        ) : (
          /* 모바일(<pc): 기존 아코디언 (회귀 금지) */
          <div>
            {visibleRows.map((cp, i) => (
              <ContractRow
                key={cp.row}
                cp={cp}
                ordinal={i + 1}
                pending={pendingRow === cp.row}
                institutionOptions={institutionOptions}
                onSave={handleSave}
                onDeleteRequest={() => makeDeleteRequest(cp)}
                onTerminateRequest={() => setTerminateTarget(cp)}
                focusTodoId={focusTodoId}
                highlight={companyQuery}
                courseStartISO={courseStartISO}
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

      {terminateTarget && (  /* 계약해지 모달 (contract-termination) */
        <TerminationModal
          cp={terminateTarget}
          pending={pendingRow === terminateTarget.row}
          onClose={() => setTerminateTarget(null)}
          onConfirm={handleTerminate}
        />
      )}

      {/* 삭제 확인 모달 — DeleteConfirmModal 로 분리(500줄 캡). 동작 무변경 */}
      {confirmTarget && (
        <DeleteConfirmModal
          label={confirmTarget.label}
          cascadeOpt={cascadeOpt}
          onCascadeChange={setCascadeOpt}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={handleConfirmDelete}
        />
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
