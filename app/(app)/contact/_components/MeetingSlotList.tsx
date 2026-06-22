/** 컨택관리 미팅 슬롯 리스트 (page.tsx 분할). 저장된 미팅 + 미등록 신규 슬롯을 순서대로 렌더. */
import type { Meeting } from "@/types";
import MeetingSlotItem, { type NewSlot } from "./MeetingSlotItem";

export type SlotEntry =
  | { kind: "saved"; meeting: Meeting }
  | { kind: "new"; slot: NewSlot };

interface Props {
  slots: SlotEntry[];
  reservationDate: string;
  onPatchSaved: (id: string, partial: Partial<Omit<Meeting, "id">>) => void;
  onRemoveSaved: (meeting: Meeting) => void;
  onChangeNew: (tempId: string, next: NewSlot) => void;
  onRemoveNew: (tempId: string) => void;
}

export default function MeetingSlotList({
  slots,
  reservationDate,
  onPatchSaved,
  onRemoveSaved,
  onChangeNew,
  onRemoveNew,
}: Props) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-gray-700">
          미팅예약하기
          {slots.length > 0 ? ` · ${slots.length}건` : ""}
        </span>
        <span className="text-xs text-gray-400">컨택성공 1건 = 미팅예약 1건</span>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-6 text-center">
          <div className="text-sm text-gray-400">
            미팅예약을 입력하면
            <br />
            미팅예약 카드가 자동 생성됩니다
          </div>
        </div>
      ) : (
        slots.map((entry, i) =>
          entry.kind === "saved" ? (
            <MeetingSlotItem
              key={entry.meeting.id}
              mode="saved"
              index={i}
              meeting={entry.meeting}
              onPatch={(p) => onPatchSaved(entry.meeting.id, p)}
              onRemove={() => onRemoveSaved(entry.meeting)}
            />
          ) : (
            <MeetingSlotItem
              key={entry.slot.tempId}
              mode="new"
              index={i}
              slot={entry.slot}
              reservationDate={reservationDate}
              onChange={(next) => onChangeNew(entry.slot.tempId, next)}
              onRemove={() => onRemoveNew(entry.slot.tempId)}
            />
          ),
        )
      )}
    </div>
  );
}
