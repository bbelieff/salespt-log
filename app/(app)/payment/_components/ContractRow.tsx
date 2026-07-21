/**
 * ContractRow v2 — 1 계약수납 row 카드 (접힘/펼침).
 *
 * v9 prototype 매칭:
 *   - 좌측 보더 = 활성 슬롯 색 (teal/cyan/fuchsia) 또는 완료 시 green
 *   - visiblePayments (1~3): + 수납 추가 / ✕ 제거 버튼
 *   - 슬롯별 색 진행도 (PaymentSlotForm 내부)
 *   - 헤더: 순번 배지 + 업체명 + ✓(완료) + 계약일·매출 + 📋배지 + 💰배지
 *
 * 시트 매핑: 02 계약수납관리 1 row
 *   - C/D/E (계약일/업체명/수임비) — 자동 연동, read-only 표시
 *   - F~L 7 체크박스 / M~AD 3 슬롯 × 6필드
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isCarryoverContract, isTerminatedContract, type ContractPayment, type CompanyInfo } from "@/types";
import { fmtDate, fmtMoney, renderNameWithHighlight } from "./nameHighlight";
import { useDirtyEntry } from "@/components/DirtyGuard";
import CheckboxList, { TOTAL_CHECKBOXES, checkedCount } from "./CheckboxList";
import PaymentSlotForm from "./PaymentSlotForm";
import LinkedFieldsEditor from "./LinkedFieldsEditor";
import CompanyInfoContractSection from "@/components/CompanyInfoContractSection";
import CarryoverBadge from "@/components/CarryoverBadge";
import { progressPct, initialVisiblePayments, EMPTY_SLOT } from "../_lib/payment-progress";
import { useTodosByContract } from "@/query/todos-hooks";
import {
  ACCENT,
  contractAccentFamily,
  docBadgeClass,
  payBadgeClass,
  type AccentFamily,
} from "../_lib/contractAccent";
import { shouldRebaseDraft, shouldRegisterDirty } from "../_lib/draft-sync";

interface Props {
  cp: ContractPayment;
  ordinal: number; // 1-based, 헤더 순번 배지
  pending: boolean;
  /** [3] 진행기관 콤보박스 후보 (전 계약 distinct). */
  institutionOptions?: string[];
  /** 저장. Promise 를 반환하면 saveAll 이 await 한다 — 미저장 가드가 저장 완료 전에 이동하지 않도록. */
  onSave: (next: ContractPayment) => Promise<void> | void;
  onDeleteRequest: () => void;
  /** [계약해지] — TerminationModal 오픈 (contract-termination). */
  onTerminateRequest: () => void;
  /** C 마스터-디테일(데스크탑):
   *  - selectable: 컴팩트 목록 아이템 모드 — 바디 숨김, 헤더 클릭=onSelect.
   *  - selected: 선택 강조(액센트).
   *  - forceOpen: 상세 패널 모드 — 바디 항상 열림(아코디언 토글 없음).
   *  (모두 미지정 = 기존 모바일 아코디언, 회귀 0) */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  forceOpen?: boolean;
  /** 강조색 패밀리 override (마스터-디테일에서 선택카드↔패널 색 일치용). 없으면 draft 상태로 자동. */
  accentFamily?: AccentFamily;
  /** bare: 자체 테두리/라운드/그림자 없이 내용만 렌더(page 가 윤곽선 소유 — 데스크탑 마스터-디테일). */
  bare?: boolean;
  /** 캘린더 → /payment?focus=<todoId>. 이 행에 해당 ToDo 있으면 자동 펼침+하이라이트. */
  focusTodoId?: string | null;
  /** 업체 검색어 — 업체명 일치 부분 <mark> 하이라이트 (CompanySearchBar). */
  highlight?: string;
  /** 시작일(courseStart) — 이월 판정(계약일<시작일 OR 깃발)용. 없으면 깃발만. */
  courseStartISO?: string;
}

// 진행도·슬롯 가시성 헬퍼는 _lib/payment-progress, draft 동기화 판정은 _lib/draft-sync 로 추출(500줄 캡).
// renderNameWithHighlight 는 ./nameHighlight 로 분리(contract-termination PR).

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
  // 이월(아레나 비집계) 판정 — 깃발(AI=이월) 또는 계약일<시작일(동적). 뱃지·흐림에 사용.
  const isCarryover = isCarryoverContract(cp, courseStartISO ?? "");
  const isTerminated = isTerminatedContract(cp); // 해지 — 뱃지·흐림·버튼 숨김
  const [open, setOpen] = useState(false);
  // 바디 표시: 상세패널(forceOpen)=항상 / 컴팩트 목록(selectable)=숨김 / 그 외=아코디언.
  const showBody = forceOpen || (!selectable && open);
  const [draft, setDraft] = useState<ContractPayment>(cp);
  // 편집 의도 — dirty 의 정본(값 비교 아님). 편집 UI 를 안 띄운 인스턴스는 영원히 false. draft-sync 참조.
  const [touched, setTouched] = useState(false);
  const editSeq = useRef(0); // 저장 in-flight 중 새 편집이 들어왔는지 감지
  /** draft 편집 단일 진입점 — 모든 onChange 가 여기를 거친다(의도 기록). */
  const editDraft = (fn: (d: ContractPayment) => ContractPayment) => {
    editSeq.current++;
    setTouched(true);
    setDraft(fn);
  };
  // 업체정보 라이브 드래프트(#411) — 파란 저장이 04+06 까지 함께 영속화.
  const [ciDraft, setCiDraft] = useState<CompanyInfo | undefined>(undefined);
  const [ciTouched, setCiTouched] = useState(false);
  // cp(서버 정본) 변경 시 미편집이면 draft 재기준 — 저장 후 refetch·계약정보 수정·해지 전부 커버.
  // 이게 없으면 옛 draft 가 남아 이탈 팝업 저장 시 방금 저장을 롤백한다(hotfix 2026-07-21).
  const rebaseOk = useRef(true);
  rebaseOk.current = shouldRebaseDraft({ touched, ciTouched });
  const cpKey = JSON.stringify(cp);
  useEffect(() => {
    if (rebaseOk.current) setDraft(cp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpKey]);
  // 저장은 **성공했을 때만** 편집 의도를 해제한다 — 실패인데 해제하면 가드가 풀려 무경고 유실(적대리뷰 BLOCKER).
  const saveAll = async () => {
    const seq = editSeq.current;
    let ciOk = true;
    if (ciTouched && ciDraft) {
      const res = await fetch("/api/company-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 계약일: cp.계약일, 업체명: cp.업체명, 업체정보: ciDraft }),
      }).catch(() => null);
      ciOk = Boolean(res?.ok);
      if (ciOk && editSeq.current === seq) setCiTouched(false); // POST 중 새 입력이면 의도 유지
    }
    await onSave(draft); // 실패 시 throw(page 가 재전파) → 아래 미도달 → touched 유지 → 가드가 붙잡는다
    if (!ciOk) throw new Error("업체정보를 저장하지 못했어요");
    if (editSeq.current === seq) setTouched(false); // 저장 중 새 편집이 없었을 때만 해제
  };
  // 미저장 이탈 가드 — id=useId: 마스터-디테일 동일 행 2인스턴스 키 충돌 방지.
  const dirtyEntryId = useId();
  useDirtyEntry(
    dirtyEntryId,
    shouldRegisterDirty({ selectable, touched, ciTouched, draft, cp }),
    saveAll,
    () => { setDraft(cp); setTouched(false); setCiDraft(undefined); setCiTouched(false); },
    cp.업체명 || "계약 수납",
  );
  const [visiblePayments, setVisiblePayments] = useState<1 | 2 | 3>(() =>
    initialVisiblePayments(cp),
  );

  // Scope 2 — 이 계약의 ToDo (계약일|업체명 안정키). 신규 계약(키 미완성)은 비활성.
  const contractRef = cp.계약일 && cp.업체명 ? `${cp.계약일}|${cp.업체명}` : "";
  const todosQuery = useTodosByContract(contractRef);
  const allTodos = todosQuery.data?.todos ?? [];

  // 캘린더 포커스 ToDo 가 이 행에 있으면 자동 펼침(모바일 아코디언/PC 목록 선택) → 하이라이트 노출.
  const hasFocusTodo =
    !!focusTodoId && allTodos.some((t) => t.id === focusTodoId);
  useEffect(() => {
    if (!hasFocusTodo) return;
    if (selectable) onSelect?.();
    else if (!forceOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocusTodo]);

  // [3] 진행기관 후보 = 전 계약 distinct(prop) + 이 계약 투두 institutionRef + 현재 슬롯값.
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

  // 진행도 평균 (보이는 슬롯만)
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

  // 접힘 헤더 sub: 진행 중 기관(진행률<100% + 진행기관명). 예 "미소재단(60%)·…" 한 줄 truncate.
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

  // 강조색 패밀리 — 진행상태색(완료 green/활성 teal·cyan·fuchsia/전 slate). override 우선(카드↔패널 일치).
  const family = accentFamily ?? contractAccentFamily(draft);
  const accent = ACCENT[family];
  // 닫힘 시 좌측 상태바(at-a-glance). bare(데스크탑 패널/목록)에선 page 가 윤곽선 소유 → 생략.
  const leftBar = bare ? "" : `border-l-4 ${accent.leftBar}`;

  const handleAddSlot = () => {
    if (visiblePayments < 3) {
      setVisiblePayments((v) => (v + 1) as 1 | 2 | 3);
    }
  };
  const handleRemoveSlot = (slotIdx: 1 | 2 | 3) => {
    if (slotIdx === 1) return; // 슬롯1은 제거 불가
    editDraft((d) => ({ ...d, [`수납${slotIdx}`]: EMPTY_SLOT }));
    if (slotIdx === visiblePayments)
      setVisiblePayments((v) => Math.max(1, v - 1) as 1 | 2 | 3);
  };

  return (
    <div
      className={
        bare
          ? // 데스크탑 마스터-디테일: page 가 윤곽선 소유 → 자체 테두리 없음. 모바일/단독: 상태색 2px.
            "overflow-hidden bg-white transition-all duration-200"
          : `mb-3 overflow-hidden rounded-xl bg-white transition-all duration-200 ${
              showBody
                ? `border-2 shadow-md ${accent.border}`
                : `border border-gray-200 shadow-sm ${leftBar}`
            }`
      }
    >
      {/* 헤더 (접힘/선택) */}
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
          isCarryover || isTerminated ? "opacity-60" : "" /* 이월·해지 흐림 — §4 */
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
        {/* 아코디언: 아래 chevron(open 시 회전) / 컴팩트 목록: 우향(선택 유도) / 상세: 없음 */}
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

      {/* 펼침 — 헤더와 한 덩어리(틴트·ring 연결). 업체정보 박스 제거(헤더가 이미 표시). */}
      {showBody && (
        <div className="card-open-anim space-y-3 p-3">
          <CarryoverBadge 구분={isCarryover ? "이월" : ""} variant="note" />
          <LinkedFieldsEditor cp={cp} />
          <CompanyInfoContractSection 계약일={cp.계약일} 업체명={cp.업체명} hideSave onChange={(ci) => { editSeq.current++; setCiDraft(ci); setCiTouched(true); }} />

          {/* 7 체크박스 */}
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

          {/* 2026-05-17: 로드맵 메모 — 카드 차원, 슬롯들 위에 위치 */}
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

          {/* 수납 현황 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                📈 실무 진행
              </span>
              <span
                className="text-xs text-gray-500"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span className="font-medium text-gray-700">
                  ₩{fmtMoney(totalReceived)}
                </span>
                <span className="mx-0.5 text-gray-400">/</span>
                <span className="font-medium text-gray-700">
                  ₩{fmtMoney(totalApproved)}
                </span>
              </span>
            </div>
            <div className="space-y-2">
              <PaymentSlotForm
                index={1}
                slot={draft.수납1}
                contractRef={contractRef}
                companyName={cp.업체명}
                savedInstitution={cp.수납1.진행기관}
                institutionOptions={slotInstitutionOptions}
                todos={allTodos}
                focusTodoId={focusTodoId}
                onEnsureSaved={() => void Promise.resolve(onSave(draft)).catch(() => {})}
                onChange={(next) => editDraft((d) => ({ ...d, 수납1: next }))}
              />
              {visiblePayments >= 2 && (
                <PaymentSlotForm
                  index={2}
                  slot={draft.수납2}
                  removable={visiblePayments === 2}
                  contractRef={contractRef}
                  companyName={cp.업체명}
                  savedInstitution={cp.수납2.진행기관}
                  institutionOptions={slotInstitutionOptions}
                  todos={allTodos}
                  focusTodoId={focusTodoId}
                  onEnsureSaved={() => void Promise.resolve(onSave(draft)).catch(() => {})}
                  onChange={(next) =>
                    editDraft((d) => ({ ...d, 수납2: next }))
                  }
                  onRemove={() => handleRemoveSlot(2)}
                />
              )}
              {visiblePayments >= 3 && (
                <PaymentSlotForm
                  index={3}
                  slot={draft.수납3}
                  removable
                  contractRef={contractRef}
                  companyName={cp.업체명}
                  savedInstitution={cp.수납3.진행기관}
                  institutionOptions={slotInstitutionOptions}
                  todos={allTodos}
                  focusTodoId={focusTodoId}
                  onEnsureSaved={() => void Promise.resolve(onSave(draft)).catch(() => {})}
                  onChange={(next) =>
                    editDraft((d) => ({ ...d, 수납3: next }))
                  }
                  onRemove={() => handleRemoveSlot(3)}
                />
              )}
              {visiblePayments < 3 && (
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-transparent px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  <span className="text-base leading-none">+</span>
                  <span>진행 추가 ({visiblePayments + 1}회차)</span>
                </button>
              )}
            </div>
          </div>

          {/* 액션 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void saveAll().catch(() => {})}
              disabled={pending}
              className="h-11 flex-1 rounded-lg bg-blue-500 text-sm font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700 active:scale-95 disabled:bg-gray-300"
            >
              {pending ? "저장중..." : "💾 저장"}
            </button>
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
