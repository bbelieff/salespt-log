/**
 * MeetingSlotItem — 미팅 슬롯 카드 (1줄 접힘 ↔ 펼침).
 * 정본: docs/design/prototypes/contact-daily-input.html (v7) §3 미팅 카드
 *
 * 두 모드:
 *   - 신규(saved=false): 강제 펼침 + [등록] [삭제]
 *   - 등록완료(saved=true): 한 줄 접힘 + 클릭 펼침 + [수정 완료] [삭제]
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, Meeting } from "@/types";
import DateInputCustom from "@/components/ui/DateInputCustom";
import TimeSelectPair from "@/components/ui/TimeSelectPair";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import type { CompanyInfo } from "@/types";
import { ConfirmLeaveModal } from "./MeetingDirtyGuard";
import { useDirtyRegister } from "@/components/DirtyGuard";

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
}

interface SavedProps {
  mode: "saved";
  index: number;
  meeting: Meeting;
  onPatch: (partial: Partial<Omit<Meeting, "id">>) => void | Promise<void>;
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
}: NewProps) {
  const channel = slot.channel;
  const collapsedTime = slot.미팅시간 || "—:—";
  const collapsedCompany = slot.업체명 || "(업체 미입력)";
  const collapsedPlace = slot.장소 || "";

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
        <DateTimeRow
          미팅날짜={slot.미팅날짜}
          미팅시간={slot.미팅시간}
          onDate={(v) => onChange({ ...slot, 미팅날짜: v })}
          onTime={(v) => onChange({ ...slot, 미팅시간: v })}
        />
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
        {/* 업체정보 — 슬롯 메모리(onChange)에만 반영, 맨 아래 [저장하기]가 등록 시 함께 기록(04 T~AS). */}
        <CompanyInfoEditor
          value={slot.업체정보}
          hideSave
          onChange={(ci) => onChange({ ...slot, 업체정보: ci })}
          onSave={(ci) => onChange({ ...slot, 업체정보: ci })}
        />
        <Actions
          onRemove={onRemove}
          hint="입력 후 맨 아래 [저장하기]로 등록돼요 · 삭제 시 미팅예약 -1"
        />
      </div>
    </div>
  );
}

// ── 등록완료 슬롯 ────────────────────────────────────────────
function SavedItem({ index, meeting, onPatch, onRemove }: SavedProps) {
  const [open, setOpen] = useState(false);
  // 예약비고 자리는 업체정보(CompanyInfoEditor)로 교체 (consultation-log §3-1).
  // 기존 예약비고 값은 partial patch 라 보존됨(일정·계약 탭에서 계속 편집 가능).
  const [draft, setDraft] = useState({
    미팅날짜: meeting.미팅날짜,
    미팅시간: meeting.미팅시간,
    업체명: meeting.업체명,
    장소: meeting.장소,
  });
  // 업체정보 라이브 드래프트 — CompanyInfoEditor onChange 로 동기화, 파란 저장이 함께 영속화.
  const [ciDraft, setCiDraft] = useState<CompanyInfo | undefined>(
    meeting.업체정보,
  );
  const [ciTouched, setCiTouched] = useState(false); // 업체정보가 편집됐는가
  const [confirmCollapse, setConfirmCollapse] = useState(false);

  const meetingDirty =
    draft.미팅날짜 !== meeting.미팅날짜 ||
    draft.미팅시간 !== meeting.미팅시간 ||
    draft.업체명 !== meeting.업체명 ||
    draft.장소 !== meeting.장소;
  const dirty = meetingDirty || ciTouched;

  // 파란 '수정 완료' — 미팅 + (편집된) 업체정보를 한 patch 로 원자 저장(04/06 동시).
  // 부분 실패 시 handlePatchSavedMeeting 가 "수정 실패" 토스트로 표시.
  const saveAll = async () => {
    await onPatch({
      ...draft,
      ...(ciTouched ? { 업체정보: ciDraft } : {}),
    });
    setCiTouched(false);
  };
  // 무시(버리기) — 편집을 저장본으로 되돌림. CompanyInfoEditor 는 접힘 시 언마운트돼
  // 다음 펼침에서 meeting.업체정보 로 재초기화되므로 ciTouched 만 리셋하면 된다.
  const discardAll = () => {
    setDraft({
      미팅날짜: meeting.미팅날짜,
      미팅시간: meeting.미팅시간,
      업체명: meeting.업체명,
      장소: meeting.장소,
    });
    setCiDraft(meeting.업체정보);
    setCiTouched(false);
  };

  // 전역 dirty 레지스트리 등록(탭/날짜/주차·카드접기 이탈 가드 + 브라우저 닫기) — 최신 콜백 ref.
  const register = useDirtyRegister();
  const saveRef = useRef(saveAll);
  saveRef.current = saveAll;
  const discardRef = useRef(discardAll);
  discardRef.current = discardAll;
  useEffect(() => {
    register(
      meeting.id,
      dirty
        ? {
            save: () => saveRef.current(),
            discard: () => discardRef.current(),
            label: `미팅 ${meeting.업체명 || "(미입력)"}`,
          }
        : null,
    );
    return () => register(meeting.id, null);
  }, [dirty, meeting.id, meeting.업체명, register]);

  // 헤더 토글 — 펼침 상태에서 dirty 면 접기 전에 확인.
  const handleToggle = () => {
    if (open && dirty) {
      setConfirmCollapse(true);
      return;
    }
    setOpen((v) => !v);
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
        onClick={handleToggle}
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
          <ExpandHeader saved reservationDate={meeting.예약일} />
          <DateTimeRow
            미팅날짜={draft.미팅날짜}
            미팅시간={draft.미팅시간}
            onDate={(v) => setDraft((d) => ({ ...d, 미팅날짜: v }))}
            onTime={(v) => setDraft((d) => ({ ...d, 미팅시간: v }))}
          />
          <FieldText
            label="업체명"
            value={draft.업체명}
            onChange={(v) => setDraft((d) => ({ ...d, 업체명: v }))}
          />
          <FieldText
            label="장소"
            value={draft.장소}
            onChange={(v) => setDraft((d) => ({ ...d, 장소: v }))}
          />
          {/* 업체정보는 아래 파란 '수정 완료'로 함께 저장됨 → 자체 저장버튼 숨김(hideSave).
              onChange 로 라이브 드래프트만 부모에 전달. (모달 '저장'은 즉시 저장 보조 경로) */}
          <CompanyInfoEditor
            value={meeting.업체정보}
            txtCompanyName={meeting.업체명}
            hideSave
            onChange={(ci) => {
              setCiDraft(ci);
              setCiTouched(true);
            }}
            onSave={(ci) => {
              onPatch({ 업체정보: ci });
              setCiDraft(ci);
              setCiTouched(false);
            }}
          />
          <Actions
            onRemove={onRemove}
            hint="수정·업체정보는 맨 아래 [저장하기]로 함께 저장됩니다"
          />
        </div>
      )}

      {confirmCollapse && (
        <ConfirmLeaveModal
          onSave={() => {
            void saveAll();
            setConfirmCollapse(false);
            setOpen(false);
          }}
          onDiscard={() => {
            discardAll();
            setConfirmCollapse(false);
            setOpen(false);
          }}
          onCancel={() => setConfirmCollapse(false)}
        />
      )}
    </div>
  );
}

// ── 공용 sub ────────────────────────────────────────────────
function ExpandHeader({
  saved,
  reservationDate,
}: {
  saved: boolean;
  reservationDate: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-gray-400">
      <span>예약생성 {reservationDate}</span>
      {saved ? (
        <span className="font-semibold text-blue-600">✓ 등록됨</span>
      ) : (
        <span className="font-semibold text-amber-600">신규 입력</span>
      )}
    </div>
  );
}

function DateTimeRow({
  미팅날짜,
  미팅시간,
  onDate,
  onTime,
}: {
  미팅날짜: string;
  미팅시간: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-xs text-gray-500">미팅 일정</label>
        <DateInputCustom
          value={미팅날짜}
          onChange={onDate}
          ariaLabel="미팅 일정"
        />
      </div>
      <div className="shrink-0" style={{ width: 140 }}>
        <label className="mb-1 block text-xs text-gray-500">시간</label>
        <TimeSelectPair
          value={미팅시간}
          onChange={onTime}
          ariaLabel="미팅 시간"
        />
      </div>
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      <input
        type="text"
        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-600">
        <span>📝 예약비고</span>
        <span className="font-normal text-gray-400">· 미팅 전 준비정보</span>
      </label>
      <textarea
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        placeholder="예: 사장님 부재 시간, 지참서류"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Actions({
  primaryLabel,
  onPrimary,
  onRemove,
  hint,
}: {
  primaryLabel?: string;
  onPrimary?: () => void;
  onRemove: () => void;
  hint: string;
}) {
  return (
    <>
      <div className="flex gap-2 pt-1">
        {primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-600"
          >
            {primaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
        >
          ✕ 삭제
        </button>
      </div>
      <div className="text-center text-xs text-gray-400">{hint}</div>
    </>
  );
}
