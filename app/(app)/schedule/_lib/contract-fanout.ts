/**
 * 계약 저장 시 「02 계약수납 장부에 행을 넣을지」 단일 결정점 (순수 · 2026-09-01).
 *
 * ## 왜 함수로 뺐나
 * 여기는 **매출이 사라졌던 자리**다(belie 신고 · 10기 문병규). 대시보드 「계약 4건」은
 * `04 업체관리` 의 도장을 세고, 실무/수납 「3건」은 `02 계약수납관리` 의 행을 센다.
 * 계약 처리는 두 번의 쓰기(① 미팅 patch → ② 장부 append)로 쪼개져 있는데, ②가 빠져도
 * 아무도 맞춰주지 않아 ₩1,100,000 짜리 계약이 장부에서 통째로 사라졌다.
 *
 * 옛 코드의 구멍 둘:
 *   ⓐ patch **후** 화면 데이터를 다시 뒤져 미팅을 찾았다 → 못 찾으면 `✓ 저장 완료` 라는
 *      **성공 표시**를 띄우고 ②를 건너뛰었다. 수강생은 잘 저장된 줄 안다.
 *   ⓑ 이미 계약인 카드는 ②를 아예 안 태웠다(`!wasAlreadyContract`) → 한 번 빠지면
 *      다시 저장해도 영영 안 채워진다.
 *
 * 그래서 규칙을 바꾼다:
 *   · 출처는 patch **전에** 잡아둔 미팅 하나뿐이다. 없으면 `blocked` — 조용한 성공 금지.
 *   · 상태가 "계약"이면 **이미 계약이었더라도** 태운다. 그래야 재저장이 곧 복구가 된다.
 *
 * 재실행이 안전한 근거: `appendFromContract(dateCompanyFallback=true)` 는 연결 미팅 id →
 * (계약일+업체명) 순으로 기존 행을 먼저 찾아 **그 행을 갱신**한다(BBE-53). 새 행을 만들지
 * 않으므로 매출 이중계상(#558)이 나지 않는다.
 */

/** 판정에 필요한 미팅 최소 형태 — 화면 타입(Meeting)에 의존하지 않는다. */
export interface FanoutSource {
  미팅날짜: string;
  업체명: string;
  수임비?: number;
}

export interface FanoutPayload {
  계약일: string;
  업체명: string;
  수임비: number;
}

export type FanoutDecision =
  /** 계약 저장이 아니다 — 장부는 건드리지 않는다. */
  | { kind: "skip" }
  /** 계약 저장인데 출처 미팅을 못 잡았다 — **성공으로 위장하지 말고 사용자에게 알린다.** */
  | { kind: "blocked" }
  /** 장부에 넣는다(없으면 생성, 있으면 갱신). */
  | { kind: "run"; payload: FanoutPayload };

/**
 * @param partial      이번 저장에 담긴 변경분
 * @param prevMeeting  **patch 이전에** 잡아둔 원본 미팅(재조회 금지 — 그게 구멍 ⓐ였다)
 */
export function decideContractFanout(
  partial: { 상태?: string; 수임비?: number },
  prevMeeting: FanoutSource | undefined,
): FanoutDecision {
  if (partial.상태 !== "계약") return { kind: "skip" };
  if (!prevMeeting) return { kind: "blocked" };
  const 업체명 = (prevMeeting.업체명 ?? "").trim();
  const 계약일 = (prevMeeting.미팅날짜 ?? "").trim();
  // 업체명·계약일이 비면 장부의 자연키(계약일+업체명)가 성립하지 않는다 —
  // 그대로 보내면 빈 키 행이 생겨 나중 재시도가 엉뚱한 행을 덮어쓴다.
  if (!업체명 || !계약일) return { kind: "blocked" };
  return {
    kind: "run",
    payload: { 계약일, 업체명, 수임비: partial.수임비 ?? prevMeeting.수임비 ?? 0 },
  };
}
