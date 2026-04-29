/**
 * 시트 수식 일괄 설치 / 제거 — 사용자가 처음 시트 셋업할 때 한 번만 호출.
 *
 * v2 안전화 원칙:
 *   - ARRAYFORMULA 사용 금지 (사용자의 합계행 수식을 깨뜨림)
 *   - C 컬럼 (날짜) 미리 읽어서 데이터 행만 식별 → 그 행에만 per-row 수식 작성
 *   - 합계행/주차헤더/빈 행에는 절대 쓰지 않음
 *   - SORT 적용으로 같은 셀 내 라인은 시간 빠른 것이 위로 (사용자 요청)
 *
 * 04 업체관리(앱자동작성용):
 *   - N: 표시_상세  ARRAYFORMULA (4 업체관리 N 컬럼은 user content 없음 가정)
 *   - O: 표시_요약  ARRAYFORMULA
 *   - Q: 계약합성라인 ARRAYFORMULA
 *
 * 01 영업관리:
 *   - I/J/K/L/M/N/O/P: 데이터 행에만 per-row 수식
 *
 * SSOT: docs/domains/sheet-structure.md §2~§3
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

const MEETINGS_TAB = SHEET_RANGES.meetings.tab;
const SALES_TAB = SHEET_RANGES.sales.tab;
const M_REF = tabRef(MEETINGS_TAB);

const SALES_BLOCK_START = SHEET_RANGES.sales.blockStart; // 10
const SALES_BLOCK_STRIDE = SHEET_RANGES.sales.blockStride; // 34
// 8주차 마지막 데이터 행 = 10 + 7×34 + 27 = 275 (보수적 상한)
const SALES_LAST_ROW = SALES_BLOCK_START + 7 * SALES_BLOCK_STRIDE + 27;

const SALES_FORMULA_COLS = ["I", "J", "K", "L", "M", "N", "O", "P"] as const;

// ── 04 업체관리 ARRAYFORMULA들 (이 탭은 사용자 manual 입력 컬럼 없음) ─
const MEETINGS_ARRAYFORMULAS: Array<{ cell: string; formula: string }> = [
  {
    cell: "N2",
    formula: `=ARRAYFORMULA(IF(D2:D="","",TEXT(D2:D,"M/d")&", "&TEXT(E2:E,"HH:MM")&", "&G2:G&", "&H2:H))`,
  },
  {
    cell: "O2",
    formula: `=ARRAYFORMULA(IF(E2:E="","",TEXT(E2:E,"HH:MM")&", "&G2:G&", "&H2:H))`,
  },
  {
    cell: "Q2",
    formula: `=ARRAYFORMULA(IF(J2:J="계약", G2:G&", "&L2:L&", "&P2:P, ""))`,
  },
];

// ── 데이터 행 식별 (C 컬럼 = 날짜) ───────────────────────────────
async function readDataRows(spreadsheetId: string): Promise<number[]> {
  const range = `${tabRef(SALES_TAB)}!C${SALES_BLOCK_START}:C${SALES_LAST_ROW}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = res.data.values ?? [];
  const dataRows: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i]?.[0];
    // 데이터 행: C 셀이 number(date serial). 합계/헤더는 string ("주차별합계" 등) 또는 empty.
    if (typeof v === "number" && v > 0) {
      dataRows.push(SALES_BLOCK_START + i);
    }
  }
  return dataRows;
}

// ── 영업관리 한 행에 들어갈 8개 수식 ─────────────────────────────
function formulasForRow(r: number): Record<string, string> {
  // SORT(FILTER(...)) 패턴 — 같은 셀 내 라인은 시간 빠른 것이 위로
  // (TEXT(D,"M/d")&", "&TEXT(E,"HH:MM")&... 형식이라 lex sort = 시간순 sort)
  return {
    // I: 미팅예약기록 — 04업체관리!B(예약일)=$C{r}, F(채널)=$D{r}, !N(표시상세) TEXTJOIN
    I: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,SORT(FILTER(${M_REF}!N:N,(${M_REF}!B:B=$C${r})*(${M_REF}!F:F=$D${r})))),"")`,
    // J: 오늘미팅일정 — 04업체관리!D(미팅날짜)=$C{r}, F=$D{r}, !O(표시요약) TEXTJOIN
    J: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,SORT(FILTER(${M_REF}!O:O,(${M_REF}!D:D=$C${r})*(${M_REF}!F:F=$D${r})))),"")`,
    // K: 오늘미팅수 — COUNTIFS by 미팅날짜+채널
    K: `=COUNTIFS(${M_REF}!D:D,$C${r},${M_REF}!F:F,$D${r})`,
    // L: 미팅완료수 — 계약 + 완료
    L: `=COUNTIFS(${M_REF}!D:D,$C${r},${M_REF}!F:F,$D${r},${M_REF}!J:J,"계약")+COUNTIFS(${M_REF}!D:D,$C${r},${M_REF}!F:F,$D${r},${M_REF}!J:J,"완료")`,
    // M: 미팅사유 자동 집계
    M: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!M:M,(${M_REF}!D:D=$C${r})*(${M_REF}!F:F=$D${r}))),"")`,
    // N: 계약건수
    N: `=COUNTIFS(${M_REF}!D:D,$C${r},${M_REF}!F:F,$D${r},${M_REF}!J:J,"계약")`,
    // O: 수임비합계
    O: `=SUMIFS(${M_REF}!L:L,${M_REF}!D:D,$C${r},${M_REF}!F:F,$D${r},${M_REF}!J:J,"계약")`,
    // P: 계약비고 — 04업체관리!Q(계약합성라인) TEXTJOIN
    P: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!Q:Q,(${M_REF}!D:D=$C${r})*(${M_REF}!F:F=$D${r})*(${M_REF}!J:J="계약"))),"")`,
  };
}

// ── Public API ─────────────────────────────────────────────────

export interface InstallReport {
  installed: number;
  details: string[];
}

/**
 * 시트에 모든 자동 집계 수식을 일괄 설치 (안전 모드).
 * 멱등(idempotent) — 다시 호출해도 같은 수식으로 덮어씀.
 */
export async function installFormulas(
  spreadsheetId: string,
): Promise<InstallReport> {
  const dataRows = await readDataRows(spreadsheetId);
  const data: Array<{ range: string; values: string[][] }> = [];

  // 04 업체관리 ARRAYFORMULA들
  for (const f of MEETINGS_ARRAYFORMULAS) {
    data.push({ range: `${M_REF}!${f.cell}`, values: [[f.formula]] });
  }

  // 01 영업관리 — 데이터 행에만 per-row 수식 (8개 컬럼)
  for (const r of dataRows) {
    const formulas = formulasForRow(r);
    for (const col of SALES_FORMULA_COLS) {
      data.push({
        range: `${tabRef(SALES_TAB)}!${col}${r}`,
        values: [[formulas[col]!]],
      });
    }
  }

  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });

  return {
    installed: data.length,
    details: [
      `04 업체관리: N2/O2/Q2 ARRAYFORMULA (3개)`,
      `01 영업관리: 데이터 행 ${dataRows.length}개 × 8 컬럼 (I~P) = ${dataRows.length * 8}개 셀`,
      `합계행/헤더/빈 행은 건드리지 않음 (사용자 SUM 수식 보존)`,
    ],
  };
}

/**
 * 모든 설치된 수식을 제거.
 * `batchClear`로 셀을 진짜 비움 (값=""을 쓰면 ARRAYFORMULA spill blocker가 됨).
 *
 * ⚠️ 합계행에 있던 사용자 SUM 수식은 v1 installer가 ARRAYFORMULA spill로 깨뜨렸을
 * 가능성 있음. 이 함수는 v1이 깨뜨린 수식을 자동 복원하지 못함 (원본 모름).
 * 사용자가 직접 합계행 수식을 다시 입력해야 함.
 *
 * 클리어 범위:
 *   - 04 업체관리: N2:N, O2:O, Q2:Q (컬럼 전체 — spill blocker 잔재 제거)
 *   - 01 영업관리: 데이터행 후보 전 범위 I~P (BLOCK_START~LAST_ROW)
 *
 * 합계행을 안 건드리려면 영업관리는 셀 단위로 데이터행만 클리어.
 */
export async function uninstallFormulas(
  spreadsheetId: string,
): Promise<{ cleared: number }> {
  // ── 1단계: 업체관리 N/O/Q 컬럼 전체 비우기 (batchClear — 진짜 빈 셀) ─
  const meetingsRanges = [
    `${M_REF}!N2:N`,
    `${M_REF}!O2:O`,
    `${M_REF}!Q2:Q`,
  ];
  await sheetsClient().spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: meetingsRanges },
  });

  // ── 2단계: 영업관리 I~P 데이터행 비우기 (합계행은 안 건드림) ─
  // C 컬럼 읽어서 "데이터 행"만 식별 후 그 행만 클리어.
  const dataRows = await readDataRows(spreadsheetId);
  const salesRanges: string[] = [];
  for (const r of dataRows) {
    for (const col of SALES_FORMULA_COLS) {
      salesRanges.push(`${tabRef(SALES_TAB)}!${col}${r}`);
    }
  }
  if (salesRanges.length > 0) {
    await sheetsClient().spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: salesRanges },
    });
  }

  return { cleared: meetingsRanges.length + salesRanges.length };
}
