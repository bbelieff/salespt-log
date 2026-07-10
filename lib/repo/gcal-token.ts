/**
 * Layer: repo — 구글 캘린더 토큰·설정 저장 (ADR-0028).
 *
 * refresh token 은 registry S(`gcal_token`)에 AES-256-GCM 암호화(gcal-crypto)로,
 * 설정은 T(`gcal_settings`) JSON 으로. 복호화된 token 은 gcal-2(동기화 엔진)만 사용 —
 * 이 리포는 저장/로드/해제 + 설정 파싱만(googleapis 미접촉).
 */
import { z } from "zod";
import { findUserByEmail, updateUserCell } from "./users";
import { decryptToken, encryptToken } from "./gcal-crypto";

/** 암호화 refresh token → registry S(빈 문자열=해제). 설정 JSON → T. ADR-0028. */
const writeGcalTokenCell = (email: string, enc: string) => updateUserCell(email, "S", enc);
const writeGcalSettingsCell = (email: string, json: string) => updateUserCell(email, "T", json);

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

/** 한 사용자의 연결 상태 — 카드 렌더·동기화 게이트 공용. token 복호화 실패는 조용히 미연결 처리. */
export async function getGcalConnection(email: string): Promise<GcalConnection> {
  const user = await findUserByEmail(email);
  const enc = user?.gcalToken?.trim() ?? "";
  const settings = parseGcalSettings(user?.gcalSettings ?? "");
  if (!enc) return { connected: false, refreshToken: null, settings };
  try {
    const token = decryptToken(enc);
    return { connected: token !== "", refreshToken: token || null, settings };
  } catch {
    // 복호화 불가(AUTH_SECRET 로테이션·손상) → 미연결로 강등(카드에 "연결이 풀렸어요").
    return { connected: false, refreshToken: null, settings };
  }
}

/** 연결 저장 — refresh token 암호화 후 S 기록. 최초 연결 시 기본 설정도 함께 저장. */
export async function saveGcalToken(email: string, refreshToken: string): Promise<void> {
  await writeGcalTokenCell(email, encryptToken(refreshToken));
  const user = await findUserByEmail(email);
  if (!user?.gcalSettings?.trim()) {
    await writeGcalSettingsCell(email, JSON.stringify(DEFAULT_SETTINGS));
  }
}

/** 설정 저장(대상 캘린더 변경). 부분 갱신 — 기존과 병합. */
export async function saveGcalSettings(email: string, patch: Partial<GcalSettings>): Promise<GcalSettings> {
  const user = await findUserByEmail(email);
  const next = GcalSettings.parse({ ...parseGcalSettings(user?.gcalSettings ?? ""), ...patch });
  await writeGcalSettingsCell(email, JSON.stringify(next));
  return next;
}

/** 연결 해제 — S 비움(설정은 보존해 재연결 시 유지). 구글 revoke 는 호출부(gcal-client) 몫. */
export async function clearGcalToken(email: string): Promise<void> {
  await writeGcalTokenCell(email, "");
}
