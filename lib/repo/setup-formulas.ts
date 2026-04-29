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

// ── 04 업체관리 per-row 수식 ─────────────────────────────────────
// ARRAYFORMULA를 안 쓰는 이유: 한국 로케일 + 시트 잔재(checkbox/data validation
// 등) 환경에서 spill이 막혀 #REF! 발생. per-row IF로 가면 spill 자체가
// 필요 없어 #REF! 원천 차단.
const MEETINGS_LAST_ROW = 1000; // 최대 미팅 1000건 가정

function meetingsRowFormulas(r: number): {
  N: string;
  O: string;
  Q: string;
} {
  return {
    // N: 표시_상세 — 미팅날짜 포함 ("5/1, 14:00, 에이스, 잠실나루")
    N: `=IF(D${r}="","",TEXT(D${r},"M/d")&", "&TEXT(E${r},"HH:mm")&", "&G${r}&", "&H${r})`,
    // O: 표시_요약 — 미팅날짜 제외 ("14:00, 에이스, 잠실나루")
    O: `=IF(E${r}="","",TEXT(E${r},"HH:mm")&", "&G${r}&", "&H${r})`,
    // Q: 계약합성라인 — 상태가 "계약"일 때만
    Q: `=IF(J${r}="계약",G${r}&", "&L${r}&", "&P${r},"")`,
  };
}

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

  // 04 업체관리 — per-row 수식 (N2:N1000, O2:O1000, Q2:Q1000)
  // 한 번의 batchUpdate에 1000행 × 1컬럼 배열로 push.
  const nRows: string[][] = [];
  const oRows: string[][] = [];
  const qRows: string[][] = [];
  for (let r = 2; r <= MEETINGS_LAST_ROW; r++) {
    const f = meetingsRowFormulas(r);
    nRows.push([f.N]);
    oRows.push([f.O]);
    qRows.push([f.Q]);
  }
  data.push(
    { range: `${M_REF}!N2:N${MEETINGS_LAST_ROW}`, values: nRows },
    { range: `${M_REF}!O2:O${MEETINGS_LAST_ROW}`, values: oRows },
    { range: `${M_REF}!Q2:Q${MEETINGS_LAST_ROW}`, values: qRows },
  );

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
      `04 업체관리: N/O/Q 컬럼 per-row 수식 (각 ${MEETINGS_LAST_ROW - 1}행)`,
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
  // ── 1단계: 업체관리 N/O/Q 컬럼 비우기 (batchClear — 진짜 빈 셀) ─
  // 범위는 install이 쓰는 N2:N1000과 정확히 매칭.
  const meetingsRanges = [
    `${M_REF}!N2:N${MEETINGS_LAST_ROW}`,
    `${M_REF}!O2:O${MEETINGS_LAST_ROW}`,
    `${M_REF}!Q2:Q${MEETINGS_LAST_ROW}`,
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
