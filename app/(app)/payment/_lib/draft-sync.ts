/**
 * 계약 카드 로컬 draft ↔ 서버 정본(cp) 동기화 판정 (hotfix 2026-07-21).
 *
 * 왜 존재하나 — `useState(cp)` 는 마운트 1회만 초기화라 이후 cp 가 바뀌어도 draft 는 옛값에 동결된다.
 * PC 마스터-디테일은 같은 계약을 목록(selectable)·상세(forceOpen) 2인스턴스로 렌더하므로,
 * 저장 성공 → refetch 로 cp 가 갱신되면 **편집한 적 없는 인스턴스의 옛 draft** 가
 * "draft ≠ cp" 라는 이유로 dirty 로 등록됐다. 이탈 팝업의 "저장하고 이동" 이 그 옛 draft 를
 * 재저장해 방금 저장을 롤백했다(데이터 유실). 두 인스턴스가 서로를 덮으며 팝업이 무한 반복됐다.
 *
 * 해법 = **값 비교가 아니라 사용자 편집 의도**로 dirty 를 판정한다.
 * 레포 선례: app/(app)/contact/page.tsx(metricsTouched AND 절),
 *            app/(app)/schedule/_components/MeetingResultCard.tsx(action/editMode 플래그).
 *
 * 이 파일은 순수 함수만 둔다(React·DOM 참조 0) — vitest environment:"node" 로 회귀 고정 가능.
 */
import type { ContractPayment } from "@/types";

/** 저장본과 내용이 같은가. 시트/DB 정규화 드리프트까지 포함해 "보이는 값" 기준으로 비교. */
export function sameContract(a: ContractPayment, b: ContractPayment): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface DirtyInput {
  /** 컴팩트 목록 인스턴스(편집 UI 미렌더). */
  selectable: boolean;
  /** 이 인스턴스에서 사용자가 실제로 draft 를 편집했는가. */
  touched: boolean;
  /** 업체정보(04·06) 를 만졌는가. */
  ciTouched: boolean;
  draft: ContractPayment;
  /** 서버 정본. */
  cp: ContractPayment;
}

/**
 * 이 인스턴스가 미저장 가드에 **저장 주체로 등록**되는가.
 *
 * - selectable 목록 인스턴스는 바디(편집 UI)를 렌더하지 않으므로 draft 를 바꿀 경로가 없다
 *   → 저장 주체가 될 수 없다(옛 draft 재저장=롤백 원천 차단).
 * - 편집 의도가 없으면(touched=false) draft≠cp 여도 dirty 가 아니다 — 그건 서버가 앞서간 것뿐이다.
 * - 편집했다가 원래 값으로 되돌린 경우는 dirty 가 아니다(값 비교 AND 절).
 */
export function shouldRegisterDirty(o: DirtyInput): boolean {
  if (o.selectable) return false;
  if (o.ciTouched) return true;
  return o.touched && !sameContract(o.draft, o.cp);
}

/**
 * cp(서버 정본)가 바뀌었을 때 draft 를 새 cp 로 **재기준**할 것인가.
 *
 * 사용자가 편집 중이면 절대 덮어쓰지 않는다(편집 유실 금지).
 * 편집 중이 아니면 재기준해서 stale draft 가 남지 않게 한다 —
 * 저장 성공 후의 refetch, LinkedFieldsEditor(계약정보 수정)·계약해지 등 외부 경로 모두 커버.
 */
export function shouldRebaseDraft(o: { touched: boolean; ciTouched: boolean }): boolean {
  return !o.touched && !o.ciTouched;
}
