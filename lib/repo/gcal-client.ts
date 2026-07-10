/**
 * Layer: repo — 구글 캘린더 v3 이벤트 쓰기 (gcal-2, ADR-0028). googleapis 격리(repo 전용).
 *
 * 연결된 사용자 refresh token 으로 events insert/patch/delete. 매핑·멱등 판정은
 * service/gcal-sync. 앱 식별은 extendedProperties.private.salesptId(제목 무관 추적).
 * OAuth2 클라이언트 패턴은 gcal-oauth.listWritableCalendars 와 동일(그 파일은 연결 flow
 * 전용이라 무변경 유지 — 3줄 복제가 결합보다 안전).
 */
import { google, type calendar_v3 } from "googleapis";
import { authConfig } from "@/config";

const TZ = "Asia/Seoul";

/** refresh token → authorized calendar v3 client. */
function calendarClient(refreshToken: string): calendar_v3.Calendar {
  const { googleId, googleSecret } = authConfig();
  const auth = new google.auth.OAuth2(googleId, googleSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

export interface GcalEventInput {
  summary: string;
  location?: string;
  description?: string;
  /** 시각 이벤트: "YYYY-MM-DDTHH:MM:SS" · 종일: "YYYY-MM-DD". */
  start: string;
  /** 종일 end.date 는 exclusive(다음날). */
  end: string;
  allDay: boolean;
  /** extendedProperties.private.salesptId — 멱등·추적 키(앱 행 id). */
  salesptId: string;
}

function toEvent(input: GcalEventInput): calendar_v3.Schema$Event {
  const when = input.allDay
    ? { start: { date: input.start }, end: { date: input.end } }
    : {
        start: { dateTime: input.start, timeZone: TZ },
        end: { dateTime: input.end, timeZone: TZ },
      };
  return {
    summary: input.summary,
    location: input.location || undefined,
    description: input.description || undefined,
    ...when,
    extendedProperties: { private: { salesptId: input.salesptId } },
  };
}

/** 404/410 = 이벤트가 이미 없음(사용자가 구글에서 지움 등) — 삭제/patch 에서 무해 처리. */
function isGone(e: unknown): boolean {
  const code =
    (e as { code?: number })?.code ?? (e as { status?: number })?.status;
  return code === 404 || code === 410;
}

/**
 * salesptId(extendedProperties.private) 로 기존 이벤트 조회 → eventId(없으면 null).
 * 멱등 가드: 시트 맵 저장이 실패해 맵엔 없지만 구글엔 이미 만들어진 이벤트를 재삽입 전 찾아
 * 중복 생성을 막는다(insert-then-save 비원자성 보완).
 */
export async function findEventBySalesptId(
  refreshToken: string,
  calendarId: string,
  salesptId: string,
): Promise<string | null> {
  const res = await calendarClient(refreshToken).events.list({
    calendarId,
    privateExtendedProperty: [`salesptId=${salesptId}`],
    showDeleted: false,
    maxResults: 1,
  });
  return res.data.items?.[0]?.id ?? null;
}

/** 이벤트 생성 → eventId. */
export async function insertEvent(
  refreshToken: string,
  calendarId: string,
  input: GcalEventInput,
): Promise<string> {
  const res = await calendarClient(refreshToken).events.insert({
    calendarId,
    requestBody: toEvent(input),
  });
  const id = res.data.id;
  if (!id) throw new Error("[gcal-client] events.insert: id 미수신");
  return id;
}

/** 기존 이벤트 갱신. 이미 삭제됨(404/410)이면 false → 호출부가 재삽입. */
export async function patchEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
  input: GcalEventInput,
): Promise<boolean> {
  try {
    await calendarClient(refreshToken).events.patch({
      calendarId,
      eventId,
      requestBody: toEvent(input),
    });
    return true;
  } catch (e) {
    if (isGone(e)) return false;
    throw e;
  }
}

/** 이벤트 삭제. 이미 없으면 무해(성공 간주). */
export async function deleteEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await calendarClient(refreshToken).events.delete({ calendarId, eventId });
  } catch (e) {
    if (isGone(e)) return;
    throw e;
  }
}
