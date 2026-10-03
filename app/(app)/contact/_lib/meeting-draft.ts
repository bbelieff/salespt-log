/**
 * New-meeting draft builders — pure (moved from use-contact-save.ts; the
 * unified manual-save hook is gone, replaced by split autosave + per-draft
 * 예약 등록). Imported by page.tsx and use-record-move.ts.
 */
import type { Meeting } from "@/types";
import type { NewSlot } from "../_components/MeetingSlotItem";
import { missingSlotFields } from "./slot-validation";

export function slotComplete(s: NewSlot): boolean {
  return missingSlotFields(s).length === 0;
}

/** 슬롯 → 04 업체관리 1행. `reservationDate` 가 예약일(B) = 기록하는 날짜.
 *  「잘못 적었어요」로 다른 날짜에 옮겨 저장할 때는 호출부가 그 날짜를 넘긴다. */
export function buildMeetingFromSlot(slot: NewSlot, reservationDate: string): Meeting {
  return {
    id: slot.tempId,
    예약일: reservationDate,
    예약시각: new Date().toTimeString().slice(0, 5),
    미팅날짜: slot.미팅날짜,
    미팅시간: slot.미팅시간,
    channel: slot.channel,
    업체명: slot.업체명.trim(),
    장소: slot.장소.trim(),
    예약비고: slot.예약비고.trim(),
    업체정보: slot.업체정보, // 신규 슬롯에서 입력한 업체정보 → 04 T~AS (§3-1)
    상태: "예약",
    계약여부: false,
    수임비: 0,
    미팅사유: "",
    계약조건: "",
  };
}
