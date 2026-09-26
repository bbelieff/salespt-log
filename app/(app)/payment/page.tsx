/**
 * 계약수납 탭 (PR 11 contract-payment-tab UI).
 * 정본: docs/plans/active/11-contract-payment-tab.md
 *
 * 시트: 02 계약수납관리 (A~AA)
 *   - C/D/E 자동 연동 (계약일/업체명/수임비) — 일정·계약 탭 계약 액션 시 자동 생성
 *   - F~K 6개 서류/진행 체크. L 플러그이관은 과거 호환용으로만 보존
 *   - M~Q / R~V / W~AA: 3 분할 수납
 *
 * URL: /payment 유지 (Architecture C — Plan 결정)
 */
"use client";

import PageContainer from "@/components/PageContainer";

import { useEffect, useRef, useState } from "react";
import { useGuardedNav } from "@/components/DirtyGuard";
import { useRouter } from "next/navigation";
import { isCarryoverContract, isTerminatedContract, type ContractPayment } from "@/types";
import {
  usePatchContractPayment,
  useRemoveContractPayment,
  useTerminateContract,
  useContractPayments,
} from "@/query/contract-payment-hooks";
import { useMe } from "@/query/me-hook";
import ContractRow from "./_components/ContractRow";
import ContractListTable from "./_components/ContractListTable";
import PaymentPerformanceSummary from "./_components/PaymentPerformanceSummary";
import TerminationModal from "./_components/TerminationModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import TerminationArchive from "./_components/TerminationArchive";
import PriorContractSection from "./_components/PriorContractSection";
import CompanySearchBar from "./_components/CompanySearchBar";
import PaymentSortControl from "./_components/PaymentSortControl";
import { sortContracts, type PaymentSortKey } from "./_lib/payment-progress";
import TopHeader from "@/components/TopHeader";
import DriveLinkBar from "./_components/DriveLinkBar";
import { contractAccentFamily } from "./_lib/contractAccent";
import { useAllTodos } from "@/query/todos-hooks";

/** 데스크탑(pc:1024) 여부 — 마스터-디테일 분기용. SSR/하이드레이션은 모바일 기준으로 시작. */
function usePcBreakpoint(): boolean {
  const [isPc, setIsPc] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
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
  const isPc = usePcBreakpoint();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const guardedNav = useGuardedNav();
  const allTodos = useAllTodos();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [masterWidth, setMasterWidth] = useState(360);
  const beginResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const root = workspaceRef.current;
    if (!root) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = masterWidth;
    const move = (e: PointerEvent) => {
      const max = Math.max(360, root.clientWidth * 0.48);
      setMasterWidth(Math.min(max, Math.max(300, startWidth + e.clientX - startX)));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

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

  const handleSave = async (next: ContractPayment, opts?: { quiet?: boolean }) => {
    if (!next.row) return;
    setPendingRow(next.row);
    try {
      await patch.mutateAsync({ row: next.row, data: next });
      if (!opts?.quiet) showToast("✓ 저장 완료");
    } catch (e) {
      if (!opts?.quiet) showToast(`저장하지 못했어요: ${(e as Error).message}`);
      throw e; // 재전파: 미저장 가드·자동 저장 큐가 붙잡도록
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
  // 해지+숨김(soft delete)은 목록·합계에서 제외(반환액 차감은 유지) — 열람은 해지 보관함.
  const rows = allRows.filter((cp) => !cp.해지숨김);
  const archivedRows = allRows.filter((cp) => cp.해지숨김);
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
  // 선택 상세의 내부 강조색(진행상태 기반) — ContractRow에 전달.
  const selFamily = selectedCp ? contractAccentFamily(selectedCp) : "slate";

  return (
    <>
      <TopHeader
        pageEmoji="💰"
        pageTitle="실무/수납"
      />

      {/* 구 min-[1440px]:max-w-none 특례는 fluid 로 대체(동일 효과, 전 구간 균일 거터). */}
      <main className="px-4 pb-[80px] pt-3 pc:px-0 pc:pb-6">
      <PageContainer width="fluid">
        <PaymentPerformanceSummary
          rows={rows.filter((cp) => !isCarryoverContract(cp, courseStartISO) && !isTerminatedContract(cp))}
          todos={allTodos.data?.todos ?? []}
          onNavigate={(row, slot) => {
            guardedNav(() => setSelectedRow(row));
            window.setTimeout(() => document.getElementById(`payment-slot-${row}-${slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
          }}
        />

        {/* Drive 바로가기 */}
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
              onChange={(v) => guardedNav(() => setCompanyQuery(v))}
              matchCount={visibleRows.length}
              total={rows.length}
            />
            <PaymentSortControl value={sortKey} onChange={(k) => guardedNav(() => setSortKey(k))} />
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
          /* 데스크탑(pc): 리사이즈 가능한 목록/상세 2열. 각 열은 독립 스크롤하며
             목록 선택은 DirtyGuard를 통과한다. 모바일은 기존 아코디언 유지. */
          <div ref={workspaceRef} className="grid min-w-0 items-start" style={{ gridTemplateColumns: `${masterWidth}px 8px minmax(0, 1fr)` }}>
            <div className="min-w-0 max-h-[calc(100vh-230px)] overflow-y-auto rounded-l-2xl border border-blue-200 bg-slate-50/80 shadow-sm">
              <ContractListTable
                rows={visibleRows}
                selectedRow={selectedCp?.row ?? null}
                onSelect={(row) => guardedNav(() => setSelectedRow(row))}
                highlight={companyQuery}
                courseStartISO={courseStartISO}
              />
            </div>
            <button type="button" onPointerDown={beginResize} className="group relative h-full min-h-[420px] cursor-col-resize bg-transparent" aria-label="목록과 상세 너비 조절" title="좌우로 드래그해 너비 조절">
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-blue-200 transition-colors group-hover:bg-blue-500" />
            </button>
            {selectedCp && (
              <div className="relative min-w-0 max-h-[calc(100vh-230px)] overflow-y-auto rounded-r-2xl border border-blue-200 bg-white shadow-sm">
                <div className="sticky top-0 z-20 flex items-center justify-between border-b border-blue-100 bg-gradient-to-r from-blue-100/95 via-indigo-50/95 to-white/95 px-4 py-2.5 backdrop-blur-xl">
                  <h2 className="truncate text-base font-black text-blue-950">{selectedCp.업체명}</h2>
                  <button type="button" onClick={() => setMasterWidth(360)} className="h-7 rounded-md border border-slate-200 bg-white/80 px-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800">기본 너비</button>
                </div>
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
        {/* 해지 보관함 — 숨김 해지 계약 열람(읽기전용) */}
        <TerminationArchive contracts={archivedRows} />
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
