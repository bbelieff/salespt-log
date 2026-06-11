/**
 * Layer: repo — Google Sheets 전용.
 *
 * 가드레일 (구조 테스트가 강제):
 *   • googleapis 는 오직 lib/repo/ 에서만 import.
 *   • 셀 단위 update 금지 — batchUpdate / values.update / values.append 사용.
 *   • 반환은 dict 가 아니라 lib/types 의 Zod 모델.
 *
 * 2026-05-19: Sheets API 429 quota 자동 retry. PR #244 의 Proxy 접근은
 * googleapis 의 non-configurable read-only 속성과 invariant 충돌 → 모든 호출
 * 실패. 명시적 메서드 wrapping 으로 변경 — spreadsheets.values.{get,batchGet,
 * update,batchUpdate,append,clear,batchClear} + spreadsheets.{get,batchUpdate}
 * 만 instance 속성으로 shadow 하여 retry 적용.
 */
import { google, type sheets_v4 } from "googleapis";
import { serviceAccount } from "@/config";

let cached: sheets_v4.Sheets | null = null;

function isRateLimitError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: number; status?: number; message?: string };
  if (err.code === 429 || err.status === 429) return true;
  const msg = String(err.message ?? "");
  return /Quota exceeded/i.test(msg) || /Rate Limit Exceeded/i.test(msg);
}

/** 429 시 exponential backoff (1s → 2s → 4s → 8s, jitter ±250ms). */
async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  const MAX_ATTEMPTS = 4;
  try {
    return await fn();
  } catch (e) {
    if (!isRateLimitError(e) || attempt >= MAX_ATTEMPTS - 1) throw e;
    const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
    await new Promise((r) => setTimeout(r, delay));
    return withRetry(fn, attempt + 1);
  }
}

/** 객체의 지정 메서드를 instance 속성으로 shadow 하여 retry wrapper 적용. */
function patchMethods<T extends object>(obj: T, names: readonly string[]): void {
  for (const name of names) {
    const orig = (obj as unknown as Record<string, unknown>)[name];
    if (typeof orig !== "function") continue;
    const bound = (orig as (...a: unknown[]) => Promise<unknown>).bind(obj);
    (obj as unknown as Record<string, unknown>)[name] = (...args: unknown[]) =>
      withRetry(() => bound(...args));
  }
}

function patchClient(client: sheets_v4.Sheets): sheets_v4.Sheets {
  patchMethods(client.spreadsheets.values, [
    "get",
    "batchGet",
    "batchGetByDataFilter",
    "update",
    "batchUpdate",
    "batchUpdateByDataFilter",
    "append",
    "clear",
    "batchClear",
    "batchClearByDataFilter",
  ]);
  patchMethods(client.spreadsheets, ["get", "batchUpdate", "getByDataFilter"]);
  return client;
}

export function sheetsClient(): sheets_v4.Sheets {
  if (cached) return cached;
  const sa = serviceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cached = patchClient(google.sheets({ version: "v4", auth }));
  return cached;
}

export async function readRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  // **CRITICAL** — Sheets API + UNFORMATTED_VALUE 는 셀 타입 그대로 반환
  // (숫자 셀 → JS number, boolean 셀 → JS boolean). 함수 반환 타입은 string[][]
  // 인데 실제로는 (string|number|boolean|null)[][] 였음. 2026-05-13 사고:
  // registry 의 cohort 컬럼이 "7" 입력해도 시트가 자동으로 number 7 로 형변환 →
  // parseRow 의 `cohort: r[1] ?? ""` 가 number 그대로 Zod z.string() 에 전달 →
  // 검증 실패 → findUserByEmail null → /claim 무한루프. 경계에서 강제 정규화
  // (모든 셀을 string 으로) 해서 호출자가 raw 타입 만질 일 없게 함. null/undefined
  // 는 빈 문자열로 흡수.
  return (res.data.values ?? []).map((row) =>
    row.map((cell) => (cell == null ? "" : String(cell))),
  );
}

/**
 * Sheets append wrapper.
 *
 * valueInputOption 정책:
 *   - **default "USER_ENTERED"** — 미팅/계약수납/DB관리 등 trainee 개인 시트 쓰기.
 *     수식·날짜 자동 인식 필수 (예: "=N1+57" 수식 보존, "2026-04-12" → 날짜 셀).
 *   - **"RAW"** — registry 시트 쓰기. ISO 날짜 문자열("2026-04-12") 이 Sheets 의
 *     자동 date inference 로 시리얼 넘버(46122)로 변환되는 사고 방지 (PR D, 2026-05-14).
 *     숫자형 문자열("7" cohort_label) 도 같은 이유로 RAW 가 안전. registry 는 모든
 *     값을 plain string 으로 다룬다.
 *
 * 호출자는 명시적으로 옵션을 넘기지 않으면 USER_ENTERED 가 적용된다. registry 쓰기 사이트는
 * 반드시 `{ valueInputOption: "RAW" }` 전달.
 */
export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number | boolean)[][],
  options?: { valueInputOption?: "USER_ENTERED" | "RAW" },
): Promise<void> {
  if (rows.length === 0) return;
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: options?.valueInputOption ?? "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

/**
 * 탭 grid 컬럼 보장 — columnCount < minCols 면 appendDimension 으로 확장.
 * Sheets 는 grid 밖 좌표 쓰기를 "exceeds grid limits" 로 거부한다 (04 가 AN=40
 * 까지만 생성된 시트에 AO~AS 쓰기 시 — field-grid 2026-06-11 실측).
 * 멱등·promise 캐시(시트·탭당 1회). 행/데이터 비접촉 — 빈 컬럼만 추가.
 */
const gridEnsured = new Map<string, Promise<void>>();

export function ensureGridColumns(
  spreadsheetId: string,
  tabTitle: string,
  minCols: number,
): Promise<void> {
  const key = `${spreadsheetId}:${tabTitle}:${minCols}`;
  let p = gridEnsured.get(key);
  if (!p) {
    p = doEnsureGrid(spreadsheetId, tabTitle, minCols).catch((e) => {
      gridEnsured.delete(key);
      throw e;
    });
    gridEnsured.set(key, p);
  }
  return p;
}

async function doEnsureGrid(
  spreadsheetId: string,
  tabTitle: string,
  minCols: number,
): Promise<void> {
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(columnCount)))",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tabTitle);
  if (!sheet?.properties) return; // 탭 없음 — 호출측 ensure 가 처리
  const count = sheet.properties.gridProperties?.columnCount ?? 0;
  if (count >= minCols) return;
  await sheetsClient().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId: sheet.properties.sheetId,
            dimension: "COLUMNS",
            length: minCols - count,
          },
        },
      ],
    },
  });
}
