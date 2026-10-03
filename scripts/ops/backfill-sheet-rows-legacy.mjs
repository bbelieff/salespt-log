/**
 * BBE-67(R7-#18) — 5기 legacy 탭 구조 상수 + 순수 계산 (googleapis 의존 0, 단위테스트 대상).
 *
 * `backfill-sheet-rows.mjs` 가 5기(무번호 구세대 탭) 시트를 만났을 때 참조하는 좌표·판정
 * 로직만 분리했다 — 이 파일만 바꿔도 현행(4·6·7·8·9·10기) 백필 경로는 전혀 영향받지 않는다.
 * 근거·census 원본 = `docs/plans/active/bbe67-legacy-5gi-adapter.md` §2.
 */

/** 계약관리(5기, 번호 없음) — row10=헤더·row11=예시행·row12+=실데이터(census 실측 확정). */
export const LEGACY_CONTRACT_TAB = "계약관리";
export const LEGACY_CONTRACT_FIRST_DATA_ROW = 12;

/**
 * 03 DB관리(5기, 번호 없음) — 현행과 배치가 다르다: 매입DB·직접생산 은 같은 행 범위에서
 * 나란히(컬럼만 다름), 현수막·지인기고객소개 는 그 아래로 쌓인다. 각 섹션은 "합계" 행에서
 * 끝난다(수기 시트라 실사용 행수가 학생마다 다름 — 고정 행수 대신 라벨 감지로 종료 판정).
 */
export const LEGACY_DB_SECTIONS = [
  { name: "매입DB", c1: "B", c2: "G", rowStart: 5, rowMax: 12 },
  { name: "직접생산", c1: "K", c2: "P", rowStart: 5, rowMax: 12 },
  { name: "현수막", c1: "B", c2: "H", rowStart: 15, rowMax: 22 },
  { name: "지인기고객소개", c1: "B", c2: "H", rowStart: 25, rowMax: 32 },
];

/**
 * "합계"(집계) 행 여부 — 이 행을 만나면 섹션 스캔을 **멈춘다**(뒤는 다음 섹션이거나 무관한
 * 내용). 빈 슬롯(census 실측: 데이터와 합계 사이에 미사용 빈 행이 낀다 — B5:B9 중 B7~9 가
 * 빈 채로 남는 식)은 "종료"가 아니라 "건너뛰기"다 — 둘을 같은 값으로 접으면(구 버전 버그)
 * break 없이 forEach 로 순회할 때 합계 뒤 잔여 행까지 데이터로 잘못 집계된다.
 */
export function isLegacyDbSectionTotalRow(firstCellText) {
  return String(firstCellText ?? "").trim() === "합계";
}

/**
 * 01 영업관리(5기, 번호 없음) — O1 앵커 없음, 각 요일 블록 첫 행 C열에 날짜 직접 기록.
 * 주차 stride(34)·요일당 4행(채널 포지션)은 현행과 동일(census 실측 — r8→r42 34행 간격 확인).
 * 4번째 채널은 원문("지-기-소", "콜" 없음) 그대로 — belie/반장 결정 전까지 지어내지 않는다.
 */
export const LEGACY_SALES_CHANNELS = ["매입DB", "직접생산", "현수막", "지-기-소"];
export const LEGACY_SALES_WEEK_STRIDE = 34;
export const LEGACY_SALES_FIRST_ROW = 10;

/**
 * (주차 w 1-base, 요일 d 0~6, 채널 c 0~3) → 시트 물리 행 번호.
 * 현행 코드의 `10 + (w-1)*34 + d*4 + c` 와 **동일 공식**(census 로 legacy 도 같은 stride 확인) —
 * 별도 함수로 뽑은 이유는 legacy 경로가 날짜를 계산이 아니라 이 행에서 직접 읽기 때문에,
 * "어느 행을 읽을지" 자체가 legacy 전용 로직의 일부가 된다.
 */
export function legacySalesBlockRow(w, d, c) {
  return LEGACY_SALES_FIRST_ROW + (w - 1) * LEGACY_SALES_WEEK_STRIDE + d * 4 + c;
}
