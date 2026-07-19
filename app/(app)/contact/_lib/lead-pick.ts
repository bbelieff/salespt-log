/**
 * 발굴 피커 재선택 병합 (PR-3). NewItem 이 얇게 유지되도록 순수 분리(500줄 캡).
 *
 * 두 불변식을 동시에 지킨다:
 *  - **R7(발굴 교체 혼합 금지)**: A→B 전환 시 A 잔재가 남으면 안 됨.
 *  - **§2.5(사용자 작성값 절대 보존)**: pick 이후 사용자가 손으로 넣은 값이 조용히 사라지면 안 됨.
 *
 * 규칙(재선택 시):
 *  - 문자열(업체명·예약비고): 직전 pick 결과(lastMerge)와 다르면 = **사용자가 고침 → 유지**;
 *    그대로면 = 프리필 잔재 → baseline(첫 pick 이전 원본)으로 되돌려 새 발굴이 채우게 함.
 *    (업체명 정정·예약비고 준비메모 같은 손입력 보존 — 리뷰가 잡은 손실 케이스.)
 *  - 업체정보(대표자/연락처/소개처): 발굴이 소유하는 데이터. CompanyInfoEditor 리마운트가 객체를
 *    정규화(emptyCi 병합)해 "사용자 편집" 을 신뢰성 있게 감지할 수 없다 → 재선택 시 **baseline
 *    기준으로 새 발굴이 채운다**(A 잔재 0). 첫 pick 이전에 손입력한 업체정보는 baseline 에 있어 보존됨.
 *  - 첫 pick(lastMerge 없음): 현재 슬롯에 그대로 병합(입력 중이던 값 보존).
 */
import type { CompanyInfo, DBLead } from "@/types";
import { mergeLeadDraft } from "@/service/lead-prefill";

export interface PickMerged {
  업체명: string;
  예약비고: string;
  업체정보?: CompanyInfo;
}

/** baseline=첫 pick 이전 원본, slot=현재, lastMerge=직전 pick 결과(없으면 첫 pick). */
export function mergePick(
  baseline: PickMerged,
  slot: PickMerged,
  lastMerge: PickMerged | null,
  lead: DBLead,
): PickMerged {
  const base: PickMerged = lastMerge
    ? {
        업체명: slot.업체명 !== lastMerge.업체명 ? slot.업체명 : baseline.업체명,
        예약비고: slot.예약비고 !== lastMerge.예약비고 ? slot.예약비고 : baseline.예약비고,
        업체정보: baseline.업체정보, // 재선택 시 새 발굴이 채움(A 잔재 0)
      }
    : { 업체명: slot.업체명, 예약비고: slot.예약비고, 업체정보: slot.업체정보 };
  return mergeLeadDraft(base, lead);
}
