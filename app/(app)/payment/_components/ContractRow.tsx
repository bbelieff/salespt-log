/**
 * ContractRow v2 — 1 계약수납 row 카드 (접힘/펼침).
 *
 * 루틴 편집(체크박스·슬롯·메모·금액·날짜)은 자동 저장 — 일반 저장 버튼 없음.
 * 텍스트/카운트는 디바운스, 금액/날짜 그룹 blur 시 즉시 flush. 무효하면
 * 저장하지 않고 DirtyGuard 가 보호한다. 계약해지·삭제는 명시적 액션 유지.
 *
 * 시트 매핑: 02 계약수납관리 1 row (C/D/E 자동 연동 read-only 표시,
 * F~L 7 체크박스 / M~AD 3 슬롯 × 6필드). 업체정보(04·06)는 디바운스 POST.
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isCarryoverContract, isTerminatedContract, type ContractPayment } from "@/types";
import { fmtDate, fmtMoney, renderNameWithHighlight } from "./nameHighlight";
import { useDirtyEntry } from "@/components/DirtyGuard";
import CheckboxList, { TOTAL_CHECKBOXES, checkedCount } from "./CheckboxList";
import ContractSlots from "./ContractSlots";
import { useContractCompanyInfo } from "./useContractCompanyInfo";
import LinkedFieldsEditor from "./LinkedFieldsEditor";
import CompanyInfoContractSection from "@/components/CompanyInfoContractSection";
import CarryoverBadge from "@/components/CarryoverBadge";
import { progressPct, initialVisiblePayments, EMPTY_SLOT, validContractDraft } from "../_lib/payment-progress";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { useTodosByContract } from "@/query/todos-hooks";
import {
  ACCENT,
  contractAccentFamily,
  docBadgeClass,
  payBadgeClass,
  type AccentFamily,
} from "../_lib/contractAccent";

interface Props {
  cp: ContractPayment;
  ordinal: number;
  pending: boolean;
  institutionOptions?: string[];
  /** 자동 저장 경로는 { quiet: true } 로 호출 — 루틴 성공 토스트 없음. */
  onSave: (next: ContractPayment, opts?: { quiet?: boolean }) => Promise<void> | void;
  onDeleteRequest: () => void;
  onTerminateRequest: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  forceOpen?: boolean;
  accentFamily?: AccentFamily;
  bare?: boolean;
  focusTodoId?: string | null;
  highlight?: string;
  courseStartISO?: string;
}

export default function ContractRow({
  cp,
  ordinal,
  pending,
  institutionOptions,
  onSave,
  onDeleteRequest,
  onTerminateRequest,
  selectable = false,
  selected = false,
  onSelect,
  forceOpen = false,
  accentFamily,
  bare = false,
  focusTodoId,
  highlight,
  courseStartISO,
}: Props) {
  const isCarryover = isCarryoverContract(cp, courseStartISO ?? "");
  const isTerminated = isTerminatedContract(cp);
  const [open, setOpen] = useState(false);
  const showBody = forceOpen || (!selectable && open);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const cpRef = useRef(cp);
  cpRef.current = cp;

  // 루틴 draft 자동 저장 — target=row 고정, 공유 코어(Scope A)가 영속화.
  const {
    draft,
    status,
    error,
    dirty,
    savedAt,
    canUndo,
    update,
    stage,
    commit,
    syncServer,
    // C3: 공유 useAutosave.discard() — 큐 예약 취소 + draft=saved 강제(공유 코어 소유).
    discard,
    retry,
    flush,
    undo,
  } = useAutosave<ContractPayment>({
    target: { kind: "contract", row: cp.row },
    initial: cp,
    delayMs: 700,
    save: ({ payload }) =>
      Promise.resolve(onSaveRef.current(payload, { quiet: true })),
  });
  const cpKey = JSON.stringify(cp);
  // refetch 재기준은 clean 일 때만 — 편집 중 호출은 큐 예약분을 취소해
  // 미전송분이 고착된다(공유 syncServer 이슈, REPORT-C2).
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    syncServer(JSON.parse(cpKey) as ContractPayment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpKey]);
  const commitGroup = () =>
    commit(validContractDraft(draft), "금액·날짜를 확인해주세요");

  // 업체정보(04·06) 디바운스 영속화 — 계약 PATCH 와 별도 키, 각 1회씩.
  const { ciDirty, ciState, flushCi, onCiChange, resetCi } =
    useContractCompanyInfo(() => ({
      계약일: cpRef.current.계약일,
      업체명: cpRef.current.업체명,
    }));

  // 텍스트/카운트 → 디바운스 저장, 금액/날짜 → stage 후 그룹 blur 커밋.
  const editDraft = (fn: (d: ContractPayment) => ContractPayment) => {
    update(fn(draft));
  };
  const stageDraft = (fn: (d: ContractPayment) => ContractPayment) => {
    stage(fn(draft));
  };
  const saveForGuard = async () => {
    if (!validContractDraft(draft)) throw new Error("금액·날짜를 확인해주세요");
    commit(true);
    await flushCi(true);
    await flush();
  };
  // 파기는 큐 예약 취소 + draft=saved 강제인 discard() — syncServer(saved) 는
  // dirty draft 를 유지해 파기가 화면 초안을 되돌리지 못한다.
  const discardAll = () => {
    resetCi();
    discard();
  };
  const dirtyEntryId = useId();
  useDirtyEntry(
    dirtyEntryId,
    !selectable && (dirty || ciDirty),
    saveForGuard,
    discardAll,
    cp.업체명 || "계약 수납",
  );
  const retryAll = () => {
    if (ciState.error) void flushCi(false);
    retry();
  };

  const [visiblePayments, setVisiblePayments] = useState<1 | 2 | 3>(() =>
    initialVisiblePayments(cp),
  );

  const contractRef = cp.계약일 && cp.업체명 ? `${cp.계약일}|${cp.업체명}` : "";
  const todosQuery = useTodosByContract(contractRef);
  const allTodos = todosQuery.data?.todos ?? [];

  const hasFocusTodo =
    !!focusTodoId && allTodos.some((t) => t.id === focusTodoId);
  useEffect(() => {
    if (!hasFocusTodo) return;
    if (selectable) onSelect?.();
    else if (!forceOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocusTodo]);

  const slotInstitutionOptions = useMemo(() => {
    const set = new Set<string>(institutionOptions ?? []);
    for (const t of allTodos) {
      const v = t.institutionRef?.trim();
      if (v) set.add(v);
    }
    for (const s of [cp.수납1, cp.수납2, cp.수납3]) {
      const v = s.진행기관?.trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  }, [institutionOptions, allTodos, cp]);

  const totalApproved =
    draft.수납1.승인금액 + draft.수납2.승인금액 + draft.수납3.승인금액;
  const totalReceived =
    draft.수납1.수납액 + draft.수납2.수납액 + draft.수납3.수납액;
  const docsDone = checkedCount(draft);

  const visibleSlots = useMemo(
    () => [draft.수납1, draft.수납2, draft.수납3].slice(0, visiblePayments),
    [draft, visiblePayments],
  );
  const avgPct = useMemo(() => {
    if (!visibleSlots.length) return 0;
    const sum = visibleSlots.reduce(
      (s, slot) => s + progressPct(slot.진행률),
      0,
    );
    return Math.round(sum / visibleSlots.length);
  }, [visibleSlots]);

  const ongoingAgencies = useMemo(() => {
    return visibleSlots
      .filter((slot) => {
        const pct = progressPct(slot.진행률);
        return slot.진행기관.trim() !== "" && pct < 100;
      })
      .map((slot) => `${slot.진행기관}(${progressPct(slot.진행률)}%)`)
      .join(" · ");
  }, [visibleSlots]);

  const isComplete =
    docsDone === TOTAL_CHECKBOXES && visiblePayments >= 1 && avgPct >= 100;

  const family = accentFamily ?? contractAccentFamily(draft);
  const accent = ACCENT[family];
  const leftBar = bare ? "" : `border-l-4 ${accent.leftBar}`;

  const handleAddSlot = () => {
    if (visiblePayments < 3) {
      setVisiblePayments((v) => (v + 1) as 1 | 2 | 3);
    }
  };
  const handleRemoveSlot = (slotIdx: 1 | 2 | 3) => {
    if (slotIdx === 1) return;
    editDraft((d) => ({ ...d, [`수납${slotIdx}`]: EMPTY_SLOT }));
    if (slotIdx === visiblePayments)
      setVisiblePayments((v) => Math.max(1, v - 1) as 1 | 2 | 3);
  };

  return (
    <div
      className={
        bare
          ? "overflow-hidden bg-white transition-all duration-200"
          : `mb-3 overflow-hidden rounded-xl bg-white transition-all duration-200 ${
              showBody
                ? `border-2 shadow-md ${accent.border}`
                : `border border-gray-200 shadow-sm ${leftBar}`
            }`
      }
    >
      <button
        type="button"
        onClick={
          selectable
            ? () => onSelect?.()
            : forceOpen
              ? undefined
              : () => setOpen((v) => !v)
        }
        className={`flex w-full items-center gap-2 p-3 text-left transition-colors ${
          showBody ? accent.tint : ""
        } ${forceOpen ? "" : "hover:bg-gray-50 active:bg-gray-100"} ${
          isCarryover || isTerminated ? "opacity-60" : ""
        }`}
        style={{ minHeight: 60 }}
        aria-expanded={showBody}
        aria-current={selected ? "true" : undefined}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
          {ordinal}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
            {isCarryover && <CarryoverBadge 구분="이월" variant="badge" />}
            {isTerminated && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">해지</span>
            )}
            {renderNameWithHighlight(cp.업체명, highlight)}
            {isComplete && <span className="text-xs text-green-600">✓</span>}
          </div>
          <div
            className="mt-0.5 text-xs text-gray-500"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmtDate(cp.계약일)} · 수임비 ₩{fmtMoney(cp.수임비)}
            {totalReceived > 0 && (
              <>
                {" · "}
                <span className="text-green-700">
                  수수료 ₩{fmtMoney(totalReceived)}
                </span>
              </>
            )}
          </div>
          {ongoingAgencies && (
            <div className="mt-0.5 truncate text-[11px] text-blue-600">
              🔄 {ongoingAgencies}
            </div>
          )}
          {isTerminated && (
            <div className="mt-0.5 truncate text-[11px] text-red-500">
              해지 {fmtDate(cp.해지일)}
              {cp.반환액 > 0 && <> · 반환 ₩{fmtMoney(cp.반환액)}</>}
              {cp.해지사유 && <> · {cp.해지사유}</>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${docBadgeClass(docsDone)}`}
          >
            📋 {docsDone}/{TOTAL_CHECKBOXES}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${payBadgeClass(avgPct)}`}
          >
            💰 {avgPct === 0 ? "—" : `${avgPct}%`}
          </span>
        </div>
        {!forceOpen && (
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
              !selectable && open ? "rotate-180" : ""
            } ${selectable ? "-rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {showBody && (
        <div
          className="card-open-anim space-y-3 p-3"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              commitGroup();
              if (ciDirty) void flushCi(false);
            }
          }}
        >
          {(status !== "idle" || canUndo || ciState.error || ciState.saving) && (
            <div className="flex flex-col gap-1">
              <AutosaveStatus
                status={status}
                error={error}
                savedAt={savedAt}
                onRetry={retryAll}
                canUndo={canUndo}
                onUndo={undo}
              />
              {ciState.saving && status === "idle" && !ciState.error && (
                <span className="text-[11px] text-gray-400" aria-live="polite">저장 중…</span>
              )}
              {ciState.error && (
                <p className="text-[11px] font-medium text-red-600" aria-live="polite">
                  ⚠ 업체정보: {ciState.error} — 입력은 유지됩니다
                </p>
              )}
            </div>
          )}
          <CarryoverBadge 구분={isCarryover ? "이월" : ""} variant="note" />
          <LinkedFieldsEditor cp={cp} />
          <CompanyInfoContractSection 계약일={cp.계약일} 업체명={cp.업체명} hideSave onChange={onCiChange} identityKey={`contract-row:${cp.row}`} />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                📋 계약 후 프로세스
              </span>
              <span className="text-xs text-gray-500">
                <span
                  className={`font-semibold ${
                    docsDone === TOTAL_CHECKBOXES
                      ? "text-green-600"
                      : docsDone === 0
                        ? "text-gray-400"
                        : "text-blue-600"
                  }`}
                >
                  {docsDone}
                </span>{" "}
                / {TOTAL_CHECKBOXES}
              </span>
            </div>
            <CheckboxList
              draft={draft}
              onChange={(key, next) =>
                editDraft((d) => ({ ...d, [key]: next }))
              }
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
            <label className="mb-1 block text-xs font-semibold text-amber-800">
              📍 로드맵 메모{" "}
              <span className="font-normal text-amber-600/70">
                · 전체 수납기관 진행 로드맵
              </span>
            </label>
            <textarea
              rows={2}
              value={draft.로드맵메모}
              onChange={(e) =>
                editDraft((d) => ({ ...d, 로드맵메모: e.target.value }))
              }
              placeholder="예: [1] 미소재단 후 [2] 대환으로 신용점수 올리고 [3] 신용보증재단 진행"
              className="w-full resize-none rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          <ContractSlots
            draft={draft}
            cp={cp}
            contractRef={contractRef}
            slotInstitutionOptions={slotInstitutionOptions}
            todos={allTodos}
            focusTodoId={focusTodoId}
            visiblePayments={visiblePayments}
            totalApproved={totalApproved}
            totalReceived={totalReceived}
            onAddSlot={handleAddSlot}
            onRemoveSlot={handleRemoveSlot}
            onSlotChange={(index, next) => {
              // 금액/날짜만 바뀌면 stage(그룹 blur 커밋), 그 외는 디바운스 저장.
              const prev = draft[`수납${index}`];
              const moneyDateOnly =
                next.진행기관 === prev.진행기관 &&
                next.메모 === prev.메모 &&
                next.현황 === prev.현황 &&
                next.진행률 === prev.진행률 &&
                (next.승인금액 !== prev.승인금액 ||
                  next.수납액 !== prev.수납액 ||
                  next.수납일 !== prev.수납일);
              (moneyDateOnly ? stageDraft : editDraft)((d) => ({
                ...d,
                [`수납${index}`]: next,
              }));
            }}
            onEnsureSaved={commitGroup}
          />

          <div className="flex gap-2 pt-1">
            {!isTerminated && (
              <button
                type="button"
                onClick={onTerminateRequest}
                disabled={pending}
                className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-95 disabled:opacity-50"
              >
                계약해지
              </button>
            )}
            <button
              type="button"
              onClick={onDeleteRequest}
              disabled={pending}
              className="h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:scale-95 disabled:opacity-50"
            >
              🗑 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
