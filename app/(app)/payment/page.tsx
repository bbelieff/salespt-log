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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGuardedNav } from "@/components/DirtyGuard";
import { useRouter } from "next/navigation";
import { type ContractPayment } from "@/types";
import { activeWorkContracts } from "@/lib/analytics/payment-work-status";
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
import PaymentSelectionBridge, { syncPaymentSelectionBridge } from "./_components/PaymentSelectionBridge";
import PaymentPerformanceSummary from "./_components/PaymentPerformanceSummary";
import TerminationModal from "./_components/TerminationModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import TerminationArchive from "./_components/TerminationArchive";
import PriorContractSection from "./_components/PriorContractSection";
import StandaloneCompanyAdd from "./_components/StandaloneCompanyAdd";
import CompanySearchBar from "./_components/CompanySearchBar";
import PaymentSortControl from "./_components/PaymentSortControl";
import PaymentListModeTabs from "./_components/PaymentListModeTabs";
import useMasterPaneWidth from "./_components/useMasterPaneWidth";
import usePaymentFocus from "./_components/usePaymentFocus";
import { buildCompanyWorkItems, sortCompanyWorkItems, type CompanyWorkItem, type PaymentSortKey } from "./_lib/company-work-view";
import TopHeader from "@/components/TopHeader";
import DriveLinkBar from "./_components/DriveLinkBar";
import { contractAccentFamily } from "./_lib/contractAccent";
import { buildInstitutionWorkItems, groupInstitutionWorkItems, type InstitutionWorkItem } from "./_lib/institution-view";
import { useAllTodos } from "@/query/todos-hooks";
import { fmtDate, fmtMoney } from "./_components/nameHighlight";
import { checkedCount, TOTAL_CHECKBOXES } from "./_components/CheckboxList";

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
  const [listMode, setListMode] = useState<"company" | "institution">("company");
  const [selectedWorkKey, setSelectedWorkKey] = useState<string | null>(null);
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string | null>(null);
  const [mobileDetailExpanded, setMobileDetailExpanded] = useState(true);
  const [focusRequestId, setFocusRequestId] = useState(0);
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
  const listPaneRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SVGSVGElement>(null);
  const { masterWidth, setMasterWidth, beginResize } = useMasterPaneWidth(workspaceRef);
  const [detailLeftPct, setDetailLeftPct] = useState(60);

  const { focusTodoId, focusPayment } = usePaymentFocus(list.data?.rows, isPc);
  useEffect(() => {
    if (focusPayment) {
      setSelectedRow(focusPayment.row);
      setSelectedCompanyKey(`${focusPayment.row}-${focusPayment.slot}`);
      setFocusRequestId((id) => id + 1);
    }
  }, [focusPayment]);

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
  const institutionItems = buildInstitutionWorkItems(rows, courseStartISO, allTodos.data?.todos ?? []);
  const activityState = allTodos.isError ? "error" : allTodos.data ? "ready" : "loading";
  const companyItems = sortCompanyWorkItems(buildCompanyWorkItems(filteredRows, institutionItems), sortKey);
  const institutionGroups = groupInstitutionWorkItems(institutionItems, listMode === "institution" ? companyQuery : "", isPc ? "product" : "activity");
  const institutionVisible = institutionGroups.flatMap((group) => group.items);
  const selectedWork = institutionVisible.find((item) => item.key === selectedWorkKey) ?? institutionVisible[0];
  const selectedCompany = companyItems.find((item) => item.key === selectedCompanyKey)
    ?? companyItems.find((item) => item.cp.row === selectedRow) ?? companyItems[0];

  const selectedCp = listMode === "institution"
    ? selectedWork ? rows.find((r) => r.row === selectedWork.row) : undefined
    : selectedCompany?.cp;
  // 선택 행이 스크롤 밖으로 나가면 연결부도 숨겨 상세 위에 잔상을 남기지 않는다.
  const syncBridge = () => syncPaymentSelectionBridge(workspaceRef.current, listPaneRef.current, bridgeRef.current);
  useLayoutEffect(() => {
    if (!isPc) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = workspaceRef.current;
        if (!root) return;
        const pageTop = root.getBoundingClientRect().top + window.scrollY;
        const bottomSpace = Number.parseFloat(getComputedStyle(root.closest("main") ?? root).paddingBottom) || 0;
        root.style.height = `${Math.max(320, Math.floor(window.innerHeight - pageTop - bottomSpace))}px`;
        syncBridge();
      });
    };
    sync();
    const summary = document.querySelector<HTMLElement>("[data-payment-summary]");
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    if (summary) observer?.observe(summary);
    // 기관을 접고 펼칠 때 선택 행의 DOM 위치가 바뀌므로 연결부를 즉시 재배치한다.
    const listObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(sync);
    if (listPaneRef.current) listObserver?.observe(listPaneRef.current, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-expanded", "aria-selected", "data-active-institution"] });
    window.addEventListener("resize", sync);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); listObserver?.disconnect(); window.removeEventListener("resize", sync); };
  }, [isPc, list.isLoading, rows.length, listMode, selectedCp?.row, selectedWorkKey, companyQuery, sortKey, masterWidth]);
  // 선택 상세의 내부 강조색(진행상태 기반) — ContractRow에 전달.
  const selFamily = selectedCp ? contractAccentFamily(selectedCp) : "slate";
  const selectWork = (item: InstitutionWorkItem) => guardedNav(() => {
    setSelectedWorkKey(item.key);
    setSelectedRow(item.row);
    setMobileDetailExpanded(true);
    setFocusRequestId((id) => id + 1);
    // 모바일은 선택 업체 바로 아래에 상세가 열리므로 슬롯으로 강제 점프하지 않는다.
    if (isPc) window.setTimeout(() => document.getElementById(`payment-slot-${item.row}-${item.slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  });
  const selectCompany = (item: CompanyWorkItem) => guardedNav(() => {
    setSelectedCompanyKey(item.key); setSelectedRow(item.cp.row ?? null);
    setMobileDetailExpanded(true); setFocusRequestId((id) => id + 1);
    if (isPc && item.hasProgress) window.setTimeout(() => document.getElementById(`payment-slot-${item.cp.row}-${item.work.slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  });
  const changeListMode = (mode: "company" | "institution") => guardedNav(() => {
    if (mode === listMode) return;
    if (mode === "institution") setSelectedWorkKey(institutionItems.find((item) => item.key === selectedCompany?.key)?.key ?? null);
    else { setSelectedCompanyKey(selectedWork?.key ?? null); setSelectedRow(selectedWork?.row ?? null); }
    setMobileDetailExpanded(true); setCompanyQuery(""); setListMode(mode);
  });
  const listModeTabs = <PaymentListModeTabs value={listMode} onChange={changeListMode} />;

  const standaloneAdd = <StandaloneCompanyAdd listMode={listMode} className={isPc ? "px-2 pt-2" : "mb-3"} onCreated={(row) => guardedNav(() => { setCompanyQuery(""); setSelectedCompanyKey(null); setSelectedRow(row); setMobileDetailExpanded(true); setFocusRequestId((id) => id + 1); window.setTimeout(() => { const b = document.querySelector<HTMLElement>(`[data-row="${row}"]`); b?.scrollIntoView({ block: "nearest" }); b?.focus({ preventScroll: true }); }, 80); })} />;
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
          rows={activeWorkContracts(allRows, courseStartISO)}
          todos={allTodos.data?.todos ?? []}
          onNavigate={(row, slot) => {
            guardedNav(() => { setListMode("company"); setCompanyQuery(""); setSelectedRow(row); setSelectedCompanyKey(`${row}-${slot}`); setFocusRequestId((id) => id + 1); });
            window.setTimeout(() => document.getElementById(`payment-slot-${row}-${slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
          }}
        />

        {/* Drive 바로가기 */}
        <DriveLinkBar />

        {/* 모바일 업무매뉴얼·정책자금 뉴스 바로가기 */}
        <PriorContractSection />

        {/* 업체 검색·정렬: PC에서는 한 줄, 모바일에서는 기존 순서. */}
        {!list.isLoading && !list.isError && rows.length > 0 && (
          <div className="mb-3 space-y-2 min-[1280px]:mb-2 min-[1280px]:flex min-[1280px]:items-center min-[1280px]:gap-3 min-[1280px]:space-y-0">
            <CompanySearchBar
              value={companyQuery}
              onChange={(v) => guardedNav(() => setCompanyQuery(v))}
              matchCount={listMode === "company" ? companyItems.length : institutionVisible.length}
              total={institutionItems.length}
              placeholder={listMode === "company" ? "업체명 검색" : "기관·상품·업체 검색"}
              unit={listMode === "company" ? "개 항목" : "건 진행"}
              matchUnit={listMode === "company" ? "개 항목" : "건"}
            />
            {listMode === "company" && <PaymentSortControl value={sortKey} onChange={(k) => guardedNav(() => setSortKey(k))} />}
          </div>
        )}

        {/* 리스트 */}
        {list.isLoading ? null : list.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : rows.length === 0 ? (<div className="space-y-3">{standaloneAdd}
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            아직 계약이 없어요. 일정·계약 탭에서 미팅을 ‘계약’으로 처리하면 자동으로 추가되고, 위 버튼으로 바로 추가할 수도 있어요.
          </div></div>
        ) : isPc ? (
          /* PC: 세 열은 한 작업판 높이를 공유하고 각자 휠·스크롤을 소유한다.
             목록 선택은 DirtyGuard를 통과한다. 모바일은 기존 아코디언 유지. */
          <div ref={workspaceRef} className="payment-workspace relative grid h-[calc(100dvh-18rem)] min-h-[320px] min-w-0 items-stretch" style={{ gridTemplateColumns: `${masterWidth}px 8px minmax(0, 1fr)` }}>
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="shrink-0 p-1.5">{listModeTabs}</div>
              <div ref={listPaneRef} onScroll={syncBridge} className="payment-list-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
              {standaloneAdd}
              {(listMode === "company" ? companyItems.length : institutionVisible.length) === 0 ? (
                <p className="p-5 text-center text-xs text-slate-400">검색 결과가 없어요. 검색어를 지우면 전체 목록이 나옵니다.</p>
              ) : listMode === "company" ? <ContractListTable
                items={companyItems} activityState={activityState}
                selectedKey={selectedCompany?.key ?? null} onSelect={selectCompany}
                highlight={companyQuery}
                courseStartISO={courseStartISO}
              /> : <InstitutionWorkList groups={institutionGroups} selectedKey={selectedWork?.key ?? null} onSelect={selectWork} />}
              </div>
            </div>
            <button type="button" onPointerDown={beginResize} className="group relative z-10 h-full cursor-col-resize bg-transparent" aria-label="목록과 상세 너비 조절" title="좌우로 드래그해 너비 조절">
              <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200/70 transition-colors ${listMode === "institution" ? "group-hover:bg-red-400" : "group-hover:bg-blue-400"}`} />
            </button>
            {selectedCp && (
              <div className={`payment-detail-shell flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-2xl border bg-white shadow-sm ${listMode === "institution" ? "border-red-200" : "border-blue-200"}`}>
                <div className={`flex shrink-0 items-center justify-between border-b bg-gradient-to-r px-4 py-2.5 backdrop-blur-xl ${listMode === "institution" ? "border-red-100 from-red-100/95 via-red-50/95 to-white/95" : "border-blue-100 from-blue-100/95 via-indigo-50/95 to-white/95"}`}>
                  <div className="min-w-0"><h2 className={`truncate text-base font-black ${listMode === "institution" ? "text-red-950" : "text-blue-950"}`}>{selectedCp.업체명}</h2>{listMode === "institution" && selectedWork ? <p className="truncate text-[11px] text-red-700">{selectedWork.institution || "기관 미입력"} · 진행 {selectedWork.slot}{selectedWork.product ? ` · ${selectedWork.product}` : ""}</p> : selectedCompany && <p className="truncate text-[11px] text-blue-700">{selectedCompany.hasProgress ? `진행 ${selectedCompany.work.slot} · ${selectedCompany.work.institution || "기관 미입력"}${selectedCompany.work.product ? ` · ${selectedCompany.work.product}` : ""}` : "진행건 미등록"}</p>}</div>
                  <button type="button" onClick={() => { setMasterWidth(360); setDetailLeftPct(60); }} className="h-7 rounded-md border border-slate-200 bg-white/80 px-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800">기본 너비</button>
                </div>
                <ContractRow
                  key={`detail-${selectedCp.row}`}
                  cp={selectedCp}
                  ordinal={listMode === "company" ? companyItems.findIndex((item) => item.key === selectedCompany?.key) + 1 : rows.findIndex((r) => r.row === selectedCp.row) + 1}
                  pending={pendingRow === selectedCp.row}
                  institutionOptions={institutionOptions}
                  bare
                  forceOpen
                  detailLeftPct={detailLeftPct}
                  onDetailLeftPctChange={setDetailLeftPct}
                  accentFamily={selFamily}
                  onSave={handleSave}
                  onDeleteRequest={() => makeDeleteRequest(selectedCp)}
                  onTerminateRequest={() => setTerminateTarget(selectedCp)}
                  focusTodoId={focusTodoId}
                  focusedSlot={listMode === "institution" ? selectedWork?.slot : selectedCompany?.hasProgress ? selectedCompany.work.slot : null}
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
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-400">검색 결과가 없어요. 검색어를 지우면 전체 목록이 나옵니다.</p>
            ) : listMode === "institution" ? <InstitutionWorkList
              groups={institutionGroups} selectedKey={selectedWork?.key ?? null} onSelect={selectWork}
              activityState={activityState}
              detailExpanded={mobileDetailExpanded} onToggleDetail={() => setMobileDetailExpanded((value) => !value)}
              renderDetail={(item) => selectedCp && selectedWork?.key === item.key ? <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-red-100 px-2.5 py-2 text-[11px] text-slate-500">
                  <span className="min-w-0 flex-1">{fmtDate(selectedCp.계약일)} · 수임비 ₩{fmtMoney(selectedCp.수임비)}</span>
                  <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">📋 {checkedCount(selectedCp)}/{TOTAL_CHECKBOXES}</span>
                </div>
                <ContractRow
                  key={`institution-detail-${selectedCp.row}`} cp={selectedCp} ordinal={rows.findIndex((r) => r.row === selectedCp.row) + 1}
                  pending={pendingRow === selectedCp.row} institutionOptions={institutionOptions} forceOpen inline
                  onSave={handleSave} onDeleteRequest={() => makeDeleteRequest(selectedCp)}
                  onTerminateRequest={() => setTerminateTarget(selectedCp)} focusTodoId={focusTodoId}
                  focusedSlot={item.slot} courseStartISO={courseStartISO}
                  focusRequestId={focusRequestId}
                />
              </> : null}
            /> : <ContractListTable
              items={companyItems} selectedKey={selectedCompanyKey} onSelect={selectCompany}
              activityState={activityState} detailExpanded={mobileDetailExpanded}
              onToggleDetail={() => setMobileDetailExpanded((value) => !value)}
              highlight={companyQuery} courseStartISO={courseStartISO}
              renderDetail={(item) => selectedCompanyKey === item.key ? <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-blue-100 px-2.5 py-2 text-[11px] text-slate-500">
                  <span className="min-w-0 flex-1">{fmtDate(item.cp.계약일)} · 수임비 ₩{fmtMoney(item.cp.수임비)}</span>
                  <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">📋 {checkedCount(item.cp)}/{TOTAL_CHECKBOXES}</span>
                </div>
                <ContractRow key={`company-detail-${item.key}`} cp={item.cp} ordinal={companyItems.findIndex((entry) => entry.key === item.key) + 1}
                  pending={pendingRow === item.cp.row} institutionOptions={institutionOptions} forceOpen inline
                  onSave={handleSave} onDeleteRequest={() => makeDeleteRequest(item.cp)}
                  onTerminateRequest={() => setTerminateTarget(item.cp)} focusTodoId={focusTodoId}
                  focusedSlot={item.hasProgress ? item.work.slot : null} courseStartISO={courseStartISO}
                  focusRequestId={focusRequestId}
                />
              </> : null}
            />}
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
