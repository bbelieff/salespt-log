/**
 * MeetingResultCard — 일정·계약 탭 미팅 카드 (5상태).
 * 정본: docs/design/prototypes/schedule-weekly.html
 *
 * Phase 1: 계약/완료/취소 인라인 액션. 변경 버튼은 disabled (Phase 2).
 *
 * 헤더(접힘 시): 상태아이콘 시간 업체명 장소 [수임비요약] ▼
 * 펼침: 채널 배지 + 4-action 버튼 + (선택된 액션의) 인라인 폼
 */
"use client";

import { useState } from "react";
import type { Channel, Meeting } from "@/types";
import {
  CARD_CLS,
  CARD_ICON,
  CARD_LABEL,
  meetingStateToCardState,
} from "../_lib/state-map";
import ContractForm from "./ContractForm";
import DoneForm from "./DoneForm";
import CancelForm from "./CancelForm";

const CHANNEL_BADGE: Record<Channel, string> = {
  매입DB: "badge badge-purchase",
  직접생산: "badge badge-direct",
  현수막: "badge badge-banner",
  "콜·지·기·소": "badge badge-referral",
};

type Action = "contract" | "done" | "cancel" | null;

interface Props {
  meeting: Meeting;
  pending: boolean;
  onPatch: (partial: Partial<Omit<Meeting, "id">>) => void;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function MeetingResultCard({ meeting, pending, onPatch }: Props) {
  const state = meetingStateToCardState(meeting.상태);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>(null);

  const isCanceled = state === "canceled";
  const titleCls = isCanceled
    ? "line-through text-gray-400"
    : "text-gray-900";
  const timeCls = isCanceled ? "line-through text-gray-400" : "text-gray-700";
  const placeCls = isCanceled
    ? "line-through text-gray-400"
    : "text-gray-500";

  const feeSummary =
    state === "contract" && meeting.수임비 > 0 ? (
      <span className="shrink-0 text-xs font-bold text-green-700">
        {fmtMoney(meeting.수임비)}만원
      </span>
    ) : null;

  // 액션 버튼 — 토글: 같은 액션 클릭 시 닫힘
  const pickAction = (a: Exclude<Action, null>) =>
    setAction((cur) => (cur === a ? null : a));

  // 패치 헬퍼들
  const handleContract = (fee: number, terms: string) => {
    onPatch({
      상태: "계약",
      계약여부: true,
      수임비: fee,
      계약조건: terms,
    });
    setAction(null);
    setOpen(false);
  };
  const handleDone = (reason: string) => {
    onPatch({
      상태: "완료",
      계약여부: false,
      미팅사유: reason,
    });
    setAction(null);
    setOpen(false);
  };
  const handleCancel = (reason: string) => {
    onPatch({
      상태: "취소",
      계약여부: false,
      미팅사유: reason,
    });
    setAction(null);
    setOpen(false);
  };

  return (
    <div
      className={`relative ml-4 mb-2 overflow-hidden rounded-xl shadow-sm ${CARD_CLS[state]}`}
    >
      {/* 가지선 (day-section과 카드 연결) */}
      <span className="absolute -left-2 top-1/2 h-px w-2 -translate-y-1/2 border-t-2 border-gray-200" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors active:bg-black/5"
        aria-expanded={open}
      >
        <span className="shrink-0 text-base leading-none">
          {CARD_ICON[state]}
        </span>
        <span className={`shrink-0 text-sm font-bold ${timeCls}`}>
          {meeting.미팅시간}
        </span>
        <span className={`flex-1 truncate text-sm font-semibold ${titleCls}`}>
          {meeting.업체명}
        </span>
        <span
          className={`max-w-20 shrink-0 truncate text-xs ${placeCls}`}
        >
          {meeting.장소}
        </span>
        {feeSummary}
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

      {open && (
        <div className="space-y-3 border-t border-gray-200/60 px-3 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className={`shrink-0 ${CHANNEL_BADGE[meeting.channel]}`}>
              {meeting.channel}
            </span>
            <span className="text-gray-400">
              현재상태: <b className="text-gray-700">{CARD_LABEL[state]}</b>
            </span>
          </div>

          {/* 결과 정보 (이미 처리된 카드에 한해 표시) */}
          {state !== "reserved" && (state === "contract" || meeting.미팅사유) && (
            <div className="rounded-lg border border-gray-200 bg-white/60 px-2.5 py-1.5 text-xs">
              {state === "contract" && (
                <>
                  <div className="text-gray-500">
                    수임비:{" "}
                    <b className="text-green-700">
                      {fmtMoney(meeting.수임비)}만원
                    </b>
                  </div>
                  {meeting.계약조건 && (
                    <div className="mt-0.5 text-gray-600">
                      조건: {meeting.계약조건}
                    </div>
                  )}
                </>
              )}
              {(state === "done" || state === "canceled") && meeting.미팅사유 && (
                <div className="text-gray-600">사유: {meeting.미팅사유}</div>
              )}
            </div>
          )}

          {/* 4-action 버튼 그리드 (변경은 Phase 2 — disabled) */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <ActionButton
              label="💵 계약"
              active={action === "contract"}
              activeCls="bg-green-600 text-white shadow-md ring-2 ring-green-300"
              idleCls="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
              onClick={() => pickAction("contract")}
            />
            <ActionButton
              label="🟠 완료"
              hint="(계약X)"
              active={action === "done"}
              activeCls="bg-orange-500 text-white shadow-md ring-2 ring-orange-300"
              idleCls="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
              onClick={() => pickAction("done")}
            />
            <ActionButton
              label="📅 변경"
              hint="(Phase 2)"
              active={false}
              activeCls=""
              idleCls="bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              disabled
            />
            <ActionButton
              label="🔴 취소"
              active={action === "cancel"}
              activeCls="bg-red-500 text-white shadow-md ring-2 ring-red-300"
              idleCls="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
              onClick={() => pickAction("cancel")}
            />
          </div>

          {action === "contract" && (
            <ContractForm
              initialFee={meeting.수임비}
              initialTerms={meeting.계약조건}
              onConfirm={handleContract}
              pending={pending}
            />
          )}
          {action === "done" && (
            <DoneForm
              initialReason={meeting.미팅사유}
              vendor={meeting.업체명}
              onConfirm={handleDone}
              pending={pending}
            />
          )}
          {action === "cancel" && (
            <CancelForm
              initialReason={meeting.미팅사유}
              vendor={meeting.업체명}
              onConfirm={handleCancel}
              pending={pending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  hint,
  active,
  activeCls,
  idleCls,
  onClick,
  disabled,
}: {
  label: string;
  hint?: string;
  active: boolean;
  activeCls: string;
  idleCls: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg py-2.5 text-sm font-bold transition-all ${
        active ? activeCls : idleCls
      }`}
    >
      {label}
      {hint && <span className="ml-1 text-xs font-normal">{hint}</span>}
    </button>
  );
}
