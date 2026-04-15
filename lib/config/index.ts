/**
 * Layer: config — 환경변수와 시트 주소(A1 range). 로직 없음.
 * 구조 테스트가 이 레이어의 상위 import를 차단한다.
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
 * 실제 시트 구조(병합·소계 포함)에 맞춰 "논리 테이블"의 셀 범위를 박아둔다.
 * ⚠️ 시트 구조가 바뀌면 여기만 고친다. Repo 코드는 건드리지 않는다.
 */
export const SHEET_RANGES = {
  // 탭1 (대시보드) — 기본 읽기 전용. 메트릭만 읽어가는 용도.
  dashboard: {
    tab: "성과관리",        // 실제 탭 이름 확정 시 교체
    summary: "B2:N10",    // 요약 카드용
  },
  // 탭2 — 계약 로그 (append 대상)
  contracts: {
    tab: "계약관리",
    logHeader: "A8:J8",
    logRange: "A9:J",
  },
  // 탭3 — DB 관리 (각 섹션 append 대상)
  db: {
    tab: "DB관리",
    purchase: "A4:F",      // 매입DB
    direct: "H4:M",        // 직접생산
    banner: "A15:G",       // 현수막
  },
  // 일일 입력 — 수강생이 앱에서 적은 DailyEntry를 쌓는 별도 탭(앱 전용)
  daily: {
    tab: "앱_일일입력",
    header: "A1:F1",
    range: "A2:F",
  },
} as const;
