/**
 * MeetingSlotItem — 미팅 슬롯 카드 (1줄 접힘 ↔ 펼침).
 * 정본: docs/design/prototypes/contact-daily-input.html (v7) §3 미팅 카드
 *
 * 두 모드:
 *   - 신규: 강제 펼침 + 드래프트당 ONE [예약 등록] (idempotent, 실패 시 유지·재시도)
 *   - 등록완료: 한 줄 접힘 + 클릭 펼침 + 편집 자동 저장 (수정 완료 버튼 없음)
 */
"use client";

import { useEffect, useState } from "react";
import type { Channel, DBLead, Meeting } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import type { CompanyInfo } from "@/types";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { discardUnsaved } from "@/components/weekly-goals/weeklyGoalAutosave";
import { isSameDayMeeting } from "../_lib/metrics-autosave";
import { mergePick, type PickMerged } from "../_lib/lead-pick";
import LeadPickerModal from "./LeadPickerModal";
import {
  Actions,
  DateTimeRow,
  ExpandHeader,
  FieldNote,
  FieldText,
} from "./MeetingSlotForm";

const CHANNEL_BADGE: Record<Channel, string> = {
  매입DB: "badge badge-purchase",
  직접생산: "badge badge-direct",
  현수막: "badge badge-banner",
  "콜·지·기·소": "badge badge-referral",
};

export interface NewSlot {
  tempId: string;
  channel: Channel;
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
  장소: string;
  예약비고: string;
  /** 등록 전 in-memory 업체정보. 등록 시 Meeting 에 포함돼 04 로 append (3-1). */
  업체정보?: CompanyInfo;
}

interface NewProps {
  mode: "new";
  index: number;
  slot: NewSlot;
  reservationDate: string;
  onChange: (next: NewSlot) => void;
  onRemove: () => void;
  /** Per-draft semantic register — stable tempId, single-flight, idempotent retry. */
  onRegister: (tempId: string) => void;
  registering: boolean;
  registerError: string;
}

interface SavedProps {
  mode: "saved";
  index: number;
  meeting: Meeting;
  reservationDate: string;
  onPatch: (id: string, partial: Partial<Omit<Meeting, "id">>, date: string) => Promise<unknown>;
  onRemove: () => void;
}

type Props = NewProps | SavedProps;

export default function MeetingSlotItem(props: Props) {
  if (props.mode === "new") return <NewItem {...props} />;
  return <SavedItem {...props} />;
}

// ── 신규 슬롯 ─────────────────────────────────────────────────
function NewItem({
  index,
  slot,
  reservationDate,
  onChange,
  onRemove,
  onRegister,
  registering,
  registerError,
}: NewProps) {
  const channel = slot.channel;
  const collapsedTime = slot.미팅시간 || "—:—";
  const collapsedCompany = slot.업체명 || "(업체 미입력)";
  const collapsedPlace = slot.장소 || "";
  const isLead = channel === "콜·지·기·소";

  // 발굴 피커 상태. baseline = 프리필 직전 원본 스냅샷(R7: 발굴 교체 시 A+B 혼합 방지 —
  // 매 선택을 baseline 에 재병합해 A 값이 아닌 사용자 원본에서만 채운다). ciKey = R8 리마운트.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [baseline, setBaseline] = useState<NewSlot | null>(null);
  const [lastMerge, setLastMerge] = useState<PickMerged | null>(null);
  const [ciKey, setCiKey] = useState(0);

  const onPickLead = (lead: DBLead) => {
    const origin = baseline ?? slot;
    if (!baseline) setBaseline(origin);
    // mergePick: R7(혼합 금지) + §2.5(pick 후 손입력 보존) 동시 충족. 상세 = _lib/lead-pick.ts.
    const m = mergePick(origin, slot, lastMerge, lead);
    onChange({ ...slot, 업체명: m.업체명, 예약비고: m.예약비고, 업체정보: m.업체정보 });
    setLastMerge(m);
    setCiKey((k) => k + 1); // CompanyInfoEditor 리마운트(mount 시 1회 초기화 — 주입값 반영)
    setPickerOpen(false);
  };

  return (
    <div className="mb-2 overflow-hidden rounded-xl border-l-4 border-gray-300 bg-white shadow-sm">
      {/* 2단 헤더 (신규는 항상 펼침) — 1행 메타, 2행 업체명 풀폭·장소 */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-bold text-gray-400">#{index + 1}</span>
          <span className={`shrink-0 ${CHANNEL_BADGE[channel]}`}>{channel}</span>
          <span className="shrink-0 text-base leading-none">⚪</span>
          <span className="shrink-0 text-sm font-bold text-gray-700">{collapsedTime}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
            {collapsedCompany}
          </span>
          <span className="shrink-0 truncate text-xs text-gray-500">{collapsedPlace}</span>
        </div>
      </div>

      {/* 펼침 본문 */}
      <div className="space-y-3 border-t border-gray-200 px-3 py-3">
        <ExpandHeader saved={false} reservationDate={reservationDate} />
        {/* 콜·지·기·소: 03 발굴에서 프리필(선택 사항 — 안 쓰면 기존과 100% 동일). lead-chain §2-1. */}
        {isLead && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
          >
            📥 발굴에서 가져오기
          </button>
        )}
        <DateTimeRow
          미팅날짜={slot.미팅날짜}
          미팅시간={slot.미팅시간}
          onDate={(v) => onChange({ ...slot, 미팅날짜: v })}
          onTime={(v) => onChange({ ...slot, 미팅시간: v })}
        />
        {isSameDayMeeting(reservationDate, slot.미팅날짜) && (
          <p role="note" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            기록 날짜와 미팅 날짜가 같아요. 당일 미팅이 맞는지 확인해 주세요.
          </p>
        )}
        <FieldText
          label="업체명"
          placeholder="예: ○○부동산"
          value={slot.업체명}
          onChange={(v) => onChange({ ...slot, 업체명: v })}
        />
        <FieldText
          label="장소"
          placeholder="예: 잠실"
          value={slot.장소}
          onChange={(v) => onChange({ ...slot, 장소: v })}
        />
        {/* 콜·지·기·소: 발굴 프리필의 조건/구분이 예약비고로 오므로 확인·수정할 수 있게 노출. */}
        {isLead && (
          <FieldNote
            value={slot.예약비고}
            onChange={(v) => onChange({ ...slot, 예약비고: v })}
          />
        )}
        {/* 업체정보 — 슬롯 메모리(onChange)에만 반영, [예약 등록]이 함께 기록(04 T~AS).
            key: 발굴 프리필 주입 리마운트(ciKey, R8) + 슬롯별 분리(tempId).
            identityKey=tempId: 업체명(개명 가능한 표시명)은 신원이 될 수 없다. */}
        <CompanyInfoEditor
          key={`new-${slot.tempId}-${ciKey}`}
          identityKey={slot.tempId}
          value={slot.업체정보}
          hideSave
          onChange={(ci) => onChange({ ...slot, 업체정보: ci })}
          onSave={(ci) => onChange({ ...slot, 업체정보: ci })}
        />
        {registerError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{registerError}</p>}
        <Actions
          primaryLabel={registering ? "등록 중…" : registerError ? "다시 등록" : "예약 등록"}
          onPrimary={() => onRegister(slot.tempId)}
          primaryDisabled={registering}
          onRemove={onRemove}
          hint="실패해도 입력은 그대로 남아요 · 삭제 시 미팅예약 -1"
        />
      </div>
      {pickerOpen && (
        <LeadPickerModal onPick={onPickLead} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// ── 등록완료 슬롯 (편집 자동 저장) ─────────────────────────────
interface MeetingDraft {
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
  장소: string;
  업체정보?: CompanyInfo;
}

const toDraft = (m: Meeting): MeetingDraft => ({
  미팅날짜: m.미팅날짜,
  미팅시간: m.미팅시간,
  업체명: m.업체명,
  장소: m.장소,
  업체정보: m.업체정보,
});

function SavedItem({ index, meeting, reservationDate, onPatch, onRemove }: SavedProps) {
  const [open, setOpen] = useState(false);
  const auto = useAutosave<MeetingDraft>({
    target: { kind: "contact-meeting", date: reservationDate, id: meeting.id },
    initial: toDraft(meeting),
    delayMs: 1000,
    save: ({ target, payload }) => onPatch(meeting.id, payload, target.date as string),
  });

  // 서버 리패치 병합 — unsent 편집은 유지, 깨끗할 때만 기준 이동.
  const meetingKey = JSON.stringify(toDraft(meeting));
  useEffect(() => {
    auto.syncServer(toDraft(meeting));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingKey]);

  useDirtyEntry(meeting.id, auto.dirty,
    () => auto.flush(),
    () => discardUnsaved(auto), // leave-without-save; F2 core discard() auto-used when present
    `미팅 ${meeting.업체명 || "(미입력)"}`);

  // 업체정보는 CompanyInfoEditor 인터페이스 그대로(hideSave + onChange/onSave).
  const setCi = (ci: CompanyInfo | undefined, immediate: boolean) => {
    auto.update({ ...auto.draft, 업체정보: ci });
    if (immediate) void auto.flush();
  };

  const collapsedTime = meeting.미팅시간 || "—:—";
  // 미팅날짜를 "M/d" 형식으로 (예약일이 다를 때 시각 정보 부족 방지)
  const collapsedDate = (() => {
    if (!meeting.미팅날짜) return "";
    const m = meeting.미팅날짜.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!m) return meeting.미팅날짜;
    return `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}`;
  })();

  return (
    <div className="mb-2 overflow-hidden rounded-xl border-l-4 border-blue-400 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors active:bg-black/5"
        aria-expanded={open}
      >
        {/* 2단: 1행 메타(#·채널·날짜·시간), 2행 업체명 풀폭·장소 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-bold text-gray-400">#{index + 1}</span>
            <span className={`shrink-0 ${CHANNEL_BADGE[meeting.channel]}`}>
              {meeting.channel}
            </span>
            <span className="shrink-0 text-base leading-none">🔵</span>
            <span className="shrink-0 text-xs font-semibold text-gray-500">{collapsedDate}</span>
            <span className="shrink-0 text-sm font-bold text-gray-700">{collapsedTime}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
              {meeting.업체명 || "(업체 미입력)"}
            </span>
            <span className="shrink-0 truncate text-xs text-gray-500">{meeting.장소}</span>
          </div>
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

      {open && (
        <div className="space-y-3 border-t border-gray-200 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <ExpandHeader saved reservationDate={meeting.예약일} />
            <AutosaveStatus status={auto.status} error={auto.error}
              savedAt={auto.savedAt} onRetry={auto.retry} />
          </div>
          <DateTimeRow
            미팅날짜={auto.draft.미팅날짜}
            미팅시간={auto.draft.미팅시간}
            onDate={(v) => auto.stage({ ...auto.draft, 미팅날짜: v })}
            onTime={(v) => auto.stage({ ...auto.draft, 미팅시간: v })}
            onBlurGroup={() => auto.commit()}
          />
          <FieldText
            label="업체명"
            value={auto.draft.업체명}
            onChange={(v) => auto.update({ ...auto.draft, 업체명: v })}
          />
          <FieldText
            label="장소"
            value={auto.draft.장소}
            onChange={(v) => auto.update({ ...auto.draft, 장소: v })}
          />
          {/* 업체정보는 자동 저장에 포함된다. 모달 '저장'은 즉시 확정 보조 경로.
              identityKey=meeting.id: 업체명(txtCompanyName)은 개명 가능한 표시명이라
              신원으로 쓰면 빠른 전환·개명 때 다른 레코드로 전송된다. */}
          <CompanyInfoEditor
            key={meeting.id}
            identityKey={meeting.id}
            value={meeting.업체정보}
            txtCompanyName={meeting.업체명}
            hideSave
            onChange={(ci) => setCi(ci, false)}
            onSave={(ci) => setCi(ci, true)}
          />
          <Actions
            onRemove={onRemove}
            hint="수정은 자동 저장돼요 · 삭제·옮기기는 확인 후 따로 실행"
          />
        </div>
      )}
    </div>
  );
}
