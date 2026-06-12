/**
 * 시트 수식 일괄 설치/제거 (시트 셋업 1회). ARRAYFORMULA 금지(합계행 보호),
 * 데이터 행에만 per-row 수식, 합계/헤더/빈 행 미작성, raw 값 보존(isSafeToOverwrite).
 * 대상: 04 업체관리 N/O/Q, 01 영업관리 I~P(데이터행) + 미팅예약/완료 펀넬(R4:U5,F4:F5).
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

// ── 영업관리 D 채널 라벨 정상화 (2026-05-18 하이픈 사고) — "콜-지-기-소"(hyphen)
// 가 enum "콜·지·기·소"(middle dot) 와 불일치 → I/J/K 매칭 0. install 이 라벨도 정상화.
const CHANNEL_LABELS = ["매입DB", "직접생산", "현수막", "콜·지·기·소"] as const;

/** 채널 라벨 비교용 — 모든 separator (middle dot 류 + hyphen 류) 제거. */
function normalizeChannelSep(s: string): string {
  // separator 단일 문자 — unicode escape 사용 (범위 해석 회피).
  // U+00B7 · / U+2027 ‧ / U+30FB ・ / U+318D ㆍ /
  // U+002D - / U+2010 ‐ / U+2011 ‑ / U+2012 ‒ / U+2013 – / U+2014 —
  return s
    .replace(/[-·‧・ㆍ‐‑‒–—]/g, "")
    .trim();
}

/**
 * D 컬럼 라벨 cell 을 정상 라벨로 덮어써도 안전한지 판단.
 *   - 빈 cell / 수식 → 덮어쓰기
 *   - 이미 정확한 라벨 → skip (write 안 함)
 *   - separator 만 다른 stale variant ("콜-지-기-소") → 덮어쓰기
 *   - 그 외 raw text → 보존 (사용자가 의도적으로 다른 텍스트 박은 경우)
 */
export function shouldFixChannelLabel(current: unknown, expected: string): boolean {
  if (current === undefined || current === null || current === "") return true;
  if (typeof current !== "string") return false;
  if (current === expected) return false;
  if (current.startsWith("=")) return true;
  return normalizeChannelSep(current) === normalizeChannelSep(expected);
}

// ── 04 업체관리 per-row 수식 — ARRAYFORMULA 금지(로케일·잔재로 spill 막혀
// #REF!). per-row IF 로 원천 차단. ─────────────────────────────
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

// 데이터 행 식별(deterministic — 2026-05-16 셀병합 사고 후 C-read 제거):
// row = 10 + week*34 + dayIdx*4 + chIdx, 224행. raw 값은 isSafeToOverwrite 가 skip.
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

/**
 * 4채널 일별 블록의 매입DB row(primary date cell) 계산. 모든 수식이 $C{dpr} 참조 →
 * 6기 C-컬럼 셀병합(non-primary cell empty) 사고에도 날짜 매칭 정확(2026-05-16 이장현 fix).
 * dpr = blockStart + floor((r-blockStart)/stride)*stride + floor(((r-blockStart)%stride)/4)*4
 */
export function dayPrimaryRow(r: number): number {
  const blockIdx = Math.floor(
    (r - SALES_BLOCK_START) / SALES_BLOCK_STRIDE,
  );
  const posInBlock = (r - SALES_BLOCK_START) % SALES_BLOCK_STRIDE;
  const dayIdx = Math.floor(posInBlock / 4);
  return SALES_BLOCK_START + blockIdx * SALES_BLOCK_STRIDE + dayIdx * 4;
}

// ── 영업관리 한 행에 들어갈 8개 수식 ─────────────────────────────
export function formulasForRow(r: number): Record<string, string> {
  // SORT(FILTER(...)) 패턴 — 같은 셀 내 라인은 시간 빠른 것이 위로
  // (TEXT(D,"M/d")&", "&TEXT(E,"HH:MM")&... 형식이라 lex sort = 시간순 sort)
  //
  // **$C 좌표는 dayPrimaryRow 사용 (2026-05-16 cell-merge fix)** — 자세한 이유는
  // 위 dayPrimaryRow JSDoc 참조. $D{r} 은 r 그대로 (채널 라벨은 row 별 고유).
  const dpr = dayPrimaryRow(r);
  // 콜·지·기·소(channelIdx 3) 계약 매칭 fix (2026-06, 밤볼 콜지기소 계약 미집계 사고):
  // N/O/P 는 `04!F:F=$D{r}` 정확매칭인데, 04!F 채널값이 separator 변종("콜-지-기-소" 등)
  // 이면 매칭 실패 → 계약건수/수임비 0. (완료수 L 은 F 필터가 없어 잡혀 증상이 N/O 만 0.)
  // D 라벨은 setDChannelLabels 가 정규화하지만 04!F(미팅 데이터)는 raw 보존이라 못 고침.
  // → 콜지기소 행만 separator-무관 매칭: COUNTIFS/SUMIFS 와일드카드 "콜*소",
  //   FILTER 는 LEFT(F,1)="콜". 다른 3채널은 separator 없어 정확매칭 유지(오매칭 0).
  const channelIdx = ((r - SALES_BLOCK_START) % SALES_BLOCK_STRIDE) % 4;
  const isKjks = channelIdx === 3;
  const chCrit = isKjks ? `"콜*소"` : `$D${r}`;
  const chCond = isKjks
    ? `(LEFT(${M_REF}!F:F,1)="콜")`
    : `(${M_REF}!F:F=$D${r})`;
  return {
    // I: 미팅예약기록 — 04업체관리!B(예약일)=$C{dpr}, F(채널)=$D{r}, !N(표시상세) TEXTJOIN
    I: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,SORT(FILTER(${M_REF}!N:N,(${M_REF}!B:B=$C${dpr})*(${M_REF}!F:F=$D${r})))),"")`,
    // J: 오늘미팅일정 — 04업체관리!D(미팅날짜)=$C{dpr}. 채널 필터 X.
    // 영업관리 J{dpr}:J{dpr+3} 4채널 row 가 셀병합되어 통합 일정표로 표시되는 디자인.
    // 채널별 필터링 시 셀병합 마스터 row 의 채널만 표시 → 다른 3채널 미팅 누락
    // (2026-05-18 사고: 매입DB row 마스터 → 콜지기소 등 다른 채널 J 결과 누락).
    // 4 row 모두 동일 수식 install — 셀병합 마스터에 통합 결과 표시.
    J: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,SORT(FILTER(${M_REF}!O:O,${M_REF}!D:D=$C${dpr}))),"")`,
    // K: 오늘미팅수 — 미팅날짜 매칭 + 이월(AO) 제외 (arena-carryover §4).
    K: `=COUNTIFS(${M_REF}!D:D,$C${dpr},${M_REF}!AO:AO,"<>이월")`,
    // L: 미팅완료수 — 미팅날짜 매칭 + **상태 필터(완료·계약만)** + 이월 제외.
    // ⚠️ 상태필터 필수: 제거하면 예약(미래 미팅)까지 완료로 세져 미팅완료=미팅예약·
    //    미팅실행률 100% 사고 (2026-06-09 진단). K(오늘미팅수)와 같아지면 안 됨.
    //    가드: tests/repo/setup-formulas-guard.test.ts "미팅완료(L) 상태필터".
    L: `=COUNTIFS(${M_REF}!D:D,$C${dpr},${M_REF}!J:J,"계약",${M_REF}!AO:AO,"<>이월")+COUNTIFS(${M_REF}!D:D,$C${dpr},${M_REF}!J:J,"완료",${M_REF}!AO:AO,"<>이월")`,
    M: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!M:M,${M_REF}!D:D=$C${dpr})),"")`,
    N: `=COUNTIFS(${M_REF}!D:D,$C${dpr},${M_REF}!F:F,${chCrit},${M_REF}!J:J,"계약",${M_REF}!AO:AO,"<>이월")`,
    O: `=SUMIFS(${M_REF}!L:L,${M_REF}!D:D,$C${dpr},${M_REF}!F:F,${chCrit},${M_REF}!J:J,"계약",${M_REF}!AO:AO,"<>이월")`,
    P: `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${M_REF}!Q:Q,(${M_REF}!D:D=$C${dpr})*${chCond}*(${M_REF}!J:J="계약"))),"")`,
  };
}

// 02!D3 수납총액(대시보드 수수료·총매출 원천) 이월 제외 가드 — 원본
// `=sum(Q6:Q36,W:W,AC:AC)` 가 이월 수납 합산(2026-06-12 leak). Q 36행 한정도 정상화.
const CONTRACT_TAB = "02 계약수납관리";
const CP_D3_FORMULA =
  '=SUMIFS(Q6:Q,$AI$6:$AI,"<>이월")+SUMIFS(W6:W,$AI$6:$AI,"<>이월")+SUMIFS(AC6:AC,$AI$6:$AI,"<>이월")';

// 미팅예약/완료 펀넬·채널 stacking (01 R4:U5+F4:F5) — 04 상태기반 (2026-06-09 A안,
// 미팅실행률 100% 착시 fix). 미팅예약=상태∈{예약,완료,계약}(변경/취소 제외, 미래 포함),
// 미팅완료=상태∈{완료,계약} → 예약 ≥ 완료, I5=F5/F4 정상화. 채널=04.F
// (콜지기소 "콜*소" 와일드카드 #319). stacking 열 R=매입DB S=직접생산 T=현수막 U=콜지기소.
export function meetingFunnelFormulas(): Record<string, string> {
  const M = M_REF;
  const COLS = ["R", "S", "T", "U"] as const;
  const CH = ['"매입DB"', '"직접생산"', '"현수막"', '"콜*소"']; // R~U 채널 criteria
  const cif = (c: string, s: string) =>
    `COUNTIFS(${M}!F:F,${c},${M}!J:J,"${s}",${M}!AO:AO,"<>이월")`; // 이월 제외 (carryover §4)
  const reserved = (c: string) =>
    `=${cif(c, "예약")}+${cif(c, "완료")}+${cif(c, "계약")}`;
  const done = (c: string) => `=${cif(c, "완료")}+${cif(c, "계약")}`;
  const out: Record<string, string> = {};
  COLS.forEach((col, i) => {
    out[`${col}4`] = reserved(CH[i]!); // 미팅예약 (채널별)
    out[`${col}5`] = done(CH[i]!); // 미팅완료 (채널별)
  });
  out["F4"] = "=SUM(R4:U4)"; // 펀넬 미팅예약 = 채널 합
  out["F5"] = "=SUM(R5:U5)"; // 펀넬 미팅완료 = 채널 합
  return out;
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
  //   - 01 영업관리 I~P 컬럼 (데이터 행만) + D 컬럼 채널 라벨.
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
      ? sheetsClient().spreadsheets.values.batchGet({
          spreadsheetId,
          ranges: [
            `${tabRef(SALES_TAB)}!I${SALES_BLOCK_START}:P${SALES_LAST_ROW}`,
            `${tabRef(SALES_TAB)}!D${SALES_BLOCK_START}:D${SALES_LAST_ROW}`,
          ],
          valueRenderOption: "FORMULA",
        })
      : Promise.resolve(null),
  ]);

  const nExisting = meetingsExisting.data.valueRanges?.[0]?.values ?? [];
  const oExisting = meetingsExisting.data.valueRanges?.[1]?.values ?? [];
  const qExisting = meetingsExisting.data.valueRanges?.[2]?.values ?? [];
  const salesExistingRows = salesExisting?.data.valueRanges?.[0]?.values ?? [];
  const salesDLabels = salesExisting?.data.valueRanges?.[1]?.values ?? [];

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
    // D 컬럼 채널 라벨 정상화 (콜·지·기·소 하이픈 사고 fix, 2026-05-18).
    const posInBlock = (r - SALES_BLOCK_START) % SALES_BLOCK_STRIDE;
    const channelIdx = posInBlock % 4;
    const expectedLabel = CHANNEL_LABELS[channelIdx]!;
    const dCur = salesDLabels[rowIdx]?.[0];
    if (shouldFixChannelLabel(dCur, expectedLabel)) {
      if (dCur !== expectedLabel) {
        data.push({
          range: `${tabRef(SALES_TAB)}!D${r}`,
          values: [[expectedLabel]],
        });
      }
    } else if (typeof dCur === "string" && dCur !== expectedLabel) {
      preservedCells.push(`영업관리 D${r} (=${dCur})`);
    }
  }

  // 영업관리 M3:M5 비율 수식 (생산효율 — 03 DB관리 합계행 / L3~L5).
  // 2026-05-18 추가 — 사용자가 시트 작업 중 실수로 지우는 사고 방지 (수식복원에 포함).
  // L3~L5 의 분모 / 03 DB관리 채널 sum 의 분자. raw 값 있으면 보존.
  const M345_FORMULAS: Record<number, string> = {
    3: "='03 DB관리'!F56/L3",
    4: "='03 DB관리'!K56/L4",
    5: "='03 DB관리'!U56/L5",
  };
  const m345Res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(SALES_TAB)}!M3:M5`,
    valueRenderOption: "FORMULA",
  });
  const m345Existing = m345Res.data.values ?? [];
  for (let i = 0; i < 3; i++) {
    const r = 3 + i;
    const cur = m345Existing[i]?.[0];
    if (isSafeToOverwrite(cur)) {
      data.push({
        range: `${tabRef(SALES_TAB)}!M${r}`,
        values: [[M345_FORMULAS[r]!]],
      });
    } else {
      preservedCells.push(`영업관리 M${r}`);
    }
  }

  // 미팅예약/완료 펀넬·채널 stacking (R4:U5 + F4:F5) — 04 상태기반 (2026-06-09).
  const funnel = meetingFunnelFormulas();
  const ST = tabRef(SALES_TAB);
  const funnelCells = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${ST}!R4:U5`, `${ST}!F4:F5`],
    valueRenderOption: "FORMULA",
  });
  const stkExisting = funnelCells.data.valueRanges?.[0]?.values ?? []; // [[R4..U4],[R5..U5]]
  const fExisting = funnelCells.data.valueRanges?.[1]?.values ?? []; // [[F4],[F5]]
  const COLS = ["R", "S", "T", "U"];
  for (let rowI = 0; rowI < 2; rowI++) {
    const r = 4 + rowI;
    COLS.forEach((col, ci) => {
      const cur = stkExisting[rowI]?.[ci];
      if (isSafeToOverwrite(cur)) {
        data.push({ range: `${ST}!${col}${r}`, values: [[funnel[`${col}${r}`]!]] });
      } else {
        preservedCells.push(`영업관리 ${col}${r}`);
      }
    });
  }
  for (let i = 0; i < 2; i++) {
    const r = 4 + i;
    const cur = fExisting[i]?.[0];
    if (isSafeToOverwrite(cur)) {
      data.push({ range: `${ST}!F${r}`, values: [[funnel[`F${r}`]!]] });
    } else {
      preservedCells.push(`영업관리 F${r}`);
    }
  }

  // 02!D3 수납총액 — 이월 제외 가드 수식 (§2.5 pre-read: raw 값이면 보존).
  const cpD3 = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(CONTRACT_TAB)}!D3`,
    valueRenderOption: "FORMULA",
  });
  const curD3 = cpD3.data.values?.[0]?.[0];
  if (isSafeToOverwrite(curD3)) {
    data.push({ range: `${tabRef(CONTRACT_TAB)}!D3`, values: [[CP_D3_FORMULA]] });
  } else {
    preservedCells.push("02 계약수납 D3");
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
      `02 계약수납: D3(수납총액) 이월 제외 가드`,
      `사용자 수동 입력 (raw text/number) ${preservedCells.length}개 셀 보존 — 수식·빈 셀만 덮어씀`,
    ],
  };
}

/**
 * 설치 수식 제거 v2(2026-05-14 사고 후) — install 과 동일하게 셀별 pre-read,
 * raw 값 skip(수식만 비움). 범위: 04 N/O/Q + 01 데이터행 I~P. CLAUDE.md §2-5.
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
