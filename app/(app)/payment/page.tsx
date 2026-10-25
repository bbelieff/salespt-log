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
import usePcBreakpoint from "./_components/usePcBreakpoint";

import { useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useGuardedNav } from "@/components/DirtyGuard";
import { useRouter } from "next/navigation";
import { type ContractPayment } from "@/types";
import { paymentFocusedSlot } from "@/util/payment-focus";
import { activeWorkContracts } from "@/lib/analytics/payment-work-status";
import { companyStage, isLongTermContract, stagePatch, type CompanyStage } from "@/lib/analytics/long-term";
import LongTermToggle from "./_components/LongTermToggle";
import PostDeleteNavModal, { type PostDeleteNavTarget } from "./_components/PostDeleteNavModal";
import {
  usePatchContractPayment,
  useRemoveContractPayment,
  useTerminateContract,
  useContractPayments,
} from "@/query/contract-payment-hooks";
import { useMe } from "@/query/me-hook";
import ContractRow from "./_components/ContractRow";
import ContractListTable from "./_components/ContractListTable";
import InstitutionWorkList from "./_components/InstitutionWorkList";
import PaymentSelectionBridge, { syncPaymentSelectionBridge, watchDevicePixelRatio } from "./_components/PaymentSelectionBridge";
import PaymentPerformanceSummary from "./_components/PaymentPerformanceSummary";
import TerminationModal from "./_components/TerminationModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import TerminationArchive from "./_components/TerminationArchive";
import PriorContractSection from "./_components/PriorContractSection";
import StandaloneCompanyAdd from "./_components/StandaloneCompanyAdd";
import CompanySearchBar from "./_components/CompanySearchBar";
import PaymentSortControl from "./_components/PaymentSortControl";
import PaymentListModeTabs from "./_components/PaymentListModeTabs";
import useMasterPaneWidth, { MASTER_PANE_MIN_WIDTH } from "./_components/useMasterPaneWidth";
import usePaymentFocus, { paymentCompanyDetailLabel, usePaymentFocusSelection } from "./_components/usePaymentFocus";
import { buildCompanyWorkItems, companyKeyOfRow, sortCompanyWorkItems, type CompanyWorkItem, type PaymentSortKey } from "./_lib/company-work-view";
import TopHeader from "@/components/TopHeader";
import DriveLinkBar from "./_components/DriveLinkBar";
import MobileTools from "./_components/MobileTools";
import "./payment-company-compact.css";
import { contractAccentFamily } from "./_lib/contractAccent";
import { buildInstitutionWorkItems, groupInstitutionWorkItems, type InstitutionWorkItem } from "./_lib/institution-view";
import { activityTodayISO } from "./_lib/payment-progress";
import { INITIAL_PAYMENT_SELECTION, paymentSelectionReducer, scrollToPaymentSlot } from "./_lib/payment-selection";
import { useAllTodos } from "@/query/todos-hooks";
import { useGrantMatches } from "@/query/grant-match-hooks";
import { withoutTaken } from "@/lib/analytics/grant-match";
import { grantIdOfTodo, isGrantTodo } from "@/lib/analytics/todo-slot";
import { normalizeContractRef } from "@/util/contract-ref";

interface ConfirmTarget {
  row: number;
  label: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const isPc = usePcBreakpoint();
  const list = useContractPayments();
  const patch = usePatchContractPayment({ silent: !isPc }); // Mobile routine autosave only; PC and explicit actions retain foreground loading.
  const remove = useRemoveContractPayment();
  const terminate = useTerminateContract();
  // 시작일(courseStart=O1 SSOT) — 매출 아레나/이월 분리·이월 뱃지 판정용(동적).
  const me = useMe();
  const courseStartISO = me.data?.courseStartISO ?? "";

  const [pendingRow, setPendingRow] = useState<number | null>(null);
  const [detailStatusTarget, setDetailStatusTarget] = useState<HTMLSpanElement | null>(null);
  // 업체 검색 — 표시 필터 전용(부분일치, 대소문자·공백 무시). 데이터 로직 무변경.
  // 선택 상태는 순수 전이 하나로(구조 개선 ⑩) — 스크롤·미저장 가드·외부 포커스 해제는 여기서 그대로.
  const [selection, dispatch] = useReducer(paymentSelectionReducer, INITIAL_PAYMENT_SELECTION);
  const { listMode, query: companyQuery, workKey: selectedWorkKey, companyKey: selectedCompanyKey, row: selectedRow, focusId: focusRequestId, detailExpanded: mobileDetailExpanded } = selection;
  const setCompanyQuery = (value: string) => dispatch({ type: "query", value });
  const [sortKey, setSortKey] = useState<PaymentSortKey>("date-asc");
  /** 「장기관리」 칩 — 켜면 장기관리 업체만, 끄면 장기관리 업체를 숨긴다(업체·기관 보기 공통). */
  const [longTermOnly, setLongTermOnly] = useState(false);
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
  const guardedNav = useGuardedNav();
  const allTodos = useAllTodos();
  const grantData = useGrantMatches().data;
  // 담은 공고(할 일로 만든 것)는 칩 숫자에서 뺀다 — 상자는 계약별 할 일로 직접 거른다.
  const grants = useMemo(() => {
    const taken = new Map<string, Set<string>>();
    for (const t of allTodos.data?.todos ?? []) if (isGrantTodo(t)) {
      const ref = normalizeContractRef(t.contractRef);
      taken.set(ref, (taken.get(ref) ?? new Set()).add(grantIdOfTodo(t)));
    }
    return withoutTaken(grantData, taken);
  }, [grantData, allTodos.data?.todos]);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const listPaneRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SVGSVGElement>(null);
  const { masterWidth, setMasterWidth, beginResize } = useMasterPaneWidth(workspaceRef);
  const [detailLeftPct, setDetailLeftPct] = useState(60);

  const { safeFocusTodoId, companyOnlyTodoFocus, focusPayment, clearPaymentFocus } = usePaymentFocus(list.data?.rows, isPc);
  const focusNotice = companyOnlyTodoFocus ? <p role="status" className="px-4 py-2 text-xs text-amber-800">할 일의 연결 진행건을 확인해 주세요. 기관이 일치하는 진행건을 직접 선택할 수 있어요.</p> : null;
  usePaymentFocusSelection(focusPayment, (target) => {
    dispatch({ type: "focusTarget", row: target.row, companyKey: companyKeyOfRow(list.data?.rows, target.row) });
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleSave = async (next: ContractPayment, opts?: { quiet?: boolean }) => {
    if (!next.row) return;
    setPendingRow(next.row);
    // 업체 상태(진행/장기관리)는 배너 토글만 바꾼다 — 상세 카드의 오래된 초안이 되돌리지 않게 최신 저장값을 씌운다.
    const saved = list.data?.rows.find((r) => r.row === next.row);
    const data = saved ? { ...next, 관리상태: saved.관리상태, 관리상태진행건: saved.관리상태진행건 } : next;
    try {
      await patch.mutateAsync({ row: next.row, data });
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

  const handleStage = async (cp: ContractPayment, stage: CompanyStage) => {
    if (!cp.row) return;
    setPendingRow(cp.row);
    try {
      await patch.mutateAsync({ row: cp.row, data: { ...cp, ...stagePatch(cp, stage) } });
      showToast(stage === "장기관리" ? (longTermOnly ? "장기관리로 옮겼어요" : "장기관리로 옮겼어요 · 「장기관리」 칩에서 볼 수 있어요") : (longTermOnly ? "진행으로 옮겼어요 · 칩을 끄면 볼 수 있어요" : "진행으로 옮겼어요"));
    } catch (e) {
      showToast(`옮기지 못했어요: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
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

  // 장기관리 칩 — 업체·기관 보기 모두 같은 범위(scopedRows). 성과 요약·진행기관 후보는 전체(rows) 그대로.
  const longTermCount = rows.filter(isLongTermContract).length;
  const scopedRows = rows.filter((cp) => isLongTermContract(cp) === longTermOnly);
  // 업체 검색 필터 — 합계·진행기관 후보는 전체(rows) 기준 유지(표시만 필터).
  const normq = (x: string) => x.toLowerCase().replace(/\s+/g, "");
  const filteredRows = companyQuery.trim()
    ? scopedRows.filter((cp) => normq(cp.업체명 ?? "").includes(normq(companyQuery)))
    : scopedRows;
  const today = activityTodayISO();
  const institutionItems = buildInstitutionWorkItems(scopedRows, courseStartISO, allTodos.data?.todos ?? [], today);
  const activityState = allTodos.isError ? "error" : allTodos.data ? "ready" : "loading";
  const unsortedCompanyItems = buildCompanyWorkItems(filteredRows, institutionItems, today);
  const companyItems = sortKey === "dday" && activityState !== "ready" ? unsortedCompanyItems
    : sortCompanyWorkItems(unsortedCompanyItems, sortKey, today);
  const institutionGroups = groupInstitutionWorkItems(institutionItems, listMode === "institution" ? companyQuery : "", "activity", today);
  const institutionVisible = institutionGroups.flatMap((group) => group.items);
  const selectedWork = institutionVisible.find((item) => item.key === selectedWorkKey) ?? institutionVisible[0];
  const selectedCompany = companyItems.find((item) => item.key === selectedCompanyKey)
    ?? companyItems.find((item) => item.cp.row === selectedRow) ?? companyItems[0];

  const selectedCp = listMode === "institution"
    ? selectedWork ? rows.find((r) => r.row === selectedWork.row) : undefined
    : selectedCompany?.cp;
  const companyDetailLabel = paymentCompanyDetailLabel(focusPayment, selectedCp, selectedCompany?.hasProgress ? selectedCompany.work.slot : null);
  // 선택 행이 스크롤 밖으로 나가면 연결부도 숨겨 상세 위에 잔상을 남기지 않는다.
  const syncBridge = () => syncPaymentSelectionBridge(workspaceRef.current, listPaneRef.current, bridgeRef.current);
  useLayoutEffect(() => {
    if (!isPc) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        syncBridge();
      });
    };
    sync();
    const workspace = workspaceRef.current;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    if (workspace) observer?.observe(workspace);
    // 기관을 접고 펼칠 때 선택 행의 DOM 위치가 바뀌므로 연결부를 즉시 재배치한다.
    const listObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(sync);
    if (listPaneRef.current) listObserver?.observe(listPaneRef.current, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-expanded", "aria-selected", "data-active-institution"] });
    window.addEventListener("resize", sync); const unwatchDpr = watchDevicePixelRatio(sync); // 모니터 배율 변경은 resize 없이 올 수 있다
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); listObserver?.disconnect(); window.removeEventListener("resize", sync); unwatchDpr(); };
  }, [isPc, list.isLoading, rows.length, listMode, selectedCp?.row, selectedWorkKey, companyQuery, sortKey, masterWidth]);
  // 선택 상세의 내부 강조색(진행상태 기반) — ContractRow에 전달.
  const selFamily = selectedCp ? contractAccentFamily(selectedCp) : "slate";
  const selectWork = (item: InstitutionWorkItem) => guardedNav(() => {
    clearPaymentFocus();
    dispatch({ type: "selectWork", key: item.key, row: item.row });
    // 모바일은 선택 업체 바로 아래에 상세가 열리므로 슬롯으로 강제 점프하지 않는다.
    if (isPc) scrollToPaymentSlot(item.row, item.slot);
  });
  const selectCompany = (item: CompanyWorkItem) => guardedNav(() => {
    clearPaymentFocus();
    dispatch({ type: "selectCompany", key: item.key, row: item.cp.row ?? null });
    if (isPc && item.hasProgress) scrollToPaymentSlot(item.cp.row, item.work.slot);
  });
  const changeListMode = (mode: "company" | "institution") => guardedNav(() => {
    if (mode === listMode) return;
    clearPaymentFocus();
    // 업체 카드 = 계약 1건 → 대표 진행건으로, 진행건 → 그 계약 업체로.
    dispatch({ type: "switchMode", mode, workKey: selectedCompany?.work.key ?? null, companyKey: selectedWork?.contractKey ?? null, row: selectedWork?.row ?? null });
  });
  const listModeTabs = <PaymentListModeTabs value={listMode} onChange={changeListMode} />;
  const emptyListText = longTermOnly && !companyQuery.trim() ? "장기관리 업체가 없어요. 진행건이 모두 수납완료·중도중지가 되면 저절로 옮겨져요."
    : "검색 결과가 없어요. 검색어를 지우면 전체 목록이 나옵니다.";
  const selectedLong = selectedCp ? companyStage(selectedCp) === "장기관리" : false;
  const stageToggle = (cp: ContractPayment) => <LongTermToggle value={companyStage(cp)} pending={pendingRow === cp.row} onChange={(next) => void handleStage(cp, next)} />;
  const mobileStageBar = (cp: ContractPayment) => <div className={`flex items-center justify-between gap-2 border-b px-2.5 py-1.5 ${companyStage(cp) === "장기관리" ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50/60"}`}><span className="text-px-11 font-semibold text-slate-600">이 업체 상태</span>{stageToggle(cp)}</div>;

  const standaloneAdd = <StandaloneCompanyAdd listMode={listMode} className={isPc ? "px-2 pt-2" : "mb-3"} onCreated={(row) => guardedNav(() => { clearPaymentFocus(); dispatch({ type: "created", row }); window.setTimeout(() => { const b = document.querySelector<HTMLElement>(`[data-row="${row}"]`); b?.scrollIntoView({ block: "nearest" }); b?.focus({ preventScroll: true }); }, 80); })} />;
  return (
    <>
      <div data-payment-desktop-shell className="min-[1280px]:flex min-[1280px]:h-[100dvh] min-[1280px]:min-h-0 min-[1280px]:flex-col min-[1280px]:overflow-hidden">
        <TopHeader
          pageEmoji="💰"
          pageTitle="실무/수납"
        />
        {/* PC는 페이지 셸의 남은 높이를 작업판에만 준다. 모바일은 기존 문서 스크롤을 유지한다. */}
        <div data-payment-mobile-compact className="px-4 pb-[80px] pt-3 pc:px-0 pc:pb-6 min-[1280px]:flex min-[1280px]:min-h-0 min-[1280px]:flex-1 min-[1280px]:flex-col min-[1280px]:overflow-hidden">
        <PageContainer width="fluid" className="min-[1280px]:flex min-[1280px]:h-full min-[1280px]:min-h-0 min-[1280px]:flex-col min-[1280px]:overflow-hidden">
        <PaymentPerformanceSummary
          rows={allRows}
          workRows={activeWorkContracts(allRows)}
          todos={allTodos.data?.todos ?? []}
          dataState={list.isError ? "error" : list.data ? "ready" : "loading"}
          workState={activityState}
          onRetry={() => { void list.refetch(); void allTodos.refetch(); }}
          onNavigate={(row, slot) => {
            guardedNav(() => { clearPaymentFocus(); dispatch({ type: "navigate", row, companyKey: companyKeyOfRow(allRows, row) }); });
            scrollToPaymentSlot(row, slot);
          }}
        />

        {isPc ? <DriveLinkBar /> : <MobileTools value={companyQuery} onChange={(v) => guardedNav(() => setCompanyQuery(v))} onNews={() => guardedNav(() => router.push("/payment/news"))}
          matchCount={listMode === "company" ? companyItems.length : institutionVisible.length} total={institutionItems.length}
          placeholder={listMode === "company" ? "업체명 검색" : "기관·상품·업체 검색"} unit={listMode === "company" ? "개 항목" : "건 진행"} matchUnit={listMode === "company" ? "개 항목" : "건"} />}
        {isPc && <PriorContractSection />}
        {/* 업체 검색·정렬: PC에서는 한 줄, 모바일에서는 기존 순서. */}
        {!list.isLoading && !list.isError && rows.length > 0 && (
          <div className="mb-3 space-y-2 min-[1280px]:mb-2 min-[1280px]:flex min-[1280px]:items-center min-[1280px]:gap-3 min-[1280px]:space-y-0">
            {isPc && <CompanySearchBar
              value={companyQuery}
              onChange={(v) => guardedNav(() => setCompanyQuery(v))}
              matchCount={listMode === "company" ? companyItems.length : institutionVisible.length}
              total={institutionItems.length}
              placeholder={listMode === "company" ? "업체명 검색" : "기관·상품·업체 검색"}
              unit={listMode === "company" ? "개 항목" : "건 진행"}
              matchUnit={listMode === "company" ? "개 항목" : "건"}
            />}
            <PaymentSortControl value={sortKey} onChange={(k) => guardedNav(() => setSortKey(k))} showSort={listMode === "company"}
              longTermCount={longTermCount} longTermOnly={longTermOnly} onLongTermToggle={() => guardedNav(() => { clearPaymentFocus(); setLongTermOnly((v) => !v); })} />
          </div>
        )}

        {/* 리스트 */}
        {list.isLoading ? null : list.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : rows.length === 0 ? (<div className="space-y-3 min-[1280px]:min-h-0 min-[1280px]:flex-1 min-[1280px]:overflow-y-auto">{standaloneAdd}
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            아직 계약이 없어요. 일정·계약 탭에서 미팅을 ‘계약’으로 처리하면 자동으로 추가되고, 위 버튼으로 바로 추가할 수도 있어요.
          </div>
          <TerminationArchive contracts={archivedRows} />
        </div>
        ) : isPc ? (
          /* PC: 세 열은 한 작업판 높이를 공유하고 각자 휠·스크롤을 소유한다.
             목록 선택은 DirtyGuard를 통과한다. 모바일은 기존 아코디언 유지. */
          <div ref={workspaceRef} className="payment-workspace relative grid min-h-[320px] min-w-0 items-stretch min-[1280px]:min-h-0 min-[1280px]:flex-1 min-[1280px]:overflow-hidden" style={{ gridTemplateColumns: `${masterWidth}px 8px minmax(0, 1fr)` }}>
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="shrink-0 p-1.5">{listModeTabs}</div>
              <div ref={listPaneRef} onScroll={syncBridge} className="payment-list-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
              {standaloneAdd}
              {(listMode === "company" ? companyItems.length : institutionVisible.length) === 0 ? (
                <p className="p-5 text-center text-xs text-slate-400">{emptyListText}</p>
              ) : listMode === "company" ? <ContractListTable grants={grants}
                items={companyItems} activityState={activityState}
                selectedKey={selectedCompany?.key ?? null} onSelect={selectCompany}
                highlight={companyQuery}
                courseStartISO={courseStartISO}
              /> : <InstitutionWorkList groups={institutionGroups} selectedKey={selectedWork?.key ?? null} onSelect={selectWork} />}
              {archivedRows.length > 0 && <div className="px-2 pt-2"><TerminationArchive contracts={archivedRows} /></div>}
              </div>
            </div>
            <button type="button" onPointerDown={beginResize} className="group relative z-10 h-full cursor-col-resize bg-transparent" aria-label="목록과 상세 너비 조절" title="좌우로 드래그해 너비 조절">
              <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200/70 transition-colors ${listMode === "institution" ? "group-hover:bg-red-400" : "group-hover:bg-blue-400"}`} />
            </button>
            {selectedCp && (
              <div className={`payment-detail-shell flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-2xl border bg-white shadow-sm ${listMode === "institution" ? "border-red-200" : "border-blue-200"}`}>
                <div data-payment-detail-banner={selectedLong ? "long-term" : "active"} className={`flex shrink-0 items-center justify-between border-b bg-gradient-to-r px-4 py-2.5 backdrop-blur-xl ${selectedLong ? "border-amber-200 from-amber-100/95 via-amber-50/95 to-white/95" : listMode === "institution" ? "border-red-100 from-red-100/95 via-red-50/95 to-white/95" : "border-blue-100 from-blue-100/95 via-indigo-50/95 to-white/95"}`}>
                  <div className="min-w-0"><h2 className={`truncate text-base font-black ${selectedLong ? "text-amber-950" : listMode === "institution" ? "text-red-950" : "text-blue-950"}`}>{selectedCp.업체명}</h2>{selectedLong ? <p className="truncate text-px-11 text-amber-800">장기관리 · {listMode === "institution" && selectedWork ? `${selectedWork.institution || "기관 미입력"} · 진행 ${selectedWork.slot}` : companyDetailLabel}</p> : listMode === "institution" && selectedWork ? <p className="truncate text-px-11 text-red-700">{selectedWork.institution || "기관 미입력"} · 진행 {selectedWork.slot}{selectedWork.product ? ` · ${selectedWork.product}` : ""}</p> : selectedCompany && <p className="truncate text-px-11 text-blue-700">{companyDetailLabel}</p>}</div>
                  <div className="flex shrink-0 items-center gap-2"><span ref={setDetailStatusTarget} data-payment-pc-status-slot /><button type="button" onClick={() => { setMasterWidth(MASTER_PANE_MIN_WIDTH); setDetailLeftPct(60); }} className="h-7 rounded-md border border-slate-200 bg-white/80 px-2 text-px-11 font-semibold text-slate-500 hover:text-slate-800">기본 너비</button>{stageToggle(selectedCp)}</div>
                </div>
                {focusPayment?.row === selectedCp.row && focusNotice}
                <ContractRow grants={grants}
                  key={`detail-${selectedCp.row}`}
                  cp={selectedCp}
                  ordinal={listMode === "company" ? companyItems.findIndex((item) => item.key === selectedCompany?.key) + 1 : rows.findIndex((r) => r.row === selectedCp.row) + 1}
                  pending={pendingRow === selectedCp.row}
                  institutionOptions={institutionOptions}
                  bare
                  statusTarget={detailStatusTarget}
                  forceOpen
                  detailLeftPct={detailLeftPct}
                  onDetailLeftPctChange={setDetailLeftPct}
                  accentFamily={selFamily}
                  onSave={handleSave}
                  onDeleteRequest={() => makeDeleteRequest(selectedCp)}
                  onTerminateRequest={() => setTerminateTarget(selectedCp)}
                  focusTodoId={safeFocusTodoId}
                  focusedSlot={paymentFocusedSlot(focusPayment, selectedCp.row, listMode === "institution" ? selectedWork?.slot : selectedCompany?.hasProgress ? selectedCompany.work.slot : null)}
                  focusRequestId={focusRequestId}
                  highlight={companyQuery}
                  courseStartISO={courseStartISO}
                />
              </div>
            )}
            <PaymentSelectionBridge ref={bridgeRef} mode={listMode} />
          </div>
        ) : (
          /* 모바일(<pc): 기존 아코디언 (회귀 금지) */
          <div>
            <div className="mb-2">{listModeTabs}</div>{standaloneAdd}
            {(listMode === "company" ? companyItems.length : institutionVisible.length) === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-400">{emptyListText}</p>
            ) : listMode === "institution" ? <InstitutionWorkList
              groups={institutionGroups} selectedKey={selectedWork?.key ?? null} onSelect={selectWork}
              activityState={activityState}
              detailExpanded={mobileDetailExpanded} onToggleDetail={() => dispatch({ type: "toggleDetail" })}
              renderDetail={(item) => selectedCp && selectedWork?.key === item.key ? <>
                {mobileStageBar(selectedCp)}
                <ContractRow grants={grants}
                  key={`institution-detail-${selectedCp.row}`} cp={selectedCp} ordinal={rows.findIndex((r) => r.row === selectedCp.row) + 1}
                  pending={pendingRow === selectedCp.row} institutionOptions={institutionOptions} forceOpen inline
                  companyInfoDefaultOpen={false}
                  onSave={handleSave} onDeleteRequest={() => makeDeleteRequest(selectedCp)}
                  onTerminateRequest={() => setTerminateTarget(selectedCp)} focusTodoId={safeFocusTodoId}
                  focusedSlot={item.slot} courseStartISO={courseStartISO}
                  focusRequestId={focusRequestId}
                />
              </> : null}
            /> : <ContractListTable grants={grants}
              items={companyItems} selectedKey={selectedCompanyKey} onSelect={selectCompany}
              activityState={activityState} detailExpanded={mobileDetailExpanded}
              onToggleDetail={() => dispatch({ type: "toggleDetail" })}
              highlight={companyQuery} courseStartISO={courseStartISO}
              renderDetail={(item) => selectedCompanyKey === item.key ? <>
                {mobileStageBar(item.cp)}
                {focusPayment?.row === item.cp.row && focusNotice}
                <ContractRow grants={grants} key={`company-detail-${item.key}`} cp={item.cp} ordinal={companyItems.findIndex((entry) => entry.key === item.key) + 1}
                  pending={pendingRow === item.cp.row} institutionOptions={institutionOptions} forceOpen inline
                  companyInfoDefaultOpen={false}
                  onSave={handleSave} onDeleteRequest={() => makeDeleteRequest(item.cp)}
                  onTerminateRequest={() => setTerminateTarget(item.cp)} focusTodoId={safeFocusTodoId}
                  focusedSlot={paymentFocusedSlot(focusPayment, item.cp.row, item.hasProgress ? item.work.slot : null)} courseStartISO={courseStartISO}
                  focusRequestId={focusRequestId}
                />
              </> : null}
            />}
          </div>
        )}
        {/* 모바일은 기존 문서 흐름, PC는 위 목록 pane 안에서 해지 보관함을 읽는다. */}
        {!isPc && rows.length > 0 && <TerminationArchive contracts={archivedRows} />}
        </PageContainer>
        </div>
      </div>

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

      {/* 삭제 후 바로가기 팝업 — 2026-05-17 [3] (PostDeleteNavModal 로 분리, 500줄 캡) */}
      {postDeleteNav && <PostDeleteNavModal target={postDeleteNav} onClose={() => setPostDeleteNav(null)} onGo={() => { setPostDeleteNav(null); router.push("/schedule"); }} />}
    </>
  );
}
