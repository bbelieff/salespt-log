/** Layer: service — 개별 trainee 시트 진단/픽스 카탈로그 (Hashimoto 누적 룰).
 *  RULES 배열에 push → admin TraineeCard [🔍 진단] / [🔧 fix] 자동 노출. */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "@/repo/sheets-client";
import {
  installFormulas,
  dayPrimaryRow,
  type InstallReport,
} from "@/repo/setup-formulas";
import { readAll as readContractPayments } from "@/repo/contract-payment";

const SALES_TAB = SHEET_RANGES.sales.tab;
const MEETINGS_TAB = SHEET_RANGES.meetings.tab;
const DASH_TAB = SHEET_RANGES.dashboard.tab;
const SALES_BLOCK_START = SHEET_RANGES.sales.blockStart;
const SALES_BLOCK_STRIDE = SHEET_RANGES.sales.blockStride;

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

export type DiagnosticSeverity = "info" | "warn" | "error";

export interface DiagnosticResult {
  ruleId: string;
  label: string;
  severity: DiagnosticSeverity;
  /** 사용자에게 표시할 추가 정보 (수치, 누락 row 수 등). */
  detail: string;
  /** true 이면 fix 함수 사용 가능 — UI 에 [🔧 fix] 버튼 노출. */
  fixable: boolean;
}

interface DiagnosticRule {
  id: string;
  label: string;
  severity: DiagnosticSeverity;
  /** issue 발견 시 DiagnosticResult, 정상이면 null. */
  detect: (spreadsheetId: string) => Promise<DiagnosticResult | null>;
  /** 자동 fix — 룰 detect 후 사용자가 [🔧 fix] 클릭 시 호출. */
  fix?: (spreadsheetId: string) => Promise<{ summary: string }>;
}

// Rule 1: 영업관리 수식 누락/옛 $C{r} 패턴. fix=installFormulas (raw 값 보존).
const ruleFormulaRestore: DiagnosticRule = {
  id: "formula-needs-restore",
  label: "영업관리 수식 누락/옛 패턴",
  severity: "error",
  async detect(spreadsheetId) {
    const range = `${tabRef(SALES_TAB)}!I${SALES_BLOCK_START}:I275`;
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "FORMULA",
    });
    const values = res.data.values ?? [];
    let missing = 0;
    let outdated = 0;
    // I 컬럼 224 data row 검사 (block 내 offset 0~27 만).
    for (let week = 0; week < 8; week++) {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        for (let channelIdx = 0; channelIdx < 4; channelIdx++) {
          const r =
            SALES_BLOCK_START +
            week * SALES_BLOCK_STRIDE +
            dayIdx * 4 +
            channelIdx;
          const valuesIdx = r - SALES_BLOCK_START;
          const cell = values[valuesIdx]?.[0];
          if (typeof cell !== "string" || cell === "") {
            missing++;
            continue;
          }
          // 옛 패턴 검사: $C{r} 직접 참조 (PR #202 이전)
          // 새 패턴: $C{dayPrimaryRow(r)} 참조 (PR #202)
          const dpr = dayPrimaryRow(r);
          // 매입DB row 는 r == dpr — 두 패턴 동일.
          // 비-매입DB row (직접생산/현수막/콜·지·기·소) 는 $C{r} vs $C{dpr} 다름.
          if (r !== dpr) {
            const hasOldRef = cell.includes(`$C${r})`) || cell.includes(`$C${r},`);
            const hasNewRef = cell.includes(`$C${dpr})`) || cell.includes(`$C${dpr},`);
            if (hasOldRef && !hasNewRef) outdated++;
          }
        }
      }
    }
    if (missing === 0 && outdated === 0) return null;
    const parts: string[] = [];
    if (missing > 0) parts.push(`수식 누락 ${missing}개 row`);
    if (outdated > 0) parts.push(`옛 \$C{r} 패턴 ${outdated}개 row (PR #202 이전)`);
    return {
      ruleId: this.id,
      label: this.label,
      severity: this.severity,
      detail: parts.join(", ") + " — [🔧 fix] 클릭 시 installFormulas 재실행 (raw 값 보존)",
      fixable: true,
    };
  },
  async fix(spreadsheetId): Promise<{ summary: string }> {
    const report: InstallReport = await installFormulas(spreadsheetId);
    return {
      summary:
        `수식 설치: ${report.installed}개 cell, 보존: ${report.preserved}개 cell` +
        (report.preservedCells.length > 0
          ? ` (${report.preservedCells.slice(0, 3).join(", ")}${report.preservedCells.length > 3 ? ", ..." : ""})`
          : ""),
    };
  },
};

// Rule 2: 영업관리 H 합계 vs 04 업체관리 미팅 row 수 불일치 (fix 없음).
const ruleMetricMeetingMismatch: DiagnosticRule = {
  id: "metric-vs-meeting-mismatch",
  label: "미팅예약 metric vs 업체관리 row 수 불일치",
  severity: "warn",
  async detect(spreadsheetId) {
    const M_REF = tabRef(MEETINGS_TAB);
    const [salesRes, meetingsRes] = await Promise.all([
      sheetsClient().spreadsheets.values.get({
        spreadsheetId,
        range: `${tabRef(SALES_TAB)}!H${SALES_BLOCK_START}:H275`,
        valueRenderOption: "UNFORMATTED_VALUE",
      }),
      sheetsClient().spreadsheets.values.get({
        spreadsheetId,
        range: `${M_REF}!B2:B1000`,
        valueRenderOption: "UNFORMATTED_VALUE",
      }),
    ]);
    const hValues = salesRes.data.values ?? [];
    let metricSum = 0;
    for (const row of hValues) {
      const v = row?.[0];
      if (typeof v === "number" && Number.isFinite(v)) metricSum += v;
    }
    const bValues = meetingsRes.data.values ?? [];
    let meetingRowCount = 0;
    for (const row of bValues) {
      const v = row?.[0];
      // 예약일 cell 이 값 있으면 미팅 row 로 카운트
      if (v !== undefined && v !== null && v !== "") meetingRowCount++;
    }
    if (metricSum === meetingRowCount) return null;
    return {
      ruleId: this.id,
      label: this.label,
      severity: this.severity,
      detail: `metric(H 합계)=${metricSum} vs 미팅 row=${meetingRowCount} (차이 ${Math.abs(metricSum - meetingRowCount)}) — 자동 fix 불가. 시트 수동 비교 필요`,
      fixable: false,
    };
  },
};

// Rule 3: O1/O2 (수강시작일/종강총회일) 유효성. fix 없음 (수동).
const ruleO1O2Validity: DiagnosticRule = {
  id: "o1-o2-validity",
  label: "O1/O2 (수강시작일/종강총회일) 유효성",
  severity: "warn",
  async detect(spreadsheetId) {
    const res = await sheetsClient().spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `${tabRef(SALES_TAB)}!O1`,
        `${tabRef(SALES_TAB)}!O2`,
      ],
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    const o1 = res.data.valueRanges?.[0]?.values?.[0]?.[0];
    const o2 = res.data.valueRanges?.[1]?.values?.[0]?.[0];
    const issues: string[] = [];
    if (o1 === undefined || o1 === null || o1 === "") issues.push("O1 비어있음");
    if (o2 === undefined || o2 === null || o2 === "") issues.push("O2 비어있음");
    if (typeof o1 === "number" && typeof o2 === "number") {
      const diff = o2 - o1;
      if (diff !== 50 && diff !== 57) {
        issues.push(`O2-O1=${diff}일 (예상: 50일 7기+ / 57일 6기)`);
      }
    }
    if (issues.length === 0) return null;
    return {
      ruleId: this.id,
      label: this.label,
      severity: this.severity,
      detail: issues.join(", ") + " — 시트 O1/O2 직접 확인·수정 필요",
      fixable: false,
    };
  },
};

// Rule 4: 04 업체관리 N/O/Q 수식 누락 (2026-05-16, 김선주/이장현 사고 추가 진단)
//
// 영업관리 I/J 수식이 04 업체관리!N/O 의 TEXTJOIN 결과. 04 업체관리 row 가
// 추가됐는데 N/O/Q 수식이 누락이면 영업관리 I/J 결과 비어 보임. 사용자 보고
// "미팅카드 생성해도 I/J 안 채워짐" root cause 진단용.
//
// detect: 04 업체관리 B/D (예약일/미팅날짜) 와 N/O/Q (수식 컬럼) FORMULA mode
//   read. 데이터 있는 row (B 또는 D 값 있음) 중 N/O/Q 가 수식 아닌 cell 카운트.
//   - 빈 cell: install 가능 (fix)
//   - raw 값: install 가드(isSafeToOverwrite)로 skip 됨 — 수동 정리 필요
//
// fix: installFormulas — 04 업체관리 N/O/Q 도 함께 처리됨 (raw 값 보존).
const ruleMeetingsFormulasMissing: DiagnosticRule = {
  id: "meetings-formulas-missing",
  label: "04 업체관리 표시 수식(N/O/Q) 누락",
  severity: "error",
  async detect(spreadsheetId) {
    const M_REF = tabRef(MEETINGS_TAB);
    const res = await sheetsClient().spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `${M_REF}!B2:B1000`,
        `${M_REF}!D2:D1000`,
        `${M_REF}!N2:N1000`,
        `${M_REF}!O2:O1000`,
        `${M_REF}!Q2:Q1000`,
      ],
      valueRenderOption: "FORMULA",
    });
    const ranges = res.data.valueRanges ?? [];
    const bCol = ranges[0]?.values ?? [];
    const dCol = ranges[1]?.values ?? [];
    const nCol = ranges[2]?.values ?? [];
    const oCol = ranges[3]?.values ?? [];
    const qCol = ranges[4]?.values ?? [];

    const isFormula = (v: unknown) =>
      typeof v === "string" && v.startsWith("=");
    const isEmpty = (v: unknown) =>
      v === undefined || v === null || v === "";
    const isRaw = (v: unknown) => !isFormula(v) && !isEmpty(v);
    const hasVal = (v: unknown) => !isEmpty(v);

    let dataRows = 0;
    let missingN = 0,
      missingO = 0,
      missingQ = 0;
    let rawN = 0,
      rawO = 0,
      rawQ = 0;

    for (let i = 0; i < 999; i++) {
      const b = bCol[i]?.[0];
      const d = dCol[i]?.[0];
      if (!hasVal(b) && !hasVal(d)) continue;
      dataRows++;
      const n = nCol[i]?.[0];
      const o = oCol[i]?.[0];
      const q = qCol[i]?.[0];
      if (!isFormula(n)) {
        if (isRaw(n)) rawN++;
        else missingN++;
      }
      if (!isFormula(o)) {
        if (isRaw(o)) rawO++;
        else missingO++;
      }
      if (!isFormula(q)) {
        if (isRaw(q)) rawQ++;
        else missingQ++;
      }
    }

    const totalMissing = missingN + missingO + missingQ;
    const totalRaw = rawN + rawO + rawQ;
    if (totalMissing === 0 && totalRaw === 0) return null;

    const parts: string[] = [];
    parts.push(`데이터 row ${dataRows}개`);
    if (totalMissing > 0) {
      parts.push(`수식 누락 N=${missingN} O=${missingO} Q=${missingQ}`);
    }
    if (totalRaw > 0) {
      parts.push(`raw 값 (fix 시 skip) N=${rawN} O=${rawO} Q=${rawQ}`);
    }
    const advice = totalMissing > 0
      ? "[🔧 fix] 가능 (빈 cell 만 install, raw 값 보존)"
      : "수동 정리 필요 (raw 값 보호 가드로 자동 install 불가)";
    return {
      ruleId: this.id,
      label: this.label,
      severity: this.severity,
      detail: parts.join(" — ") + ". " + advice,
      fixable: totalMissing > 0,
    };
  },
  async fix(spreadsheetId): Promise<{ summary: string }> {
    const report: InstallReport = await installFormulas(spreadsheetId);
    return {
      summary:
        `수식 설치: ${report.installed} cells, raw 값 보존: ${report.preserved} cells` +
        (report.preservedCells.length > 0
          ? ` (예: ${report.preservedCells.slice(0, 3).join(", ")}${report.preservedCells.length > 3 ? "..." : ""})`
          : ""),
    };
  },
};

// Rule 5: 대시보드 D21 매출 vs 02 계약수납관리 row 수임비 합 불일치
// (2026-05-16, "수납탭과 대시보드 매출합이 다름" 사고 추가 진단)
//
// 대시보드!D21 은 시트 수식. 일부 양식에서 N 행 합 범위가 잘못됐거나
// row 누락하는 케이스 발견 → 수납탭이 표시하는 동일 row 수임비 sum 과 어긋남.
// PR #206 로 service/dashboard.ts 는 이미 서버 sum 사용 — 본 룰은 시트 수식
// 자체가 오염되어 있는지 감지하기 위함 (시트 직접 보는 사용자가 혼란).
//
// detect: D21 (UNFORMATTED) vs readContractPayments(수임비) sum. 정수 비교.
// fix: 없음 (시트 수식 자동 수정은 위험 — admin 이 D21 수식 수동 조정).
const ruleRevenueMismatch: DiagnosticRule = {
  id: "revenue-mismatch",
  label: "대시보드 매출(D21) vs 02 계약수납관리 수임비 합 불일치",
  severity: "warn",
  async detect(spreadsheetId) {
    const [dashRes, payments] = await Promise.all([
      sheetsClient().spreadsheets.values.get({
        spreadsheetId,
        range: `${tabRef(DASH_TAB)}!D21`,
        valueRenderOption: "UNFORMATTED_VALUE",
      }),
      readContractPayments(spreadsheetId),
    ]);
    const d21Raw = dashRes.data.values?.[0]?.[0];
    const d21 = typeof d21Raw === "number" && Number.isFinite(d21Raw) ? d21Raw : 0;
    const serverSum = payments.reduce((s, p) => {
      const v = typeof p.수임비 === "number" && Number.isFinite(p.수임비) ? p.수임비 : 0;
      return s + v;
    }, 0);
    // round to integer (사용자 시트 단위 만 단위 / 정수 가정).
    const diff = Math.abs(d21 - serverSum);
    if (diff < 1) return null;
    return {
      ruleId: this.id,
      label: this.label,
      severity: this.severity,
      detail:
        `대시보드 D21=${d21.toLocaleString()} vs 02계약수납관리 수임비합=${serverSum.toLocaleString()}` +
        ` (차이 ${diff.toLocaleString()}, row ${payments.length}개). ` +
        `대시보드 KPI 는 서버 sum 사용 — 시트 D21 수식이 row 누락/범위 오류일 가능성. 시트 D21 수동 확인 필요`,
      fixable: false,
    };
  },
};

// Rule 6: 데이터 쓰기 영역과 충돌하는 셀병합 (detect-only, PR #229 declaw).
// 위험 = 데이터 row × 쓰기 컬럼이 교차하는 multi-row merge.
//   영업관리 E~H × row 10~277, 미팅/수납 data row (row>=2) multi-row.
// 제외: 가로 merge (헤더), C 열 날짜 묶음, header. fix 없음 (detect-only).
const SALES_FIRST_DATA_ROW0 = 9; // row 10 (0-based 9)
const SALES_LAST_DATA_ROW0 = 277; // row 278 (exclusive end)
const SALES_WRITE_COL_MIN = 4; // E (0-based)
const SALES_WRITE_COL_MAX = 8; // H+1 (exclusive)

function colToA1(idx0: number): string {
  let n = idx0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function rangeA1(sc: number, sr: number, ec: number, er: number): string {
  // sc/sr/ec/er = 0-based; ec/er = exclusive
  const startCol = colToA1(sc);
  const startRow = sr + 1;
  const endCol = colToA1(ec - 1);
  const endRow = er;
  if (sc === ec - 1 && sr === er - 1) return `${startCol}${startRow}`;
  return `${startCol}${startRow}:${endCol}${endRow}`;
}

const ruleSheetMerges: DiagnosticRule = {
  id: "sheet-merges-conflict",
  label: "데이터 쓰기 영역과 충돌하는 셀병합 (detect-only)",
  severity: "warn",
  async detect(spreadsheetId) {
    const res = await sheetsClient().spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title),merges)",
    });
    const sheets = res.data.sheets ?? [];
    const salesTab = SHEET_RANGES.sales.tab;
    const dataRowTabs = new Set([
      SHEET_RANGES.meetings.tab,
      SHEET_RANGES.contractPayment.tab,
      "02 계약관리",
    ]);
    const byTab: Record<string, string[]> = {};
    let total = 0;

    for (const sh of sheets) {
      const title = sh.properties?.title ?? "";
      const merges = sh.merges ?? [];
      if (merges.length === 0) continue;

      for (const m of merges) {
        const sr = m.startRowIndex;
        const er = m.endRowIndex;
        const sc = m.startColumnIndex;
        const ec = m.endColumnIndex;
        if (
          typeof sr !== "number" ||
          typeof er !== "number" ||
          typeof sc !== "number" ||
          typeof ec !== "number"
        ) continue;

        const rowSpan = er - sr;
        if (rowSpan <= 1) continue; // 가로 merge (헤더/라벨) — 무시

        let dangerous = false;
        if (title === salesTab) {
          // 영업관리: E~H × data row 와 교차하는 multi-row merge 만 위험
          const colsOverlap = sc < SALES_WRITE_COL_MAX && ec > SALES_WRITE_COL_MIN;
          const rowsOverlap = sr < SALES_LAST_DATA_ROW0 && er > SALES_FIRST_DATA_ROW0;
          if (colsOverlap && rowsOverlap) dangerous = true;
        } else if (dataRowTabs.has(title)) {
          // 미팅/수납: data row (row >= 2, 0-based >= 1) multi-row merge
          if (sr >= 1) dangerous = true;
        }

        if (!dangerous) continue;
        const a1 = rangeA1(sc, sr, ec, er);
        (byTab[title] ??= []).push(a1);
        total++;
      }
    }

    if (total === 0) return null;
    const parts = Object.entries(byTab).map(([t, arr]) => {
      const sample = arr.slice(0, 5).join(", ");
      const more = arr.length > 5 ? ` 외 ${arr.length - 5}개` : "";
      return `${t}: ${arr.length}개 (${sample}${more})`;
    });
    return {
      ruleId: this.id,
      label: this.label,
      severity: this.severity,
      detail:
        `데이터 쓰기 영역과 교차하는 multi-row 셀병합 ${total}개 — ${parts.join(" / ")}. ` +
        `자동 해제는 위험 (사용자 시각 디자인 파괴) — 시트에서 직접 확인·해제 권장. ` +
        `영업관리 C열 날짜 4-row 묶음 등은 정상이라 제외됨.`,
      fixable: false,
    };
  },
};

const RULES: DiagnosticRule[] = [
  ruleSheetMerges, // 2026-05-18 [6] — 다른 룰보다 먼저 검출 (셀병합은 다른 사고의 root cause)
  ruleFormulaRestore,
  ruleMeetingsFormulasMissing,
  ruleMetricMeetingMismatch,
  ruleO1O2Validity,
  ruleRevenueMismatch,
];

/**
 * 한 시트에 모든 룰 detect 실행 → 발견된 이슈 배열 반환.
 * 빈 배열 = 모든 룰 통과 = 시트 정상.
 */
export async function diagnoseSheet(
  spreadsheetId: string,
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  for (const rule of RULES) {
    try {
      const r = await rule.detect(spreadsheetId);
      if (r) results.push(r);
    } catch (e) {
      results.push({
        ruleId: rule.id,
        label: rule.label,
        severity: "error",
        detail: `진단 중 에러: ${e instanceof Error ? e.message : String(e)}`,
        fixable: false,
      });
    }
  }
  return results;
}

/**
 * 특정 룰의 fix 실행. ruleId 가 일치하는 룰을 찾아 fix 호출.
 * 룰 없거나 fix 미지원 시 throw.
 */
export async function fixSheet(
  spreadsheetId: string,
  ruleId: string,
): Promise<{ summary: string }> {
  const rule = RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
  if (!rule.fix) throw new Error(`Rule ${ruleId} 는 자동 fix 불가`);
  return rule.fix(spreadsheetId);
}
