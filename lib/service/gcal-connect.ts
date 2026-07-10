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
import { findUserByEmail } from "@/repo/users";
import { resyncAll, toggleSchedule } from "@/service/gcal-sync";
import { readGcalStates, type GcalEventKind } from "@/repo/gcal-event-ids";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[gcal-connect] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

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
  /** 연결된 구글 계정(primary 캘린더 id=이메일) — 카드 계정 표시(gcal-2b). 없으면 빈 문자열. */
  account: string;
  /** 캘린더 조회 실패(토큰 만료 등) 표식 — 카드가 "연결이 풀렸어요" 표시. */
  error: boolean;
}

/** 연동 카드 렌더 상태 — 연결 여부·설정·캘린더·계정. 평문 토큰 미포함(비-PII 응답). */
export async function loadGcalCard(email: string): Promise<GcalCardState> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) {
    return { connected: false, settings: conn.settings, calendars: [], account: "", error: false };
  }
  try {
    const calendars = await listWritableCalendars(conn.refreshToken);
    const account = calendars.find((c) => c.primary)?.id ?? ""; // primary 캘린더 id = 계정 이메일
    return { connected: true, settings: conn.settings, calendars, account, error: false };
  } catch {
    // 토큰 무효(만료·revoke) — 카드에 "연결이 풀렸어요" 유도.
    return { connected: false, settings: conn.settings, calendars: [], account: "", error: true };
  }
}

/** 일정별 토글(카드/캘린더 UI). email→시트 해소 후 gcal-sync 위임. */
export async function toggleGcalSchedule(
  email: string,
  kind: GcalEventKind,
  id: string,
  on: boolean,
): Promise<{ connected: boolean }> {
  return toggleSchedule(email, await resolveSheet(email), kind, id, on);
}

/** [다시 올리기] — 전체 일정 멱등 재푸시. */
export async function resyncGcal(email: string): Promise<{ connected: boolean; pushed: number }> {
  return resyncAll(email, await resolveSheet(email));
}

/** 캘린더 항목별 토글 초기 상태(담김=true) 배치 조회. 미연결이면 connected:false. */
export async function loadGcalToggleStates(
  email: string,
  meetingIds: string[],
  todoIds: string[],
): Promise<{ connected: boolean; states: Record<string, boolean> }> {
  const conn = await getGcalConnection(email);
  if (!conn.connected) return { connected: false, states: {} };
  const spreadsheetId = await resolveSheet(email);
  const [m, t] = await Promise.all([
    readGcalStates(spreadsheetId, "meeting", meetingIds, email),
    readGcalStates(spreadsheetId, "todo", todoIds, email),
  ]);
  return { connected: true, states: { ...m, ...t } };
}

/** 설정 저장(대상 캘린더 변경). */
export async function updateGcalSettings(
  email: string,
  patch: Partial<GcalSettings>,
): Promise<GcalSettings> {
  return saveGcalSettings(email, patch);
}
