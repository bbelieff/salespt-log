import type { NewSlot } from "../_components/MeetingSlotItem";

/** 저장 전 카드 안내와 저장 게이트가 같은 필수 입력 기준을 사용한다. */
export function missingSlotFields(slot: NewSlot): string[] {
  return ([
    ["미팅날짜", "미팅날짜"], ["미팅시간", "미팅시간"],
    ["업체명", "회사명"], ["장소", "장소"],
  ] as const).filter(([key]) => !slot[key].trim()).map(([, label]) => label);
}
