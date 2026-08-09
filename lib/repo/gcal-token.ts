/**
 * Layer: repo — 구글 캘린더 토큰·설정 저장 (ADR-0028 · BBE-58 로 DB 정본 전환).
 *
 * **정본 = Postgres `gcal_tokens`**(BBE-58, R7 Phase 1 #9). 레지스트리 시트 S(암호화 token)·
 * T(설정 JSON)는 **읽기 폴백 + 미러**로만 남는다 — 실제 열 제거는 시트 은퇴(R7 Phase 4 #20).
 * 복호화된 token 은 gcal-2(동기화 엔진)만 사용 — 이 리포는 저장/로드/해제 + 설정 파싱만.
 *
 * ## 전환 규칙 (세 가지 불변식)
 *  ① **행 존재 = 정본** — DB 에 행이 있으면 그 값이 진실이다(token_enc="" 인 "해제됨" 포함).
 *     행이 **없을 때만** 시트로 폴백한다. 이걸 어기면 연결 해제가 시트 값으로 되살아난다.
 *  ② **lazy backfill** — 시트 폴백이 실제로 값을 찾으면 그 값을 DB 에 1회 심는다
 *     (`on conflict do nothing`). 사용자가 캘린더 화면을 한 번 열면 자동 이전 — 별도
 *     마이그레이션 스크립트로 토큰을 훑지 않는다(비밀값을 다루는 배치를 만들지 않는 게 안전).
 *  ③ **DB 정본 + 시트 미러** — 쓰기는 DB 를 먼저(실패=throw), 시트는 best-effort 미러
 *     (실패=warn). 미러를 유지하는 이유는 **revert 안전**(§6.8): 이 PR 을 되돌려도 시트에
 *     최신 값이 남아 있어 캘린더가 끊기지 않는다.
 *
 * DATABASE_URL 미설정(로컬·CI) 환경은 **전 경로가 기존 시트 동작 그대로**로 강등된다.
 *
 * ⚠️ 보안(ADR-0028 §3): 암호문·평문 토큰 모두 로그·에러 메시지에 남기지 않는다.
 */
import { z } from "zod";
import { findUserByEmail, updateUserCell } from "./users";
import { decryptToken, encryptToken } from "./gcal-crypto";
import { dbEnabled } from "./db/client";
import {
  backfillGcalRowIfAbsent,
  readGcalTokenRow,
  upsertGcalSettings,
  upsertGcalToken,
} from "./db/gcal-tokens";

/** 암호화 refresh token → registry S(빈 문자열=해제). 설정 JSON → T. ADR-0028. */
const writeGcalTokenCell = (email: string, enc: string) => updateUserCell(email, "S", enc);
const writeGcalSettingsCell = (email: string, json: string) => updateUserCell(email, "T", json);

/** 비치명 실패 경고 — 토큰 값(평문·암호문)은 절대 로그에 넣지 않는다(ADR-0028 §3). */
function warnNonFatal(what: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : "unknown";
  console.warn(`[gcal-token] ${what} (동작은 계속): ${msg}`);
}

/**
 * 연동 설정 — 대상 캘린더 하나만. 빈 설정 = 기본(primary).
 * 유형 토글 3종(미팅/실무/일반)은 폐기(2026-07-09) → 일정별 개별 on/off 는
 * gcal-2 가 gcal_event_ids 마커("-")로 관리. 옛 저장본의 meeting/todo/general 키는
 * 파싱 시 조용히 제거됨(z.object 비-strict → unknown 키 strip).
 */
export const GcalSettings = z.object({
  calendarId: z.string().default("primary"),
});
export type GcalSettings = z.infer<typeof GcalSettings>;

const DEFAULT_SETTINGS: GcalSettings = { calendarId: "primary" };

/** 설정 JSON 문자열 → GcalSettings (손상/빈값 → 기본). */
export function parseGcalSettings(json: string): GcalSettings {
  if (!json.trim()) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = GcalSettings.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export interface GcalConnection {
  connected: boolean;
  /** 복호화된 refresh token — 복호화 실패(키 로테이션·변조) 시 null(=재연결 필요). */
  refreshToken: string | null;
  settings: GcalSettings;
}

/** 암호문 + 설정 원문 → GcalConnection. 복호화 실패는 조용히 미연결(카드가 "연결이 풀렸어요"). */
function toConnection(enc: string, settingsJson: string): GcalConnection {
  const settings = parseGcalSettings(settingsJson);
  if (!enc.trim()) return { connected: false, refreshToken: null, settings };
  try {
    const token = decryptToken(enc);
    return { connected: token !== "", refreshToken: token || null, settings };
  } catch {
    // 복호화 불가(AUTH_SECRET 로테이션·손상) → 미연결로 강등(카드에 "연결이 풀렸어요").
    return { connected: false, refreshToken: null, settings };
  }
}

/**
 * 한 사용자의 연결 상태 — 카드 렌더·동기화 게이트 공용.
 * DB 행이 있으면 그것만 본다(불변식①). 없을 때만 시트를 읽고, 값이 있으면 DB 로 1회 이전(②).
 * DB 조회 자체가 실패하면(순단) 시트로 강등 — 캘린더가 DB 장애로 끊기지 않게.
 */
export async function getGcalConnection(email: string): Promise<GcalConnection> {
  if (dbEnabled()) {
    try {
      const row = await readGcalTokenRow(email);
      if (row) return toConnection(row.tokenEnc, row.settings);
    } catch (e) {
      // DB 순단 — 시트 폴백으로 계속(연결 유지가 우선). 값은 로그하지 않는다.
      warnNonFatal("DB 조회 실패 → 시트 폴백", e);
    }
  }

  const user = await findUserByEmail(email);
  const enc = user?.gcalToken?.trim() ?? "";
  const settingsJson = user?.gcalSettings ?? "";
  // ② lazy backfill — 시트에 실제 값이 있을 때만. fire-and-forget(읽기를 지연시키지 않는다).
  if (dbEnabled() && (enc || settingsJson.trim())) {
    void backfillGcalRowIfAbsent(email, enc, settingsJson).catch((e) =>
      warnNonFatal("DB lazy backfill 실패", e),
    );
  }
  return toConnection(enc, settingsJson);
}

/**
 * 연결 저장 — refresh token 암호화 후 DB 정본 기록 + 시트 미러. 설정은 **기존값 보존**.
 *
 * ⚠️ 설정을 쓰기 전에 `getGcalConnection` 으로 **유효 설정**(DB 행 → 없으면 시트 폴백)을 먼저
 * 확정한다. DB 행만 보고 판단하면, 아직 backfill 되지 않은 사용자가 재연결할 때 시트에 있던
 * 캘린더 선택(예: 업무용 캘린더)이 기본값(primary)으로 되돌아간다 — 전환기에만 나타나는
 * 조용한 회귀라 테스트로 박제했다. parseGcalSettings 가 빈값을 DEFAULT 로 정규화하므로
 * 최초 연결도 같은 경로로 기본값이 저장된다(분기 불필요).
 */
export async function saveGcalToken(email: string, refreshToken: string): Promise<void> {
  const enc = encryptToken(refreshToken);
  const prev = await getGcalConnection(email); // 유효 설정 확정(DB → 시트 폴백 + backfill)
  const settingsJson = JSON.stringify(prev.settings);
  if (dbEnabled()) {
    await upsertGcalToken(email, enc); // 정본 — 실패는 throw(저장 실패로 응답)
    await upsertGcalSettings(email, settingsJson);
  }
  try {
    await writeGcalTokenCell(email, enc);
    await writeGcalSettingsCell(email, settingsJson);
  } catch (e) {
    if (!dbEnabled()) throw e; // DB 없는 환경 = 시트가 정본 → 실패를 삼키면 안 됨
    warnNonFatal("시트 미러 실패 — saveGcalToken(DB 정본은 저장됨)", e);
  }
}

/** 설정 저장(대상 캘린더 변경). 부분 갱신 — 기존과 병합. */
export async function saveGcalSettings(
  email: string,
  patch: Partial<GcalSettings>,
): Promise<GcalSettings> {
  const current = await getGcalConnection(email); // DB 우선 조회(폴백·backfill 포함)
  const next = GcalSettings.parse({ ...current.settings, ...patch });
  const json = JSON.stringify(next);
  if (dbEnabled()) await upsertGcalSettings(email, json); // 정본
  try {
    await writeGcalSettingsCell(email, json);
  } catch (e) {
    if (!dbEnabled()) throw e;
    warnNonFatal("시트 미러 실패 — saveGcalSettings(DB 정본은 저장됨)", e);
  }
  return next;
}

/**
 * 연결 해제 — 토큰 비움(설정은 보존해 재연결 시 유지). 구글 revoke 는 호출부(gcal-client) 몫.
 * ⚠️ DB 행을 **삭제하지 않고** token_enc="" 로 남긴다 — 삭제하면 다음 읽기가 시트로 폴백해
 * 해제가 되살아난다(불변식①). 시트도 함께 비워 미러 정합을 맞춘다.
 */
export async function clearGcalToken(email: string): Promise<void> {
  if (dbEnabled()) await upsertGcalToken(email, ""); // 정본 — 행 유지, 값만 비움
  try {
    await writeGcalTokenCell(email, "");
  } catch (e) {
    if (!dbEnabled()) throw e;
    warnNonFatal("시트 미러 실패 — clearGcalToken(DB 정본은 저장됨)", e);
  }
}
