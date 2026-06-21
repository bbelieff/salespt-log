/**
 * 컨택관리 결과 모달 — 미팅 선택삭제(피커).
 * (DB↔생산 불일치/일치 안내는 PR1/ADR-0020 으로 제거: 생산 E 가 DB생산 집계 소유라
 *  컨택값과의 불일치 개념 자체가 없어짐.)
 */
import type { Meeting } from "@/types";
import MeetingPickerModal from "./MeetingPickerModal";

interface Props {
  pickerMeetings: Meeting[] | null;
  onPick: (meeting: Meeting) => void;
  onPickerClose: () => void;
}

export default function ContactResultModals({
  pickerMeetings,
  onPick,
  onPickerClose,
}: Props) {
  if (!pickerMeetings) return null;
  return (
    <MeetingPickerModal
      meetings={pickerMeetings}
      onPick={onPick}
      onClose={onPickerClose}
    />
  );
}
