/**
 * Layer: service — 구글 캘린더 → 경영일지 「일반 일정」 가져오기의 순수 판단부(gcal-import, 2026-11-21).
 *
 * 네트워크·저장 없이 「구글 일정 목록 + 이미 가져온 일정」만 보고 할 일을 정한다(시험 대상).
 * 규칙:
 *  - 앱이 올린 일정(salesptId 있음)은 건너뛴다 — 원본이 이미 경영일지에 있다.
 *  - 구글에서 취소·삭제된 일정은 가져온 일반 일정을 휴지통으로 보낸다.
 *  - 이미 가져온 일정은 구글 수정시각이 바뀌었을 때만 제목·날짜·시각·장소·메모를 구글 값으로 맞춘다
 *    (앱에서 고친 업체명·분류·완료는 그대로 둔다).
 *  - 처음 보는 일정은 새 일반 일정(분류 「기타」)으로 만든다. 앱에서 지운 일정은 되살리지 않는다
 *    (같은 구글 일정 → 같은 행 id 라서 저장 단계가 막는다).
 */
import type { Todo } from "@/types";
import type { GcalRemoteEvent } from "@/repo/gcal-client";

export const IMPORT_TZ_OFFSET_MIN = 9 * 60; // Asia/Seoul — 서머타임 없음
export const TITLE_MAX = 200;
export const DETAIL_MAX = 2000;

/** 구글 일정 → 일반 일정의 날짜·시각·글 필드. 날짜를 못 읽으면 null(가져오지 않음). */
export interface ImportedFields {
  제목: string;
  예정일자: string;
  예정시각: string;
  장소: string;
  상세: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO dateTime(오프셋 포함) → 서울 기준 날짜·시각. */
export function toSeoulDateTime(iso: string): { date: string; time: string } | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + IMPORT_TZ_OFFSET_MIN * 60_000);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** 구글 메모는 HTML 이 섞여 온다 — 줄바꿈만 살리고 태그·흔한 엔티티를 걷어 낸다. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function remoteToFields(ev: GcalRemoteEvent): ImportedFields | null {
  let 예정일자 = "";
  let 예정시각 = "";
  if (ev.start.dateTime) {
    const s = toSeoulDateTime(ev.start.dateTime);
    if (!s) return null;
    예정일자 = s.date;
    예정시각 = s.time;
  } else if (ev.start.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.start.date)) {
    예정일자 = ev.start.date;
  } else {
    return null;
  }
  const 제목 = ev.summary.trim().slice(0, TITLE_MAX) || "(제목 없음)";
  return {
    제목,
    예정일자,
    예정시각,
    장소: ev.location.trim().slice(0, TITLE_MAX),
    상세: plainText(ev.description).slice(0, DETAIL_MAX),
  };
}

export type ImportAction =
  | { kind: "create"; event: GcalRemoteEvent; fields: ImportedFields }
  | { kind: "update"; todo: Todo; event: GcalRemoteEvent; fields: ImportedFields }
  | { kind: "remove"; todo: Todo };

/**
 * @param events 구글 일정(기간 안, 취소 포함)
 * @param imported 이미 가져와 살아 있는 일반 일정(gcalSource 있음)
 */
export function planGcalImport(events: GcalRemoteEvent[], imported: Todo[]): ImportAction[] {
  const byEvent = new Map<string, Todo>();
  for (const t of imported) if (t.gcalSource) byEvent.set(t.gcalSource.eventId, t);
  const out: ImportAction[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    const linked = byEvent.get(ev.id);
    if (ev.status === "cancelled") {
      if (linked) out.push({ kind: "remove", todo: linked });
      continue;
    }
    if (ev.salesptId && !linked) continue; // 앱이 올린 일정
    const fields = remoteToFields(ev);
    if (!fields) continue;
    if (linked) {
      if (linked.gcalSource?.updated === ev.updated) continue; // 구글에서 안 바뀜
      out.push({ kind: "update", todo: linked, event: ev, fields });
      continue;
    }
    out.push({ kind: "create", event: ev, fields });
  }
  return out;
}

/** 같은 (사용자·캘린더·구글 일정) → 언제나 같은 행 id(UUID 모양). 두 번 가져와도 1행으로 수렴. */
export function importTodoId(hexDigest: string): string {
  const h = hexDigest.toLowerCase().padEnd(32, "0").slice(0, 32).split("");
  h[12] = "5"; // version
  h[16] = ((parseInt(h[16] ?? "0", 16) & 0x3) | 0x8).toString(16); // variant
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
