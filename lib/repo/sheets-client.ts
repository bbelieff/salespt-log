/**
 * Layer: repo — Google Sheets 전용.
 *
 * 가드레일 (구조 테스트가 강제):
 *   • googleapis 는 오직 lib/repo/ 에서만 import.
 *   • 셀 단위 update 금지 — batchUpdate / values.update / values.append 사용.
 *   • 반환은 dict 가 아니라 lib/types 의 Zod 모델.
 *
 * 2026-05-19: Sheets API quota 429 자동 retry (exponential backoff). 60 read
 * req/min/user 초과 시 모든 호출이 transparent 하게 재시도.
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

/**
 * 429 시 exponential backoff (1s → 2s → 4s → 8s, jitter 포함, 최대 4 시도).
 * 분당 quota window = 60s 이므로 한 wave 내에 reset 됨.
 */
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

/**
 * 모든 메서드 호출에 withRetry 자동 적용 (Proxy 재귀).
 * spreadsheets.values.get / batchUpdate / etc. 깊이 무관 자동 wrapping.
 */
function wrapWithRetry<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) =>
          withRetry(() =>
            (value as (...a: unknown[]) => Promise<unknown>).apply(target, args),
          );
      }
      if (value !== null && typeof value === "object") {
        return wrapWithRetry(value as object);
      }
      return value;
    },
  }) as T;
}

export function sheetsClient(): sheets_v4.Sheets {
  if (cached) return cached;
  const sa = serviceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cached = wrapWithRetry(google.sheets({ version: "v4", auth }));
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
