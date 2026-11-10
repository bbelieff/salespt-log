"use client"; // MeetingResultCard — 일정·계약 탭 미팅 카드 (5상태). 닫힌 카드: 되돌리기/추가미팅.

import DisclosureChevron from '@/components/ui/DisclosureChevron';
import { useId, useRef, useEffect, useState } from "react";
import type { Channel, Meeting, CompanyInfo } from "@/types";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { CHANNEL_BADGE } from "../_lib/badges";
import { useFocusScroll } from "@/lib/hooks/useFocusScroll";
import {
  CARD_CLS,
  ROW_CLS,
  TIME_TEXT_CLS,
  CARD_ICON,
  CARD_LABEL,
  meetingStateToCardState,
} from "../_lib/state-map";
import ContractForm from "./ContractForm";
import DoneForm from "./DoneForm";
import CancelForm from "./CancelForm";
import RescheduleForm from "./RescheduleForm";
import BasicEditDetails from "./BasicEditDetails";
import AddMeetingForm from "./AddMeetingForm";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CarryoverBadge from "@/components/CarryoverBadge";
import { formatWon } from "@/lib/format/money";
import { todayKST } from "@/util/week";
import MapRouteButton from "./MapRouteButton";

type Action = "contract" | "done" | "reschedule" | "cancel" | null;

interface Props {
  meeting: Meeting;
  pending: boolean;
  focus?: boolean; // 캘린더 이동 포커스 — 스크롤 + 3초 하이라이트 링.
  onPatch: (partial: Partial<Omit<Meeting, "id">>, opts?: { quiet?: boolean }) => Promise<void> | void;
  onReschedule: (newDate: string, newTime: string, reason: string) => void;
  onRevert?: () => void;
  onAddMeeting?: (newDate: string, newTime: string) => void;
  onDelete?: () => void;
  hasFollowUp?: boolean;
  onReviveCase?: () => void;
}

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */

export default function MeetingResultCard({
  meeting,
  pending,
  focus,
  onPatch,
  onReschedule,
  onRevert,
  onAddMeeting,
  onDelete,
  hasFollowUp,
  onReviveCase,
}: Props) {
  const state = meetingStateToCardState(meeting.상태);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [editMode, setEditMode] = useState(false);
  useEffect(()=>{if(focus&&new URLSearchParams(window.location.search).get("edit")==="schedule"){setOpen(true);setAction("reschedule");}},[focus]);
  const [addOpen, setAddOpen] = useState(false);
  const [ciDraft, setCiDraft] = useState<CompanyInfo | undefined>(meeting.업체정보);
  const [ciTouched, setCiTouched] = useState(false);
  const withCi = (p: Partial<Omit<Meeting, "id">>) => (ciTouched ? { ...p, 업체정보: ciDraft } : p);

  const { ref: rootRef, ring } = useFocusScroll<HTMLDivElement>(!!focus);

  const isCanceled = state === "canceled";
  const titleCls = isCanceled ? "line-through text-slate-400" : "text-slate-900";
  const timeCls = isCanceled ? "line-through text-slate-400" : TIME_TEXT_CLS[state];
  const placeCls = isCanceled ? "line-through text-slate-400" : "text-slate-500";

  const feeSummary = state === "contract" && meeting.수임비 > 0
    ? <span className="shrink-0 text-xs font-bold text-green-700" style={{ fontVariantNumeric: "tabular-nums" }}>{formatWon(meeting.수임비)}</span>
    : null;

  const pickAction = (a: Exclude<Action, null>) =>
    setAction((cur) => (cur === a ? null : a));

  const closeAfter = () => { setAction(null); setEditMode(false); setOpen(false); setCiTouched(false); };
  const dirtyEntryId = useId();
  const submitRef = useRef<(() => boolean) | null>(null);
  const bindSubmit = (fn: (() => boolean) | null) => { submitRef.current = fn; };
  useDirtyEntry(
    dirtyEntryId,
    action !== null || editMode || ciTouched,
    async () => {
      if (submitRef.current) {
        if (!submitRef.current()) throw new Error("입력을 확인해주세요 — 폼을 완성하면 저장돼요");
        return;
      }
      onPatch({ 업체정보: ciDraft });
      setCiTouched(false);
    },
    closeAfter,
    `${meeting.업체명} · ${CARD_LABEL[state]}`,
  );
  const handleContract = (fee: number, terms: string) => {
    onPatch(withCi({ 상태: "계약", 계약여부: true, 수임비: fee, 계약조건: terms }));
    closeAfter();
  };
  const accumulateReason = (newReason: string): string => {
    const trimmed = newReason.trim();
    const prev = (meeting.미팅사유 ?? "").trim();
    if (!trimmed) return prev;
    if (!prev) return trimmed;
    const round = prev.split("\n").length + 1;
    return `${prev}\n${round}회차: ${trimmed}`;
  };
  const confirmContractDrop = (): boolean => // 계약→완료/취소 시 계약카드 삭제 경고.
    state !== "contract" ||
    window.confirm(`상태를 바꾸면 실무/수납의 계약 1건(${formatWon(meeting.수임비)})이 함께 지워져요.
계속할까요?`);
  const handleDone = (reason: string) => {
    if (!confirmContractDrop()) return;
    onPatch(withCi({ 상태: "완료", 계약여부: false, 미팅사유: accumulateReason(reason) }));
    closeAfter();
  };
  const handleCancel = (reason: string) => {
    if (!confirmContractDrop()) return;
    onPatch(withCi({ 상태: "취소", 계약여부: false, 미팅사유: accumulateReason(reason) }));
    closeAfter();
  };
  const handleReschedule = (d: string, t: string, r: string) => {
    onReschedule(d, t, r);
    setAction(null);
    setOpen(false);
  };

  const showActions = state === "reserved";

  const carried = meeting.구분 === "이월"; // 이월 = 뱃지+점수 미포함 안내 (흐림은 2026-10-08 폐지)
  return (
    <div
      ref={rootRef}
      // 화면 마감 v2(2026-11-10): 닫힘 = 줄 + 아래 구분선, 펼침 = 카드 한 단(상태 색 왼쪽 띠).
      className={`relative scroll-mt-[280px] ${
        open
          ? `my-2 overflow-hidden rounded-xl ${CARD_CLS[state]}`
          : `border-b border-slate-100 last:border-b-0 ${ROW_CLS[state]}`
      } ${ring ? "animate-pulse ring-2 ring-inset ring-blue-400" : ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 py-3 text-left transition-colors active:bg-black/5 ${open ? "px-3" : "px-1"}`}
        aria-expanded={open}
      >
        <CarryoverBadge 구분={meeting.구분} />
        <span className="shrink-0 text-base leading-none">
          {CARD_ICON[state]}
        </span>
        <span className={`shrink-0 text-sm font-bold ${timeCls}`}>
          {meeting.미팅시간}
        </span>
        <span className={`shrink-0 ${CHANNEL_BADGE[meeting.channel]}`}>
          {meeting.channel}
        </span>
        {/* 업체명 먼저 — 좁은 화면(폴드 커버)에서는 장소가 아랫줄로(2026-11-07). */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <span className={`line-clamp-2 min-w-0 max-w-full break-keep text-sm font-semibold ${titleCls}`}>{meeting.업체명}</span>
          {meeting.장소 && <span className={`ml-auto min-w-0 max-w-full truncate text-xs ${placeCls}`}>{meeting.장소}</span>}
        </span>
        {feeSummary}
        <DisclosureChevron open={open} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200/60 px-3 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">📅 예약일 <b className="text-slate-800">{meeting.예약일 || "—"}</b></span>
            <span className="text-slate-400">현재상태: <b className="text-slate-700">{CARD_LABEL[state]}</b></span>
          </div>
          {/* 🧭 길찾기(2026-11-07 belie) — 장소가 주소가 아니면 업체 소재지로. 검색어가 없으면 안 보임. */}
          <MapRouteButton place={meeting.장소} address={meeting.업체정보?.소재지} />

          <CarryoverBadge 구분={meeting.구분} variant="note" />
          <CompanyInfoEditor key={meeting.id} value={meeting.업체정보} busy={pending} txtCompanyName={meeting.업체명} identityKey={meeting.id} vaultTarget={{ meetingId: meeting.id }} hideSave onChange={(ci) => { setCiDraft(ci); setCiTouched(true); }} onSave={(ci) => onPatch({ 업체정보: ci })} />

          {state !== "reserved" && (state === "contract" || meeting.미팅사유) && !editMode && (
            <div className="border-t border-slate-200/60 pt-2 text-xs">
              {state === "contract" && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-500">
                      수임비:{" "}
                      <b
                        className="text-green-700"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatWon(meeting.수임비)}
                      </b>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="shrink-0 rounded-md border border-green-300 bg-white px-2 py-0.5 text-px-11 font-medium text-green-700 hover:bg-green-50"
                    >
                      ✏️ 수정
                    </button>
                  </div>
                  {meeting.계약조건 && (
                    <div className="mt-0.5 text-slate-600">
                      조건: {meeting.계약조건}
                    </div>
                  )}
                </>
              )}
              {(state === "done" || state === "canceled") && meeting.미팅사유 && (
                <div className="whitespace-pre-wrap text-slate-600">
                  사유: {meeting.미팅사유}
                </div>
              )}
            </div>
          )}

          {state === "contract" && editMode && (
            <div className="space-y-2">
              <ContractForm
                initialFee={meeting.수임비}
                initialTerms={meeting.계약조건}
                onConfirm={handleContract}
                pending={pending}
                bindSubmit={bindSubmit}
              />
              <div className="border-t border-slate-200/60 pt-3">
                <div className="mb-2 text-xs font-medium text-slate-600">
                  상태 변경 (취소·환수·보류 등은 취소로 사유와 함께 기록)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton
                    label="🟠 완료로"
                    hint="(계약 해지)"
                    active={action === "done"}
                    activeCls="bg-orange-500 text-white shadow-md ring-2 ring-orange-300"
                    idleCls="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                    onClick={() => pickAction("done")}
                  />
                  <ActionButton
                    label="🔴 취소로"
                    hint="(보류·환수)"
                    active={action === "cancel"}
                    activeCls="bg-red-500 text-white shadow-md ring-2 ring-red-300"
                    idleCls="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    onClick={() => pickAction("cancel")}
                  />
                </div>
                {action === "done" && (
                  <div className="mt-2">
                    <DoneForm
                      initialReason={meeting.미팅사유}
                      vendor={meeting.업체명}
                      onConfirm={handleDone}
                      pending={pending}
                      bindSubmit={bindSubmit}
                    />
                  </div>
                )}
                {action === "cancel" && (
                  <div className="mt-2">
                    <CancelForm
                      initialReason={meeting.미팅사유}
                      vendor={meeting.업체명}
                      onConfirm={handleCancel}
                      pending={pending}
                      bindSubmit={bindSubmit}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setEditMode(false); setAction(null); }}
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                ↩ 수정 취소
              </button>
            </div>
          )}

          {showActions && (
            <BasicEditDetails
              targetKey={meeting.id}
              initial={{
                미팅날짜: meeting.미팅날짜,
                미팅시간: meeting.미팅시간,
                업체명: meeting.업체명,
                장소: meeting.장소,
                예약비고: meeting.예약비고,
              }}
              onSave={(partial) => {
                const r = onPatch(withCi(partial), { quiet: true });
                setCiTouched(false);
                return r;
              }}
              onDelete={onDelete}
              pending={pending}
            />
          )}

          {showActions && (
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
                active={action === "reschedule"}
                activeCls="bg-purple-500 text-white shadow-md ring-2 ring-purple-300"
                idleCls="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                onClick={() => pickAction("reschedule")}
              />
              <ActionButton
                label="🔴 취소"
                active={action === "cancel"}
                activeCls="bg-red-500 text-white shadow-md ring-2 ring-red-300"
                idleCls="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                onClick={() => pickAction("cancel")}
              />
            </div>
          )}

          {showActions && action === "contract" && (
            <ContractForm
              initialFee={meeting.수임비}
              initialTerms={meeting.계약조건}
              onConfirm={handleContract}
              pending={pending}
              bindSubmit={bindSubmit}
            />
          )}
          {showActions && action === "done" && (
            <DoneForm
              initialReason={meeting.미팅사유}
              vendor={meeting.업체명}
              onConfirm={handleDone}
              pending={pending}
              bindSubmit={bindSubmit}
            />
          )}
          {showActions && action === "reschedule" && (
            <RescheduleForm
              initialDate={meeting.미팅날짜}
              initialTime={meeting.미팅시간}
              vendor={meeting.업체명}
              onConfirm={handleReschedule}
              pending={pending}
              bindSubmit={bindSubmit}
            />
          )}
          {showActions && action === "cancel" && (
            <CancelForm
              initialReason={meeting.미팅사유}
              vendor={meeting.업체명}
              onConfirm={handleCancel}
              pending={pending}
              bindSubmit={bindSubmit}
            />
          )}

          {!showActions && onRevert && state !== "rescheduled" && (
            <button
              type="button"
              onClick={() => {
                const label =
                  state === "contract"
                    ? "계약 → 예약 (수임비·조건이 비워지고, 실무/수납의 계약도 함께 지워져요)"
                    : state === "done"
                      ? "완료 → 예약 (적어 둔 사유가 비워져요)"
                      : "취소 → 예약 (적어 둔 사유가 비워져요)";
                if (window.confirm(`미팅 결과를 되돌릴까요?\n\n${label}`)) {
                  onRevert();
                }
              }}
              disabled={pending}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              ↩️ 미팅 결과 되돌리기
            </button>
          )}
          {!showActions && onRevert && state === "rescheduled" && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "일정 변경을 되돌릴까요?\n\n변경 → 예약 (변경으로 생긴 새 미팅 카드 삭제)",
                  )
                ) {
                  onRevert();
                }
              }}
              disabled={pending}
              className="w-full rounded-md border border-purple-300 bg-white py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            >
              ↩️ 일정 변경 되돌리기 (새 미팅 삭제)
            </button>
          )}

          {!showActions && hasFollowUp && (state === "done" || state === "canceled" || state === "contract") && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-2 text-xs text-slate-600">
              <span>🔚 케이스 종료 — 추가 미팅 카드에서 진행</span>
              {onReviveCase && (
                <button type="button" onClick={onReviveCase} disabled={pending} className="shrink-0 rounded border border-slate-300 bg-white px-2 py-0.5 text-px-11 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">↩️ 되살리기</button>
              )}
            </div>
          )}

          {!showActions &&
            onAddMeeting &&
            !hasFollowUp &&
            (state === "done" || state === "canceled" || state === "contract") && (
              <>
                {!addOpen && (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    disabled={pending}
                    className="w-full rounded-md border border-blue-300 bg-white py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    ➕ 추가 미팅 잡기 (같은 업체)
                  </button>
                )}
                {addOpen && (
                  <AddMeetingForm
                    vendor={meeting.업체명.replace(/^\(변경\)\s*/, "")}
                    defaultDate={todayKST()}
                    minDate={meeting.미팅날짜}
                    onConfirm={(d2, t2) => {
                      onAddMeeting(d2, t2);
                      setAddOpen(false);
                    }}
                    onCancel={() => setAddOpen(false)}
                    pending={pending}
                  />
                )}
              </>
            )}

          {!showActions && state === "rescheduled" && (
            <div className="border-t border-purple-200 pt-2 text-xs text-purple-700">
              📅 일정이 변경되었습니다. 새 일정의 카드를 확인하세요.
              {meeting.미팅사유 && (
                <div className="mt-0.5 whitespace-pre-wrap text-slate-600">
                  사유: {meeting.미팅사유}
                </div>
              )}
            </div>
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
