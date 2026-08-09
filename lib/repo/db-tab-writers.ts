/**
 * Layer: repo — 03 DB관리 4섹션 시트 셀 쓰기 공용 헬퍼.
 * db.ts(append)·db-write.ts(update/clear) 양쪽이 공유(500줄 캡 분리, BBE-59 부수 — 순환참조 회피:
 * 이 파일은 형제 파일들을 참조하지 않아 db.ts ↔ db-write.ts 사이에 사이클이 생기지 않는다).
 */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

const TAB = SHEET_RANGES.dbManagement.tab;

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

export const T = tabRef(TAB);

export interface SectionWriteSpec {
  startCol: string;
  endCol: string;
  /** idx → (row) → "=D4*E4" 수식 문자열. web이 직접 박아넣어 시트 템플릿 의존 제거. */
  formulas: Record<number, (row: number) => string>;
}

// §3-A: 부가세여부=매입DB F·현수막 U·직접생산 N. 주문금액·개당단가 미저장(계산값). 직접생산 I:O 재배치.
export const SPEC = {
  매입DB: { startCol: "B", endCol: "H", formulas: {} },
  직접생산: { startCol: "I", endCol: "O", formulas: {} },
  현수막: { startCol: "P", endCol: "W", formulas: {} },
  콜지기소: { startCol: "X", endCol: "AD", formulas: {} },
} as const satisfies Record<string, SectionWriteSpec>;

export async function writeRow(
  spreadsheetId: string,
  spec: SectionWriteSpec,
  row: number,
  values: (string | number | boolean)[],
): Promise<void> {
  // 수식 컬럼은 spec.formulas에 정의된 수식 문자열로 치환 (시트 템플릿 누락 방지).
  const out = values.map((v, i) => {
    const formulaFor = spec.formulas[i];
    return formulaFor ? formulaFor(row) : v;
  });
  const range = `${T}!${spec.startCol}${row}:${spec.endCol}${row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [out] },
  });
}

export async function clearRowRange(
  spreadsheetId: string,
  spec: SectionWriteSpec,
  row: number,
): Promise<void> {
  const range = `${T}!${spec.startCol}${row}:${spec.endCol}${row}`;
  await sheetsClient().spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}
