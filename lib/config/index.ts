/**
 * Layer: config — 환경변수와 시트 주소(A1 range). 로직 없음.
 * 구조 테스트가 이 레이어의 상위 import를 차단한다.
 *
 * 시트 구조: docs/domains/sheet-structure.md
 *   - 대시보드 (읽기 전용 — 수식이 계산)
 *   - 영업관리 (4채널×4지표 카운트, E~H 직접 쓰기 / I~T 수식)
 *   - 업체관리 (1행 = 1미팅, append/update)
 *   - 수납관리 (1행 = 1입금, append)
 *   - 회고노트 (자유 텍스트, 1행 = 1주차)
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 비어있습니다. .env 를 확인하세요.`);
  return v;
}

export const authConfig = {
  secret: required("AUTH_SECRET"),
  googleId: required("AUTH_GOOGLE_ID"),
  googleSecret: required("AUTH_GOOGLE_SECRET"),
} as const;

export const serviceAccount = () => ({
  client_email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  // Vercel/VPS 환경변수에서 \n 이스케이프 복원
  private_key: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
});

// 마스터 레지스트리 — email → { cohort, name, spreadsheetId }
export const registry = {
  spreadsheetId: required("SHEETS_REGISTRY_ID"),
  tab: process.env.SHEETS_REGISTRY_TAB ?? "users",
} as const;

/**
 * 수강생 개인 시트의 섹션별 A1 범위.
 * 시트 구조가 바뀌면 여기만 고친다. Repo 코드는 건드리지 않는다.
 *
 * 실제 시트 구조 (Drive MCP로 검증, 2026-04-27):
 *   - 대시보드(자동작성)        — 읽기 전용
 *   - 01 영업관리              — 8주차 × 28행 블록 (수식 자동 집계)
 *   - 02 계약관리              — 계약 사후 서류 체크리스트 (앱 사용 X)
 *   - 03 DB관리                — 채널별 DB 매입/생산 raw log (앱 사용 X)
 *   - 04 업체관리(앱자동작성용) — 1행=1미팅 (앱 직접 쓰기)
 *
 * 수납 정보는 별도 탭이 아니라 01 영업관리 매주 블록의 "실적관리" 컬럼 그룹에
 * 통합되어 있음 (승인건수/수납건수/수납금액/비고). 회고노트 탭은 없음.
 */
export const SHEET_RANGES = {
  // ── 대시보드 (읽기 전용) ───────────────────────────────────
  dashboard: {
    tab: "대시보드(자동작성)",
    summary: "B2:N20", // 요약 카드 영역 (Recharts 입력)
  },

  // ── 영업관리 (수식 자동 집계, 8주차 × 28행 블록) ───────────
  // 웹은 4지표(생산/유입/컨택진행/컨택성공)만 정확한 행에 update.
  // N1 = 수강시작일 (사용자가 새 기수마다 직접 입력) → 시트 수식이 각 주차 날짜 자동 채움.
  // 행 좌표 lookup은 PR 2의 lib/repo/sales.ts에서 처리 (날짜·채널 → 행번호 매핑).
  sales: {
    tab: "01 영업관리",
    startDateCell: "N1", // 수강시작일 — repo가 읽어서 주차 계산
  },

  // ── 업체관리 (1행 = 1미팅, 19컬럼 A~S) ─────────────────────
  // 앱이 append/update 직접. id/예약일/예약시각/미팅날짜/미팅시간/채널/
  // 업체명/장소/예약비고/상태/계약여부/수임비/미팅사유/표시_상세(수식)/
  // 표시_요약(수식)/계약조건/계약합성라인(수식)/previousMeetingId/주차(수식)
  meetings: {
    tab: "04 업체관리(앱자동작성용)",
    headerRow: "A1:S1",
    range: "A2:S", // append + update 대상
  },
} as const;
