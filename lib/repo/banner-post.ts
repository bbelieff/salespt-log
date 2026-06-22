/**
 * Layer: repo — 03 DB관리 현수막 게시 로그 (AF:AI, 1:N). ADR-0023.
 * 주문(P:V) 1건에 게시 N건. 게시id(AF)·주문ref(AG)·게시일(AH)·게시수(AI). row 단위 CRUD.
 * §2.5: append 는 게시일·게시id 모두 빈 행에만 → 타 사용자값 비침범. update/clear 는 명시 row.
 */
import { SHEET_RANGES } from "@/config";
import type { DBBannerPost } from "@/types";
import { sheetsClient, ensureGridColumns } from "./sheets-client";

const TAB = SHEET_RANGES.dbManagement.tab;
const FIRST = SHEET_RANGES.dbManagement.headerRow + 1;
const MAX_ROW = SHEET_RANGES.dbManagement.maxRow;
const T = /[\s()]/.test(TAB) ? `'${TAB}'` : TAB;
const RANGE = `${T}!AF${FIRST}:AI${MAX_ROW}`;
const rowRef = (row: number) => `${T}!AF${row}:AI${row}`;
const AI_COL = 35; // AF=32·AG=33·AH=34·AI=35 — 게시 로그 마지막 컬럼

// 라이브/템플릿 시트는 4섹션(~AD)까지만 열이 있어 AF:AI 쓰기가 grid 초과로 실패한다.
// 첫 게시 시 컬럼 자동 확장(자가치유) + AF3:AI3 헤더(빈 셀에만, §2.5). 멱등.
const headerEnsured = new Set<string>();
async function ensureBannerCols(spreadsheetId: string): Promise<void> {
  await ensureGridColumns(spreadsheetId, TAB, AI_COL);
  if (headerEnsured.has(spreadsheetId)) return;
  const hdr = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${T}!AF3:AI3`,
  });
  const cur = (hdr.data.values?.[0] ?? []) as unknown[];
  if (!cur.some((c) => String(c ?? "").trim())) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range: `${T}!AF3:AI3`,
      valueInputOption: "RAW",
      requestBody: { values: [["게시id", "주문ref", "게시일", "게시수"]] },
    });
  }
  headerEnsured.add(spreadsheetId);
}

const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
function iso(v: unknown): string {
  if (typeof v === "string") return isISO(v) ? v : "";
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86_400_000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  return "";
}
const numOf = (v: unknown) =>
  typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;
const strOf = (v: unknown) => (v == null ? "" : String(v));

export async function readBannerPosts(
  spreadsheetId: string,
): Promise<{ rows: Array<DBBannerPost & { row: number }> }> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = (res.data.values ?? []) as unknown[][];
  const rows: Array<DBBannerPost & { row: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    const 게시일 = iso(r[2]);
    if (!isISO(게시일)) continue; // 빈/헤더 row skip (게시일 유효성)
    rows.push({
      row: FIRST + i,
      게시id: strOf(r[0]),
      주문ref: strOf(r[1]),
      게시일,
      게시수: numOf(r[3]),
    });
  }
  return { rows };
}

async function firstEmptyRow(spreadsheetId: string): Promise<number> {
  const res = await sheetsClient().spreadsheets.values.get({ spreadsheetId, range: RANGE });
  const values = (res.data.values ?? []) as unknown[][];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    if (!isISO(iso(r[2])) && !strOf(r[0])) return FIRST + i; // 게시일·게시id 둘 다 없음 = 빈 행
  }
  return FIRST + values.length;
}

async function writePost(spreadsheetId: string, row: number, p: DBBannerPost) {
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: rowRef(row),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[p.게시id, p.주문ref, p.게시일, p.게시수]] },
  });
}

export async function appendBannerPost(
  spreadsheetId: string,
  p: DBBannerPost,
): Promise<{ row: number }> {
  await ensureBannerCols(spreadsheetId); // 첫 게시 시 AF:AI 컬럼 자가치유
  const row = await firstEmptyRow(spreadsheetId);
  if (row > MAX_ROW) throw new Error("[banner-post] 게시 로그 영역이 가득 찼습니다.");
  await writePost(spreadsheetId, row, p);
  return { row };
}

export async function updateBannerPost(spreadsheetId: string, row: number, p: DBBannerPost) {
  await ensureBannerCols(spreadsheetId);
  await writePost(spreadsheetId, row, p);
}

export async function clearBannerPost(spreadsheetId: string, row: number) {
  await sheetsClient().spreadsheets.values.clear({ spreadsheetId, range: rowRef(row) });
}
