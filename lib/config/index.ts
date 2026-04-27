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
 */
export const SHEET_RANGES = {
  // ── 대시보드 (읽기 전용) ───────────────────────────────────
  dashboard: {
    tab: "대시보드",
    summary: "B2:N20", // 요약 카드 영역 (Recharts 입력)
    period: "N1", // 수강시작일 + 기간 메타 (수식)
  },

  // ── 영업관리 (채널×지표 카운트) ────────────────────────────
  // E~H: 웹 직접 쓰기 (날짜, 채널, 지표, 카운트)
  // I~T: 시트 수식 자동 (절대 쓰기 금지 — 구조 테스트가 차단)
  sales: {
    tab: "영업관리",
    headerRow: "A1:T1",
    inputRange: "E2:H", // 웹이 append/update 가능한 영역
    formulaRange: "I2:T", // 수식 영역 (참고용 — 쓰기 금지)
  },

  // ── 업체관리 (1행 = 1미팅) ─────────────────────────────────
  meetings: {
    tab: "업체관리",
    headerRow: "A1:Q1",
    range: "A2:Q", // append + update 대상
  },

  // ── 수납관리 (1행 = 1입금) ─────────────────────────────────
  payments: {
    tab: "수납관리",
    headerRow: "A1:E1",
    range: "A2:E",
  },

  // ── 회고노트 (1행 = 1주차) ─────────────────────────────────
  retro: {
    tab: "회고노트",
    headerRow: "A1:D1",
    range: "A2:D",
  },
} as const;
