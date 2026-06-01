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

import { useMemo, useState } from "react";
import type { ContractPayment } from "@/types";
import CheckboxList, { TOTAL_CHECKBOXES, checkedCount } from "./CheckboxList";
import PaymentSlotForm from "./PaymentSlotForm";
import { useTodosByContract } from "@/query/todos-hooks";

interface Props {
  cp: ContractPayment;
  ordinal: number; // 1-based, 헤더 순번 배지
  pending: boolean;
  onSave: (next: ContractPayment) => void;
  onDeleteRequest: () => void;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDate(s: string): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
}

function progressPct(p: string): number {
  if (!p || p === "0%") return 0;
  return parseInt(p, 10);
}

/** 슬롯에 의미있는 데이터가 있는지 (visiblePayments 초기값 계산용). */
function hasSlotData(slot: ContractPayment["수납1"]): boolean {
  return Boolean(
    slot.진행기관 ||
      slot.현황 ||
      slot.수납일 ||
      slot.승인금액 > 0 ||
      slot.수납액 > 0 ||
      (slot.진행률 && slot.진행률 !== "0%"),
  );
}

/** 데이터 기반 초기 visiblePayments — 슬롯3 데이터 있으면 3, 슬롯2 있으면 2, else 1. */
function initialVisiblePayments(cp: ContractPayment): 1 | 2 | 3 {
  if (hasSlotData(cp.수납3)) return 3;
  if (hasSlotData(cp.수납2)) return 2;
  return 1;
}

export default function ContractRow({
  cp,
  ordinal,
  pending,
  onSave,
  onDeleteRequest,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ContractPayment>(cp);
  const [visiblePayments, setVisiblePayments] = useState<1 | 2 | 3>(() =>
    initialVisiblePayments(cp),
  );

  // Scope 2 — 이 계약의 ToDo (계약일|업체명 안정키). 신규 계약(키 미완성)은 비활성.
  const contractRef = cp.계약일 && cp.업체명 ? `${cp.계약일}|${cp.업체명}` : "";
  const todosQuery = useTodosByContract(contractRef);
  const allTodos = todosQuery.data?.todos ?? [];

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

  // 접힘 헤더 sub: 진행 중 기관 (진행률 100% 미만 + 진행기관명 있음).
  // 예: "미소재단(60%)·신용보증재단(40%)" — 카드 한 줄에 truncate.
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

  // 활성 슬롯 인덱스 = 진행률 > 0 인 슬롯 중 가장 큰 인덱스
  const activeSlotIdx = useMemo(() => {
    for (let i = visiblePayments - 1; i >= 0; i--) {
      if (progressPct(visibleSlots[i]?.진행률 ?? "") > 0) return i;
    }
    return -1;
  }, [visibleSlots, visiblePayments]);

  // 좌측 보더 클래스
  const borderClass = isComplete
    ? "border-l-4 border-l-green-500"
    : activeSlotIdx === 0
      ? "border-l-4 border-l-teal-500"
      : activeSlotIdx === 1
        ? "border-l-4 border-l-cyan-500"
        : activeSlotIdx === 2
          ? "border-l-4 border-l-fuchsia-500"
          : "";

  const docBadgeClass =
    docsDone === TOTAL_CHECKBOXES
      ? "text-green-600 bg-green-50"
      : docsDone === 0
        ? "text-gray-400 bg-gray-50"
        : "text-blue-600 bg-blue-50";

  const payBadgeClass =
    avgPct === 0
      ? "text-gray-400 bg-gray-50"
      : avgPct >= 100
        ? "text-green-600 bg-green-50"
        : "text-blue-600 bg-blue-50";

  const handleAddSlot = () => {
    if (visiblePayments < 3) {
      setVisiblePayments((v) => (v + 1) as 1 | 2 | 3);
    }
  };
  const handleRemoveSlot = (slotIdx: 1 | 2 | 3) => {
    if (slotIdx === 1) return; // 슬롯1은 제거 불가
    const emptySlot: ContractPayment["수납1"] = {
      진행기관: "",
      진행률: "",
      현황: "",
      승인금액: 0,
      수납액: 0,
      수납일: "",
      메모: "",
    };
    setDraft((d) => ({ ...d, [`수납${slotIdx}`]: emptySlot }));
    if (slotIdx === visiblePayments) {
      setVisiblePayments((v) => Math.max(1, v - 1) as 1 | 2 | 3);
    }
  };

  return (
    <div
      className={`mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${borderClass}`}
    >
      {/* 헤더 (접힘) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
        style={{ minHeight: 60 }}
        aria-expanded={open}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
          {ordinal}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
            {cp.업체명 || "(업체명 없음)"}
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
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${docBadgeClass}`}
          >
            📋 {docsDone}/{TOTAL_CHECKBOXES}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${payBadgeClass}`}
          >
            💰 {avgPct === 0 ? "—" : `${avgPct}%`}
          </span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
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
      </button>

      {/* 펼침 */}
      {open && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {/* 자동 연동 정보 (read-only) */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1 text-xs text-blue-700">
              <span className="font-medium">🏢 업체정보 (자동 연동)</span>
            </div>
            <div
              className="text-xs text-gray-700"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <span className="font-semibold text-gray-900">{cp.업체명}</span>
              <span className="mx-1.5 text-gray-400">·</span>
              {cp.계약일 || "—"}
              <span className="mx-1.5 text-gray-400">·</span>
              수임비 ₩{fmtMoney(cp.수임비)}
            </div>
          </div>

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
                setDraft((d) => ({ ...d, [key]: next }))
              }
            />
          </div>

          {/* 2026-05-17: 로드맵 메모 — 카드 차원, 슬롯들 위에 위치 */}
          <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
            <label className="mb-1 block text-xs font-semibold text-amber-800">
              📍 로드맵 메모{" "}
              <span className="font-normal text-amber-600/70">
                · 전체 수납기관 진행 로드맵 (시트 AE)
              </span>
            </label>
            <textarea
              rows={2}
              value={draft.로드맵메모}
              onChange={(e) =>
                setDraft((d) => ({ ...d, 로드맵메모: e.target.value }))
              }
              placeholder="예: 1단계 자금 6월말 → 2단계 8월 신청 → ..."
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
                todos={allTodos}
                onChange={(next) => setDraft((d) => ({ ...d, 수납1: next }))}
              />
              {visiblePayments >= 2 && (
                <PaymentSlotForm
                  index={2}
                  slot={draft.수납2}
                  removable={visiblePayments === 2}
                  contractRef={contractRef}
                  companyName={cp.업체명}
                  savedInstitution={cp.수납2.진행기관}
                  todos={allTodos}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, 수납2: next }))
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
                  todos={allTodos}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, 수납3: next }))
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
              onClick={() => onSave(draft)}
              disabled={pending}
              className="h-11 flex-1 rounded-lg bg-blue-500 text-sm font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-700 active:scale-95 disabled:bg-gray-300"
            >
              {pending ? "저장중..." : "💾 저장"}
            </button>
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
