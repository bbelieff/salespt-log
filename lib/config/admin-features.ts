/**
 * Layer: config — 관리자 화면 기능 스위치(admin-phase1, 2026-11-16).
 *
 * 잘 쓰지 않는 관리 기능의 «화면 진입점» 만 숨긴다. 서버 라우트·데이터는 그대로다.
 * 이미 그 상태인 데이터(유보 수강생·보관한 기수)를 되돌리는 길은 스위치와 상관없이 늘 보인다.
 * 지금은 코드 상수 하나 — 나중에 고객(교육기관·영업조직)별 설정으로 옮길 자리다.
 */
export interface AdminFeatures {
  /** 수강생 「유보 처리」(일괄 유보 버튼). 꺼도 유보 수강생 목록·복귀·내보내기는 보인다. */
  reserve: boolean;
  /** 활성 기수 「보관 처리」. 꺼도 보관한 기수 목록·다시 활성화는 보인다. */
  cohortArchive: boolean;
  /** 아레나 공유왕 수동 집계 화면으로 가는 링크. 꺼도 주소(/admin/arena/share-scores)는 열린다. */
  shareScores: boolean;
}

export const ADMIN_FEATURES: AdminFeatures = {
  reserve: false,
  cohortArchive: false,
  shareScores: false,
};
