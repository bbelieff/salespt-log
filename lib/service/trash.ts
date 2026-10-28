/**
 * service/trash — 앱 휴지통(2026-10-28 belie 「삭제된 것 모아 놓은 휴지통, 앱 전체 한 곳 · 깔끔한 표 · 행 골라 되살리기만」).
 *
 * 모으는 것(각 화면의 기존 삭제 기록을 그대로 읽는다 — 새 저장 방식 없음):
 *  - 할 일: 실무/수납 할 일 ×(지움 표시 행, 내용 남아 있음) → restoreTodo.
 *  - 미팅: 컨택관리·일정에서 지운 미팅(기존 미팅 보관함) → restoreDeletedMeeting. 계약과 이어진 미팅은 되살릴 수 없음(이유 표시).
 *  - DB관리시트: DB관리시트 휴지통 → trash-restore(같은 업체가 이미 있으면 막힘).
 * 계약은 넣지 않는다 — 지울 때 연결 미팅을 「계약 → 예약」으로 되돌려, 계약만 되살리면 서로 어긋난다.
 * 영구 삭제는 하지 않는다(되살리기만).
 */
import { deletedMeetings, restoreDeletedMeeting } from "./meeting-archive";
import { listDeletedTodos, restoreTodo } from "./todos";
import { executeDbSheet, loadDbSheetTrash, resolveDbSheetContext } from "./db-sheet";
import { DbSheetDuplicate } from "@/repo/db/db-sheet";

export type TrashKind = "todo" | "meeting" | "lead";

export type TrashItem = {
  kind: TrashKind;
  id: string;
  /** 업체명(없으면 할 일 제목). */
  name: string;
  /** 무엇이었나 — 할 일 제목·미팅 일시·DB 연락처 등. */
  detail: string;
  /** 지운 때(ISO). */
  deletedAt: string;
  /** 되살릴 수 없으면 이유. */
  blocked?: string;
};

export type TrashRestoreResult = { restored: number; failed: { kind: TrashKind; id: string; reason: string }[] };

const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

export async function listTrash(email: string, sheetOverride?: string): Promise<TrashItem[]> {
  const [todos, meetings, leads] = await Promise.all([
    settle(listDeletedTodos(email, sheetOverride), []),
    settle(deletedMeetings(email, sheetOverride), []),
    settle(resolveDbSheetContext(email, sheetOverride).then(loadDbSheetTrash), []),
  ]);
  const items: TrashItem[] = [
    ...todos.map(({ todo, deletedAt }): TrashItem => ({
      kind: "todo", id: todo.id, name: todo.업체명.trim() || todo.제목, deletedAt,
      detail: [todo.제목, todo.예정일자 && `${todo.예정일자}${todo.예정시각 ? ` ${todo.예정시각}` : ""}`, todo.institutionRef].filter(Boolean).join(" · "),
    })),
    ...meetings.map(({ meeting: m, restorable, reason, deletedAt }): TrashItem => ({
      kind: "meeting", id: m.id, name: m.업체명, deletedAt: deletedAt ?? m.미팅날짜,
      detail: [`미팅 ${m.미팅날짜}${m.미팅시간 ? ` ${m.미팅시간}` : ""}`, m.장소].filter(Boolean).join(" · "),
      ...(restorable ? {} : { blocked: reason ?? "되살릴 수 없어요" }),
    })),
    ...leads.map((l): TrashItem => ({
      kind: "lead", id: l.id, name: l.company || l.owner || "이름 없음", deletedAt: l.deletedAt,
      detail: [l.owner, l.phone, l.supplier].filter(Boolean).join(" · "),
    })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

const reasonOf = (e: unknown) => {
  const code = e instanceof Error ? e.message : "";
  if (code === "MEETING_ARCHIVE_COMPLEX") return "계약·연결된 미팅이라 되살릴 수 없어요";
  if (code === "MEETING_ARCHIVE_PURGED") return "영구삭제한 DB의 미팅이에요";
  if (e instanceof DbSheetDuplicate) return "같은 업체가 DB관리시트에 이미 있어요";
  return "되살리지 못했어요";
};

/** 고른 항목을 종류별로 되살린다 — 하나가 막혀도 나머지는 진행, 막힌 것은 이유와 함께 돌려준다. */
export async function restoreTrash(email: string, items: { kind: TrashKind; id: string }[], sheetOverride?: string): Promise<TrashRestoreResult> {
  const result: TrashRestoreResult = { restored: 0, failed: [] };
  const fail = (kind: TrashKind, id: string, e: unknown) => result.failed.push({ kind, id, reason: reasonOf(e) });
  for (const { kind, id } of items.filter((i) => i.kind !== "lead")) {
    try {
      if (kind === "todo") await restoreTodo(email, id, sheetOverride);
      else await restoreDeletedMeeting(email, id, sheetOverride);
      result.restored += 1;
    } catch (e) { fail(kind, id, e); }
  }
  // DB관리시트는 한 묶음 — 한 건이라도 같은 업체가 있으면 묶음 전체가 막히므로 한 건씩.
  const leadIds = items.filter((i) => i.kind === "lead").map((i) => i.id);
  if (leadIds.length) {
    const ctx = await resolveDbSheetContext(email, sheetOverride);
    for (const id of leadIds) {
      try { await executeDbSheet(ctx, { action: "trash-restore", ids: [id] }); result.restored += 1; }
      catch (e) { fail("lead", id, e); }
    }
  }
  return result;
}
