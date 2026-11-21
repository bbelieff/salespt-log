/**
 * Layer: service — 구글 캘린더 → 경영일지 「일반 일정」 가져오기 실행부(gcal-import, 2026-11-21 belie).
 *
 * 2026-07 설계는 앱→구글 단방향이었다(google-calendar-sync §0). belie 가 「구글에서 넣은 일정도
 * 경영일지에 기록」을 요청해, 구글에서 직접 만든 일정만 **일반 일정(분류 기타)** 으로 들인다.
 * 미팅·통계에는 들어가지 않는다(일반 = 비집계, consultation-log §1-3).
 *
 * - 대상: 연결된 사용자 본인의 대상 캘린더, 오늘 기준 7일 전 ~ 90일 뒤.
 * - 판단은 gcal-import-plan(순수). 여기서는 읽기·저장만.
 * - 가져온 일정은 todo.gcalSource 로 표시 → gcal-sync 가 구글로 다시 올리지 않는다.
 * - 행 id = (이메일·캘린더·구글 일정 id) 해시 → 동시에 두 번 돌아도, 앱에서 지운 뒤 다시 돌아도
 *   새 행이 생기지 않는다(createTodo operationId 멱등 경로).
 * - DB 저장 기수만(시트 저장 기수는 멱등 생성이 불가해 건너뜀 — todos.createTodo 주석).
 * - 같은 사용자 1분 안 재호출은 건너뜀(화면을 열 때마다 부르므로).
 */
import { createHash } from "node:crypto";
import { getGcalConnection } from "@/repo/gcal-token";
import { listEventsInRange } from "@/repo/gcal-client";
import { findUserByEmail } from "@/repo/users";
import { usesDbStorage, sourceCohort } from "./daily-source";
import { createTodo, listAllTodos, patchTodo, removeTodo, TodoOperationConflict } from "./todos";
import { importTodoId, planGcalImport } from "./gcal-import-plan";

const PAST_DAYS = 7;
const FUTURE_DAYS = 90;
const MIN_INTERVAL_MS = 60_000;
const MAX_CREATES = 200;

export interface GcalImportResult {
  ran: boolean;
  /** ran=false 일 때 이유 */
  reason?: "not_connected" | "sheet_storage" | "throttled" | "no_user";
  created: number;
  updated: number;
  removed: number;
}

const lastRun = new Map<string, number>();
const inFlight = new Map<string, Promise<GcalImportResult>>();

const empty = (reason: GcalImportResult["reason"]): GcalImportResult => ({
  ran: false,
  reason,
  created: 0,
  updated: 0,
  removed: 0,
});

/** 화면이 부르는 진입점 — 같은 사용자 동시 호출은 하나로 합치고, 1분 안 재호출은 건너뛴다. */
export function importGcalEvents(email: string, now: Date = new Date()): Promise<GcalImportResult> {
  const running = inFlight.get(email);
  if (running) return running;
  const last = lastRun.get(email) ?? 0;
  if (now.getTime() - last < MIN_INTERVAL_MS) return Promise.resolve(empty("throttled"));
  lastRun.set(email, now.getTime());
  const p = runImport(email, now).finally(() => inFlight.delete(email));
  inFlight.set(email, p);
  return p;
}

async function runImport(email: string, now: Date): Promise<GcalImportResult> {
  const conn = await getGcalConnection(email);
  if (!conn.connected || !conn.refreshToken) return empty("not_connected");
  const user = await findUserByEmail(email);
  if (!user) return empty("no_user");
  if (!usesDbStorage(sourceCohort(user))) return empty("sheet_storage");

  const calendarId = conn.settings.calendarId || "primary";
  const day = 86_400_000;
  const events = await listEventsInRange(
    conn.refreshToken,
    calendarId,
    new Date(now.getTime() - PAST_DAYS * day).toISOString(),
    new Date(now.getTime() + FUTURE_DAYS * day).toISOString(),
  );
  const imported = (await listAllTodos(email)).filter((t) => t.gcalSource);
  const actions = planGcalImport(events, imported);

  const result: GcalImportResult = { ran: true, created: 0, updated: 0, removed: 0 };
  for (const a of actions) {
    try {
      if (a.kind === "remove") {
        await removeTodo(email, a.todo.id); // 휴지통으로 — 되살리기 가능
        result.removed++;
      } else if (a.kind === "update") {
        await patchTodo(email, a.todo.id, {
          ...a.fields,
          gcalSource: { eventId: a.event.id, updated: a.event.updated },
        });
        result.updated++;
      } else {
        if (result.created >= MAX_CREATES) continue;
        const id = importTodoId(
          createHash("sha1").update(`${email}|${calendarId}|${a.event.id}`).digest("hex"),
        );
        await createTodo(
          email,
          {
            contractRef: "",
            institutionRef: "",
            업체명: "",
            type: "일반",
            분류: "기타",
            ...a.fields,
            showOnCalendar: true,
            gcalSource: { eventId: a.event.id, updated: a.event.updated },
          },
          { operationId: id },
        );
        result.created++;
      }
    } catch (e) {
      // 같은 일정을 이미 가져왔거나 앱에서 지운 경우(같은 행 id) — 조용히 건너뜀.
      if (e instanceof TodoOperationConflict) continue;
      console.warn("[gcal-import] 일정 1건 처리 실패(건너뜀):", e instanceof Error ? e.message : e);
    }
  }
  return result;
}

/** 시험용 — 사용자별 1분 제한 기록 초기화. */
export function resetGcalImportThrottle(): void {
  lastRun.clear();
  inFlight.clear();
}
