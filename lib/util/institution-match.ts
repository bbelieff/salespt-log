/**
 * Layer: util (순수 — import 0). 진행기관 이름 비교.
 *
 * 왜 필요한가: 실무(수납) 탭은 ToDo 를 슬롯의 **진행기관 이름으로** 묶는다
 * (`app/(app)/payment/_components/PaymentSlotForm.tsx`). 그런데 자유 입력 칸이라
 * 눈에 안 보이는 공백이 섞인다. 2026-09-19 실제 사고: 슬롯이 「신용보증기금 」
 * (끝 공백 1개), ToDo 가 「신용보증기금」이라 `===` 가 어긋나 **ToDo 가 탭에서 통째로
 * 사라졌다.** 캘린더는 날짜로만 보니 계속 보여서 「캘린더엔 뜨는데 탭엔 안 뜬다」가 됐다.
 *
 * 그래서 **양끝 공백은 무시**한다. 다만 안쪽 차이(「전북재단 김제지점」 대 「전북재단 부안지점」)
 * 는 **실제로 다른 기관**이므로 건드리지 않는다 — 과하게 뭉개면 남의 ToDo 가 붙는다.
 */

/** 양끝 공백만 털어낸 비교용 형태. 빈값·null·undefined 는 모두 "" 로 본다. */
export function normalizeInstitution(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

/** 같은 슬롯(진행기관)인가 — 양끝 공백 차이는 같은 것으로 본다. */
export function sameInstitution(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeInstitution(a) === normalizeInstitution(b);
}
