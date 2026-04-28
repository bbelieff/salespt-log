/**
 * 시트 수식 일괄 설치 — 사용자가 처음 시트 셋업할 때 한 번만 호출.
 *
 * 04 업체관리(앱자동작성용):
 *   - N: 표시_상세  ARRAYFORMULA
 *   - O: 표시_요약  ARRAYFORMULA
 *   - Q: 계약합성라인 ARRAYFORMULA
 *   - S: 주차 ARRAYFORMULA
 *
 * 01 영업관리:
 *   - I~P: 8개 자동 집계 컬럼 (per-row 또는 ARRAYFORMULA)
 *
 * SSOT: docs/domains/sheet-structure.md §2~§3
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

const MEETINGS_TAB = SHEET_RANGES.meetings.tab; // "04 업체관리(앱자동작성용)"
const SALES_TAB = SHEET_RANGES.sales.tab; // "01 영업관리"
const M_REF = tabRef(MEETINGS_TAB);

const SALES_BLOCK_START = SHEET_RANGES.sales.blockStart; // 10
const SALES_BLOCK_STRIDE = SHEET_RANGES.sales.blockStride; // 34

// 영업관리 데이터 행 범위 (1주차 토요일 ~ 8주차 금요일 마지막 채널)
// 8주차 마지막 행 = 10 + 7×34 + 6×4 + 3 = 273
// 안전하게 248까지 (8주차 토요일+27 = 248부터). 사용자분 설정 따라 조정 가능.
// 보수적으로 끝까지 전체 8주분 = 10 + 7×34 + 27 = 275
const SALES_LAST_ROW =
  SALES_BLOCK_START + 7 * SALES_BLOCK_STRIDE + 27;

// ── 04 업체관리 ARRAYFORMULA들 ───────────────────────────────────
const MEETINGS_FORMULAS: Array<{ cell: string; formula: string }> = [
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

// ── 01 영업관리 — ARRAYFORMULA로 처리 가능한 것 (COUNTIFS, SUMIFS) ─
function buildSalesArrayFormulas(): Array<{ cell: string; formula: string }> {
  const start = SALES_BLOCK_START;
  const end = SALES_LAST_ROW;
  const cRange = `$C$${start}:$C$${end}`;
  const dRange = `$D$${start}:$D$${end}`;
  const mD = `${M_REF}!D:D`;
  const mF = `${M_REF}!F:F`;
  const mJ = `${M_REF}!J:J`;
  const mL = `${M_REF}!L:L`;

  return [
    {
      // K: 오늘미팅수
      cell: `K${start}`,
      formula: `=ARRAYFORMULA(IF(${cRange}="","",COUNTIFS(${mD},${cRange},${mF},${dRange})))`,
    },
    {
      // L: 미팅완료수 (계약+완료)
      cell: `L${start}`,
      formula: `=ARRAYFORMULA(IF(${cRange}="","",COUNTIFS(${mD},${cRange},${mF},${dRange},${mJ},"계약")+COUNTIFS(${mD},${cRange},${mF},${dRange},${mJ},"완료")))`,
    },
    {
      // N: 계약건수
      cell: `N${start}`,
      formula: `=ARRAYFORMULA(IF(${cRange}="","",COUNTIFS(${mD},${cRange},${mF},${dRange},${mJ},"계약")))`,
    },
    {
      // O: 수임비합계
      cell: `O${start}`,
      formula: `=ARRAYFORMULA(IF(${cRange}="","",SUMIFS(${mL},${mD},${cRange},${mF},${dRange},${mJ},"계약")))`,
    },
  ];
}

// ── 01 영업관리 — TEXTJOIN+FILTER (per-row 필요) ──────────────────
function buildSalesPerRowFormulas(): Array<{ range: string; values: string[][] }> {
  const I_values: string[][] = [];
  const J_values: string[][] = [];
  const M_values: string[][] = [];
  const P_values: string[][] = [];

  for (let r = SALES_BLOCK_START; r <= SALES_LAST_ROW; r++) {
    // I열 (미팅예약기록 — 예약일=$C{r}, 채널=$D{r} 기준)
    I_values.push([
      `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!N:N,(${M_REF}!B:B=$C${r})*(${M_REF}!F:F=$D${r}))),"")`,
    ]);
    // J열 (오늘미팅일정 — 미팅날짜=$C{r}, 채널=$D{r} 기준)
    J_values.push([
      `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!O:O,(${M_REF}!D:D=$C${r})*(${M_REF}!F:F=$D${r}))),"")`,
    ]);
    // M열 (미팅사유 — 미팅날짜=$C{r}, 채널=$D{r} 기준)
    M_values.push([
      `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!M:M,(${M_REF}!D:D=$C${r})*(${M_REF}!F:F=$D${r}))),"")`,
    ]);
    // P열 (계약비고 — 미팅날짜=$C{r}, 채널=$D{r}, 상태=계약 기준, Q열 합성)
    P_values.push([
      `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!Q:Q,(${M_REF}!D:D=$C${r})*(${M_REF}!F:F=$D${r})*(${M_REF}!J:J="계약"))),"")`,
    ]);
  }

  const tabPrefix = tabRef(SALES_TAB);
  return [
    { range: `${tabPrefix}!I${SALES_BLOCK_START}:I${SALES_LAST_ROW}`, values: I_values },
    { range: `${tabPrefix}!J${SALES_BLOCK_START}:J${SALES_LAST_ROW}`, values: J_values },
    { range: `${tabPrefix}!M${SALES_BLOCK_START}:M${SALES_LAST_ROW}`, values: M_values },
    { range: `${tabPrefix}!P${SALES_BLOCK_START}:P${SALES_LAST_ROW}`, values: P_values },
  ];
}

// ── Public API ─────────────────────────────────────────────────

export interface InstallReport {
  installed: number;
  details: string[];
}

/**
 * 시트에 모든 자동 집계 수식을 일괄 설치.
 * 멱등(idempotent) — 다시 호출해도 같은 수식으로 덮어씀.
 */
export async function installFormulas(
  spreadsheetId: string,
): Promise<InstallReport> {
  const data: Array<{ range: string; values: string[][] }> = [];

  // 04 업체관리 ARRAYFORMULA들
  for (const f of MEETINGS_FORMULAS) {
    data.push({
      range: `${M_REF}!${f.cell}`,
      values: [[f.formula]],
    });
  }

  // 01 영업관리 ARRAYFORMULA들 (K, L, N, O)
  for (const f of buildSalesArrayFormulas()) {
    data.push({
      range: `${tabRef(SALES_TAB)}!${f.cell}`,
      values: [[f.formula]],
    });
  }

  // 01 영업관리 per-row formulas (I, J, M, P)
  data.push(...buildSalesPerRowFormulas());

  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });

  const totalCells =
    MEETINGS_FORMULAS.length +
    4 + // sales array formulas (K/L/N/O at row 10 each)
    4 * (SALES_LAST_ROW - SALES_BLOCK_START + 1); // I/J/M/P per-row

  return {
    installed: totalCells,
    details: [
      `04 업체관리: N2/O2/Q2 ARRAYFORMULA (3개)`,
      `01 영업관리: K${SALES_BLOCK_START}/L${SALES_BLOCK_START}/N${SALES_BLOCK_START}/O${SALES_BLOCK_START} ARRAYFORMULA (4개)`,
      `01 영업관리: I/J/M/P 컬럼 행 ${SALES_BLOCK_START}~${SALES_LAST_ROW} 개별 수식 (${(SALES_LAST_ROW - SALES_BLOCK_START + 1) * 4}개)`,
      `총 ${totalCells}개 셀`,
    ],
  };
}
