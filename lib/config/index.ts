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

// ⚠️ 모든 secret은 lazy로. 모듈 로드 시점이 아닌 첫 호출 시점에만 검증.
// (Next.js build의 "collect page data" 단계가 라우트 모듈을 로드할 때
//  env vars 없으면 build가 깨지는 것을 방지)

export const authConfig = () => ({
  secret: required("AUTH_SECRET"),
  googleId: required("AUTH_GOOGLE_ID"),
  googleSecret: required("AUTH_GOOGLE_SECRET"),
});

export const serviceAccount = () => ({
  client_email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  // Vercel/VPS 환경변수에서 \n 이스케이프 복원
  private_key: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
});

// 마스터 레지스트리 — email → { cohort, name, spreadsheetId }
export const registry = () => ({
  spreadsheetId: required("SHEETS_REGISTRY_ID"),
  tab: process.env.SHEETS_REGISTRY_TAB ?? "users",
});

/**
 * 기수 전체 현황 마스터 시트 (트레이너·관리자 조회용).
 * registry 와는 별개 — 사람·시트 매핑은 registry, 기수 단위 KPI/대시보드는 여기.
 * env SHEETS_COHORT_MASTER_ID 미설정 시 빈 문자열 → UI 에서 링크 미노출.
 */
export const cohortMasterSheetId = (): string =>
  process.env.SHEETS_COHORT_MASTER_ID ?? "";

/**
 * Admin (마스터) 이메일 목록.
 * env ADMIN_EMAILS="a@x.com,b@y.com" (콤마 구분). 미설정 시 빈 배열.
 *
 * Admin 권한:
 *   - registry 등록 안 되어 있어도 로그인 허용 (claim 건너뜀)
 *   - 다른 사용자 시트 조회·편집 (impersonation, /api/admin/switch)
 *   - /api/admin/users 로 전체 등록자 목록 조회
 */
export const adminEmails = (): string[] => {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

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

  // ── 영업관리 (8주차 × 28행 블록) ───────────────────────────
  // 웹 직접 쓰기: E~H (4지표) + Q~T (실적관리/수납)
  // 시트 수식 자동: I~P (절대 쓰기 금지 — formulaCols로 가드)
  //
  // 좌표 측정 (사용자 시트 2026-04-28):
  //   1주차 토요일 매입DB = E10 → BLOCK_START = 10
  //   2주차 토요일 매입DB = E44 → BLOCK_STRIDE = 34
  //   8주차 첫 행 = 10 + 7×34 = 248
  //
  // 한 주 28행 (7일 × 4채널) + 6행 (헤더·합계·여백) = 34행 stride
  sales: {
    tab: "01 영업관리",
    startDateCell: "O1", // 수강시작일 — repo가 읽어서 주차 계산 (N1은 "시작일" 라벨)
    graduationDateCell: "O2", // 종강총회일 — N2는 "종강총회" 라벨, 값은 O2
    blockStart: 10, // 1주차 첫 데이터 행 (토요일 매입DB)
    blockStride: 34, // 주차 간 행 간격
    metricCols: {
      production: "E",
      inflow: "F",
      contactProgress: "G",
      meetingReservation: "H", // 시트 헤더 "미팅 예약건 수" (구 "컨택성공")
    },
    revenueCols: {
      approvalCount: "Q",
      paymentCount: "R",
      paymentAmount: "S",
      agencyNote: "T",
    },
    // ⚠️ 시트 수식 자동 — 웹 쓰기 금지. repo가 런타임 가드로 차단.
    formulaCols: ["I", "J", "K", "L", "M", "N", "O", "P"] as const,
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

  // ── 계약수납관리 v2 (1행 = 1계약, A~AD) ─────────────────────
  // 일정·계약 탭에서 계약 액션 시 row 자동 생성 (C/D/E 자동 채움).
  // 사용자가 계약수납탭에서 F~L (체크박스 7, "ㅇ" 표기) + M~AD (분할수납 3슬롯×6필드) 입력.
  // SSOT: docs/domains/sheet-structure.md §4 v2
  contractPayment: {
    tab: "02 계약수납관리",
    // 1~5행 = 헤더 + 예시/안내 row (실제 시트 검증 결과 — 사용자 ★★★세일즈PT 양식),
    // 6행~ = 실제 데이터. headerRows·firstDataRow 변경 시 같이 업데이트.
    headerRows: 5,
    firstDataRow: 6,
    range: "A6:AD", // 데이터 영역 (v2: AA→AD, +3 컬럼 = 슬롯당 진행률 1개 추가)
    // 자동 연동 컬럼 — 계약 액션 시 04 업체관리에서 채움 (D/G/L → C/D/E)
    autoCols: { 계약일: "C", 업체명: "D", 수임비: "E" },
    // 7 체크박스 ("ㅇ" / "" 표기)
    checkboxCols: ["F", "G", "H", "I", "J", "K", "L"] as const,
    checkboxLabels: [
      "공동인증서",
      "임대차계약서",
      "신분증",
      "드라이브업로드",
      "사업계획서초안발송",
      "컨설팅5종서류발송",
      "플러그이관",
    ] as const,
    // 3 분할 수납 슬롯 (v2: 각 슬롯 6필드 — 진행기관/진행률/현황/승인금액/수납액/수납일)
    paymentSlots: [
      { startCol: "M", endCol: "R" }, // 수납1: M~R
      { startCol: "S", endCol: "X" }, // 수납2: S~X
      { startCol: "Y", endCol: "AD" }, // 수납3: Y~AD
    ] as const,
    // 진행률 dropdown 컬럼 (시트 data validation: "0%/20%/40%/60%/80%/100%" 텍스트)
    progressCols: ["N", "T", "Z"] as const,
  },

  // ── DB관리 (4채널 raw log, 비용 + 영업기회) ───────────────
  // 앱은 raw 입력만. 합계/평균단가 수식은 시트 자체에 이미 박혀있음.
  // 합계 행("합계" 텍스트 시작)은 절대 덮어쓰지 않음.
  // SSOT: docs/domains/sheet-structure.md §5
  dbManagement: {
    tab: "03 DB관리",
    // 1~3행 = 섹션 타이틀 + 컬럼 헤더 + 안내 row, 4행~ = 실제 데이터 (4채널 동일).
    // FIRST_DATA_ROW = headerRow + 1 = 4.
    headerRow: 3,
    // 데이터 영역 상한 (사용자가 합계 행을 row 100 이후에 두면 모두 데이터로 인식).
    // 너무 크게 잡으면 read 비용↑, 너무 작게 잡으면 합계 행 만남.
    maxRow: 100,
    sections: {
      매입DB: {
        startCol: "B",
        endCol: "G",
        cols: ["구매일", "업체명", "개당단가", "주문개수", "주문금액", "기타"] as const,
        // E열(주문금액)은 시트 수식 — 앱이 직접 쓰지 않음
        formulaCols: ["주문금액"] as const,
      },
      직접생산: {
        startCol: "I",
        endCol: "N",
        cols: ["날짜", "소재", "기간예산", "생산개수", "개당단가", "기타"] as const,
        // M열(개당단가) = 기간예산 ÷ 생산개수 시트 수식
        formulaCols: ["개당단가"] as const,
      },
      현수막: {
        startCol: "P",
        endCol: "V",
        cols: ["날짜", "업체명", "도착일", "개당단가", "주문개수", "주문금액", "기타"] as const,
        formulaCols: ["주문금액"] as const,
      },
      "콜·지·기·소": {
        startCol: "X",
        endCol: "AD",
        cols: ["구분", "접수일", "대표자명", "업체명", "소개처", "연락처", "조건"] as const,
        formulaCols: [] as const, // 비용 X, 정보만 — 수식 없음
      },
    },
  },
} as const;
