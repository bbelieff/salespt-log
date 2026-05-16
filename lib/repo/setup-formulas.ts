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

// ── 데이터 행 식별 (deterministic — 2026-05-16) ──────────────────
//
// 영업관리 레이아웃은 박힌 공식이다 (PR #192 `salesRowFor`와 동일):
//   row = blockStart(10) + week * blockStride(34) + dayIdx * 4 + channelIdx
// 매 주 28 data rows (7일 × 4채널) → 총 224 rows (8주).
//
// **2026-05-16 변경 (6기 셀병합 사고)**: 이전 구현은 C 컬럼을 sheets API 로
// 읽어 number(date serial) 인 row 만 데이터 행으로 인식했다. 그런데 6기 이월
// 시트 다수가 영업관리 C 컬럼에 **cell 병합** (예: C10:C13 = 매주 1일치 4채널
// row 가 같은 날짜로 visually 표시) 으로 셋업됨. sheets API 의 values.get 은
// 병합 non-primary cell 을 empty 로 반환 → 매입DB row (각 day 의 첫 row) 만
// 데이터 행으로 인식 → installFormulas 가 4채널 중 1채널만 처리.
// 결과: 김선주/이장현 미팅카드 → 영업관리 I 열 매입DB row 만 동작, 나머지
// 3채널 row 누락 사고 (2026-05-16 시연 중 발견).
//
// → C 컬럼 read 제거. 박힌 공식으로 결정적 row 생성. 시트 cell 병합 여부와
// 무관하게 224 rows 모두 install 시도. raw 값 cell 은 `isSafeToOverwrite` 가
// 여전히 skip (사용자 작성값 보존). 합계/헤더 row 는 공식상 범위 밖이라 자연
// 제외 (week 마다 0..27 offset 만 사용, 28..33 은 합계/헤더).
export function computeDataRows(): number[] {
  const rows: number[] = [];
  for (let week = 0; week < 8; week++) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      for (let channelIdx = 0; channelIdx < 4; channelIdx++) {
        rows.push(
          SALES_BLOCK_START + week * SALES_BLOCK_STRIDE + dayIdx * 4 + channelIdx,
        );
      }
    }
  }
  return rows;
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
  preserved: number;
  preservedCells: string[];
  details: string[];
}

/**
 * 셀 값이 덮어쓰기 안전한지 검사. 단위 테스트용으로 export.
 *   - empty/null/"" → 안전 (쓸 곳 없음)
 *   - "=..." formula → 안전 (옛 수식 → 새 수식 교체)
 *   - 그 외 (raw text, number) → **위험** (사용자 수동 입력 보존 필요)
 *
 * Sheets API `valueRenderOption: "FORMULA"` 로 read 한 결과 기준.
 *   - FORMULA mode 는 수식은 그대로 "=..." 문자열 반환, 일반 값은 raw.
 */
export function isSafeToOverwrite(current: unknown): boolean {
  if (current === undefined || current === null || current === "") return true;
  if (typeof current === "string" && current.startsWith("=")) return true;
  return false;
}

/**
 * 시트에 모든 자동 집계 수식을 일괄 설치 (안전 모드 v2 — 2026-05-14 사고 후).
 * 멱등(idempotent) — 다시 호출해도 같은 수식으로 덮어씀.
 *
 * **사용자 데이터 보호 (2026-05-14)**: 옛 기수의 admin 수동 백필 데이터가
 * 영업관리 I/J/K/L/N/O 에 raw text 로 들어가 있던 케이스를 v1 이 덮어써 사고
 * 발생. v2 는 각 타겟 셀을 **FORMULA mode 로 pre-read** 해 raw 값이 있으면
 * skip + report `preservedCells` 에 누적. 수식·빈 셀만 덮어씀.
 */
export async function installFormulas(
  spreadsheetId: string,
): Promise<InstallReport> {
  const dataRows = computeDataRows();

  // Pre-read: FORMULA mode 로 타겟 범위 현재 내용 가져옴.
  //   - 04 업체관리 N/O/Q 컬럼 (1~1000행).
  //   - 01 영업관리 I~P 컬럼 (데이터 행만).
  const [meetingsExisting, salesExisting] = await Promise.all([
    sheetsClient().spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `${M_REF}!N2:N${MEETINGS_LAST_ROW}`,
        `${M_REF}!O2:O${MEETINGS_LAST_ROW}`,
        `${M_REF}!Q2:Q${MEETINGS_LAST_ROW}`,
      ],
      valueRenderOption: "FORMULA",
    }),
    dataRows.length > 0
      ? sheetsClient().spreadsheets.values.get({
          spreadsheetId,
          range: `${tabRef(SALES_TAB)}!I${SALES_BLOCK_START}:P${SALES_LAST_ROW}`,
          valueRenderOption: "FORMULA",
        })
      : Promise.resolve(null),
  ]);

  const nExisting = meetingsExisting.data.valueRanges?.[0]?.values ?? [];
  const oExisting = meetingsExisting.data.valueRanges?.[1]?.values ?? [];
  const qExisting = meetingsExisting.data.valueRanges?.[2]?.values ?? [];
  const salesExistingRows = salesExisting?.data.values ?? [];

  const data: Array<{ range: string; values: string[][] }> = [];
  const preservedCells: string[] = [];

  // 04 업체관리 — per-cell guard.
  for (let r = 2; r <= MEETINGS_LAST_ROW; r++) {
    const i = r - 2;
    const f = meetingsRowFormulas(r);
    const nCur = nExisting[i]?.[0];
    const oCur = oExisting[i]?.[0];
    const qCur = qExisting[i]?.[0];
    if (isSafeToOverwrite(nCur)) {
      data.push({ range: `${M_REF}!N${r}`, values: [[f.N]] });
    } else {
      preservedCells.push(`업체관리 N${r}`);
    }
    if (isSafeToOverwrite(oCur)) {
      data.push({ range: `${M_REF}!O${r}`, values: [[f.O]] });
    } else {
      preservedCells.push(`업체관리 O${r}`);
    }
    if (isSafeToOverwrite(qCur)) {
      data.push({ range: `${M_REF}!Q${r}`, values: [[f.Q]] });
    } else {
      preservedCells.push(`업체관리 Q${r}`);
    }
  }

  // 01 영업관리 — 데이터 행만, per-cell guard.
  // salesExistingRows[i] 의 컬럼 인덱스: I=0, J=1, K=2, L=3, M=4, N=5, O=6, P=7.
  const COL_IDX: Record<string, number> = {
    I: 0,
    J: 1,
    K: 2,
    L: 3,
    M: 4,
    N: 5,
    O: 6,
    P: 7,
  };
  for (const r of dataRows) {
    const formulas = formulasForRow(r);
    const rowIdx = r - SALES_BLOCK_START;
    const rowVals = salesExistingRows[rowIdx] ?? [];
    for (const col of SALES_FORMULA_COLS) {
      const current = rowVals[COL_IDX[col]!];
      if (isSafeToOverwrite(current)) {
        data.push({
          range: `${tabRef(SALES_TAB)}!${col}${r}`,
          values: [[formulas[col]!]],
        });
      } else {
        preservedCells.push(`영업관리 ${col}${r}`);
      }
    }
  }

  if (data.length > 0) {
    await sheetsClient().spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });
  }

  return {
    installed: data.length,
    preserved: preservedCells.length,
    preservedCells,
    details: [
      `04 업체관리: N/O/Q 컬럼 ${MEETINGS_LAST_ROW - 1}행 검사`,
      `01 영업관리: 데이터 행 ${dataRows.length}개 × 8 컬럼 (I~P) 검사`,
      `사용자 수동 입력 (raw text/number) ${preservedCells.length}개 셀 보존 — 수식·빈 셀만 덮어씀`,
    ],
  };
}

/**
 * 모든 설치된 수식을 제거 (안전 모드 v2 — 2026-05-14 사고 후).
 *
 * v1 은 N/O/Q + I~P 전 범위 batchClear 라 사용자 raw 입력값도 같이 날렸음 (install
 * 사고와 동일 패턴). v2 는 install 과 동일하게 셀별 pre-read 후 raw 값 cell 은
 * skip — **수식만 비우고 사용자 작성값은 보존**.
 *
 * 클리어 범위:
 *   - 04 업체관리: N2:N, O2:O, Q2:Q
 *   - 01 영업관리: 데이터행 I~P (합계행은 안 건드림 — computeDataRows 가 박힌 공식으로 식별)
 *
 * **CLAUDE.md §2 규칙 5**: 모든 bulk-write 는 user raw 데이터 보존 의무.
 */
export async function uninstallFormulas(
  spreadsheetId: string,
): Promise<{ cleared: number; preserved: number; preservedCells: string[] }> {
  const dataRows = computeDataRows();

  // Pre-read FORMULA mode — install 과 동일 패턴.
  const [meetingsExisting, salesExisting] = await Promise.all([
    sheetsClient().spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `${M_REF}!N2:N${MEETINGS_LAST_ROW}`,
        `${M_REF}!O2:O${MEETINGS_LAST_ROW}`,
        `${M_REF}!Q2:Q${MEETINGS_LAST_ROW}`,
      ],
      valueRenderOption: "FORMULA",
    }),
    dataRows.length > 0
      ? sheetsClient().spreadsheets.values.get({
          spreadsheetId,
          range: `${tabRef(SALES_TAB)}!I${SALES_BLOCK_START}:P${SALES_LAST_ROW}`,
          valueRenderOption: "FORMULA",
        })
      : Promise.resolve(null),
  ]);

  const nExisting = meetingsExisting.data.valueRanges?.[0]?.values ?? [];
  const oExisting = meetingsExisting.data.valueRanges?.[1]?.values ?? [];
  const qExisting = meetingsExisting.data.valueRanges?.[2]?.values ?? [];
  const salesExistingRows = salesExisting?.data.values ?? [];

  // batchClear 는 단위가 range — 각 cell 단위로 clear 필요 시 개별 range 로 push.
  const clearRanges: string[] = [];
  const preservedCells: string[] = [];

  // 04 업체관리 — per-cell 검사.
  for (let r = 2; r <= MEETINGS_LAST_ROW; r++) {
    const i = r - 2;
    if (isSafeToOverwrite(nExisting[i]?.[0])) {
      clearRanges.push(`${M_REF}!N${r}`);
    } else {
      preservedCells.push(`업체관리 N${r}`);
    }
    if (isSafeToOverwrite(oExisting[i]?.[0])) {
      clearRanges.push(`${M_REF}!O${r}`);
    } else {
      preservedCells.push(`업체관리 O${r}`);
    }
    if (isSafeToOverwrite(qExisting[i]?.[0])) {
      clearRanges.push(`${M_REF}!Q${r}`);
    } else {
      preservedCells.push(`업체관리 Q${r}`);
    }
  }

  // 01 영업관리 데이터 행 — per-cell 검사.
  const COL_IDX: Record<string, number> = {
    I: 0, J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7,
  };
  for (const r of dataRows) {
    const rowIdx = r - SALES_BLOCK_START;
    const rowVals = salesExistingRows[rowIdx] ?? [];
    for (const col of SALES_FORMULA_COLS) {
      const current = rowVals[COL_IDX[col]!];
      if (isSafeToOverwrite(current)) {
        clearRanges.push(`${tabRef(SALES_TAB)}!${col}${r}`);
      } else {
        preservedCells.push(`영업관리 ${col}${r}`);
      }
    }
  }

  if (clearRanges.length > 0) {
    await sheetsClient().spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: clearRanges },
    });
  }

  return {
    cleared: clearRanges.length,
    preserved: preservedCells.length,
    preservedCells,
  };
}
