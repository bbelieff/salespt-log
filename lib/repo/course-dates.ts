/**
 * Layer: repo — 개인 시트 O1(수강시작)·O2(종강총회) 날짜 쓰기 (R3-5, 기수 생성/재시도용).
 * sales.ts 에서 분리(500줄 cap). 좌표 SSOT: docs/domains/sheet-structure.md §2, config startDateCell/graduationDateCell.
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";
import { isSafeToOverwrite } from "./setup-formulas";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
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
}): { writes: { cell: string; value: string }[]; preserved: string[] } {
  const start = String(input.startISO).trim();
  const grad = String(input.gradISO).trim();
  if (!start) return { writes: [], preserved: [] };
  const bothSafe =
    isSafeToOverwrite(input.o1Cur) && (!grad || isSafeToOverwrite(input.o2Cur));
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
