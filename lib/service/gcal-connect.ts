/**
 * Layer: service — 구글 캘린더 연결/해제 유스케이스 (ADR-0028, gcal-1).
 *
 * OAuth code 교환·토큰 저장·해제·연동 카드 상태. 이벤트 생성/전파는 gcal-2(gcal-sync).
 * 토큰은 gcal-token 리포가 암호화 저장 — 이 레이어는 평문 토큰을 화면/응답에 절대 노출 안 함.
 */
import {
  buildConsentUrl,
  exchangeCodeForToken,
  listWritableCalendars,
  revokeToken,
  type WritableCalendar,
} from "@/repo/gcal-oauth";
import {
  clearGcalToken,
  getGcalConnection,
  saveGcalSettings,
  saveGcalToken,
  type GcalSettings,
} from "@/repo/gcal-token";

/** 동의 화면 URL (라우트가 state 를 생성·쿠키 저장 후 전달). */
export function gcalConsentUrl(state: string): string {
  return buildConsentUrl(state);
}

/** 콜백 완료 — code 교환 후 암호화 저장. 실패는 throw(라우트가 에러 리디렉션). */
export async function completeGcalConnect(email: string, code: string): Promise<void> {
  const refreshToken = await exchangeCodeForToken(code);
  await saveGcalToken(email, refreshToken);
}

/** 연결 해제 — 구글 revoke(best-effort) 후 레지스트리 토큰 비움. 기존 이벤트는 구글에 남음. */
export async function disconnectGcal(email: string): Promise<void> {
  const conn = await getGcalConnection(email);
  if (conn.refreshToken) await revokeToken(conn.refreshToken);
  await clearGcalToken(email);
}

export interface GcalCardState {
  connected: boolean;
  settings: GcalSettings;
  /** 연결됨일 때만 — 쓰기 가능 캘린더 드롭다운. 조회 실패 시 빈 배열(+error). */
  calendars: WritableCalendar[];
  /** 캘린더 조회 실패(토큰 만료 등) 표식 — 카드가 "연결이 풀렸어요" 표시. */
  error: boolean;
}

/** 연동 카드 렌더 상태 — 연결 여부·설정·캘린더 목록. 평문 토큰 미포함(비-PII 응답). */
export async function loadGcalCard(email: string): Promise<GcalCardState> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) {
    return { connected: false, settings: conn.settings, calendars: [], error: false };
  }
  try {
    const calendars = await listWritableCalendars(conn.refreshToken);
    return { connected: true, settings: conn.settings, calendars, error: false };
  } catch {
    // 토큰 무효(만료·revoke) — 카드에 "연결이 풀렸어요" 유도.
    return { connected: false, settings: conn.settings, calendars: [], error: true };
  }
}

/** 설정 저장(토글·캘린더 변경). */
export async function updateGcalSettings(
  email: string,
  patch: Partial<GcalSettings>,
): Promise<GcalSettings> {
  return saveGcalSettings(email, patch);
}
