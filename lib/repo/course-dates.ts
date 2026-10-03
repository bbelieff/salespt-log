/**
 * Layer: repo — 개인 시트 O1(수강시작)·O2(종강총회) 날짜 쓰기 + 생성 리포트용 실측 읽기 (R3-5).
 * sales.ts 에서 분리(500줄 cap). 좌표 SSOT: docs/domains/sheet-structure.md §2, config startDateCell/graduationDateCell.
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

/** 셀 덮어쓰기 안전 검사(§2.5 bulk-write 가드, 2026-05-14 사고 후). empty·"=수식"=안전,
 * raw text/number=위험(보존). 기준: FORMULA mode read(수식은 "=..." 문자열, 일반값은 raw).
 * BBE-69(S1) 로 `lib/repo/setup-formulas.ts` 폐기 시 이 파일(유일한 외부 소비자)로 이전. */
export function isSafeToOverwrite(current: unknown): boolean {
  if (current === undefined || current === null || current === "") return true;
  if (typeof current === "string" && current.startsWith("=")) return true;
  return false;
}

/**
 * 순수 — FORMULA pre-read 한 O1/O2 현재값 + 새 start/grad 로 **쓸 셀 목록** 결정. 테스트 대상.
 * 원자성: O1·O2 를 한 쌍(O2=O1+50)으로만 확정. 둘 중 하나라도 raw(사용자값)면 **둘 다 보존**
 * (부분 덮어쓰기로 O1↔O2 어긋남 방지). start 빈값이면 무기록.
 */
export function planCourseDateWrite(input: {
  o1Cur: unknown;
  o2Cur: unknown;
  o1Cell: string;
  o2Cell: string;
  startISO: string;
  gradISO: string;
  /**
   * **갓 복제한 빈 시트 전용** — §2.5 보존 가드를 건너뛰고 덮어쓴다.
   * 복제본의 O1/O2 는 사용자가 쓴 값이 아니라 **템플릿에서 딸려온 이전 기수 날짜**라,
   * 보존하면 새 기수의 주차 앵커가 통째로 어긋난다(전광판·대시보드가 1~8주 밖으로 이탈).
   * 호출부가 "방금 copyTemplateSheet 로 만든 시트"임을 보증할 때만 true.
   */
  allowTemplateOverwrite?: boolean;
}): { writes: { cell: string; value: string }[]; preserved: string[] } {
  const start = String(input.startISO).trim();
  const grad = String(input.gradISO).trim();
  if (!start) return { writes: [], preserved: [] };
  const bothSafe =
    input.allowTemplateOverwrite === true ||
    (isSafeToOverwrite(input.o1Cur) && (!grad || isSafeToOverwrite(input.o2Cur)));
  if (!bothSafe) {
    return { writes: [], preserved: grad ? [input.o1Cell, input.o2Cell] : [input.o1Cell] };
  }
  const writes = [{ cell: input.o1Cell, value: start }];
  if (grad) writes.push({ cell: input.o2Cell, value: grad });
  return { writes, preserved: [] };
}

/**
 * O1(수강시작)·O2(종강총회)을 **리터럴 날짜**로 기록.
 *
 *  - O1/O2 는 rows 1~2 의 **입력 셀**(startDateCell/graduationDateCell) — 데이터행(10+)의
 *    funnel 수식(I~P, assertWritableCol 대상)과 무관. ADR-0005 "O2 직접값이 진실"에 따라
 *    O2 도 수식이 아닌 **리터럴**로 확정(레거시 `=O1+57` drift 방지). finalize-cohort9.mjs 선례.
 *  - valueInputOption=USER_ENTERED — ISO 문자열을 시트가 날짜(시리얼)로 인식(readCourseStart 파싱 전제).
 *  - **§2.5 bulk-write 가드**: 타겟 셀 FORMULA pre-read → raw 값(사용자 수기 날짜)이면 skip(보존),
 *    빈 셀·수식만 덮어쓴다 — 이미 사람이 넣은 날짜를 재생성이 지우지 않음.
 *
 * startISO 빈값이면 무기록(역호환). 반환: 실제 쓴/보존한 셀.
 */
export async function writeCourseDates(
  spreadsheetId: string,
  startISO: string,
  gradISO: string,
  opts?: {
    /** 갓 복제한 빈 시트에만 true — 템플릿에서 딸려온 옛 날짜를 덮어쓴다(planCourseDateWrite 참고). */
    allowTemplateOverwrite?: boolean;
  },
): Promise<{ written: string[]; preserved: string[] }> {
  const sid = String(spreadsheetId).trim();
  const start = String(startISO).trim();
  if (!sid || !start) return { written: [], preserved: [] };
  const tab = tabRef(SHEET_RANGES.sales.tab);
  const o1 = SHEET_RANGES.sales.startDateCell; // "O1"
  const o2 = SHEET_RANGES.sales.graduationDateCell; // "O2"

  // 가드: FORMULA 렌더로 pre-read (수식은 "=...", 일반값은 raw).
  const pre = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId: sid,
    ranges: [`${tab}!${o1}`, `${tab}!${o2}`],
    valueRenderOption: "FORMULA",
  });
  const plan = planCourseDateWrite({
    o1Cur: pre.data.valueRanges?.[0]?.values?.[0]?.[0],
    o2Cur: pre.data.valueRanges?.[1]?.values?.[0]?.[0],
    o1Cell: o1,
    o2Cell: o2,
    startISO: start,
    gradISO,
    allowTemplateOverwrite: opts?.allowTemplateOverwrite,
  });
  if (plan.writes.length > 0) {
    await sheetsClient().spreadsheets.values.batchUpdate({
      spreadsheetId: sid,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: plan.writes.map((w) => ({ range: `${tab}!${w.cell}`, values: [[w.value]] })),
      },
    });
  }
  return { written: plan.writes.map((w) => w.cell), preserved: plan.preserved };
}

/** 생성 리포트용 실측 셀값 — 시트에 **실제로 남아있는** 날짜·기수·이름. */
export interface CourseDateCells {
  /** O1 수강시작일 */
  o1: string;
  /** O2 종강총회 (템플릿 잔재면 `=O1+50` 같은 수식 문자열로 보인다) */
  o2: string;
  /** B3 기수 — 앱 표시 기수의 정본(me.ts 가 레지스트리보다 우선) */
  b3: string;
  /** C3 이름 */
  c3: string;
}

/**
 * 순수 — batchGet valueRanges(O1, O2, B3:C3) → 셀 문자열 4개. 테스트 대상.
 * 값이 없으면 "" (호출부가 "빈 셀"로 표시). 숫자·불리언도 문자열로 정규화.
 */
export function parseCourseDateCells(
  valueRanges: { values?: unknown[][] | null }[] | undefined,
): CourseDateCells {
  const cell = (i: number, j = 0): string => {
    const v = valueRanges?.[i]?.values?.[0]?.[j];
    return v === undefined || v === null ? "" : String(v).trim();
  };
  return { o1: cell(0), o2: cell(1), b3: cell(2, 0), c3: cell(2, 1) };
}

/**
 * O1·O2·B3·C3 를 **읽기 전용**으로 실측 (기수 생성 리포트 전용, R3-5 후속).
 *
 * 왜 필요한가: 날짜가 기록되지 않은 채 생성이 "성공"으로 끝나면(미입력·보존·예외) 시트에는
 * 템플릿(이전 기수) 값이 그대로 남는데, 지금까지 그 사실이 서버 로그에만 있었다. 실제로 남은
 * 값을 읽어 생성 결과 화면에 그대로 보여주기 위한 함수 — 쓰기는 하지 않는다.
 *
 * FORMULA 렌더인 이유: 템플릿 잔재 O2 는 `=O1+50` 수식이라, 계산값(날짜)이 아니라 수식 자체가
 * 보여야 운영자가 "이건 내가 넣은 날짜가 아니라 템플릿에서 딸려온 것"을 즉시 안다.
 */
export async function readCourseDateCells(
  spreadsheetId: string,
): Promise<CourseDateCells> {
  const sid = String(spreadsheetId).trim();
  if (!sid) return { o1: "", o2: "", b3: "", c3: "" };
  const tab = tabRef(SHEET_RANGES.sales.tab);
  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId: sid,
    ranges: [
      `${tab}!${SHEET_RANGES.sales.startDateCell}`,
      `${tab}!${SHEET_RANGES.sales.graduationDateCell}`,
      `${tab}!B3:C3`,
    ],
    valueRenderOption: "FORMULA",
  });
  return parseCourseDateCells(res.data.valueRanges);
}
