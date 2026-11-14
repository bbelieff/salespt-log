"use client";
/**
 * 캘린더 한 달 화면의 데이터·저장 — PC 한 달 보드(MonthBoard)와 폰 월 보기(PhoneMonth)가 같이 쓴다.
 * 달력 줄(이웃 달 포함)·그 날 일정·메모·이번 달 결과·수강 주차 + 미팅 저장 함수(주간 보드와 같은 것)·구글 캘린더 담기 상태.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Meeting, Todo } from "@/types";
import { useMeetingDeleteConfirm } from "@/components/meeting-safety/use-meeting-delete-confirm";
import { useMonthMeetings, useWeekMeetings } from "@/query/contact-hooks";
import { useSaveScheduleNote, useScheduleNotes } from "@/query/schedule-notes-hooks";
import type { DayOrder } from "../../../schedule/_lib/board";
import { addDays, fmtISO, friOf, parseISO, weekIndexOf } from "../../../schedule/_lib/week";
import { useManualLinkPrompt } from "../../../schedule/_lib/use-manual-link-prompt";
import { useMeetingActions } from "../../../schedule/_lib/useMeetingActions";
import { useMeetingPatch } from "../../../schedule/_lib/useMeetingPatch";
import type { LayerKey, Layers } from "../../../schedule/_components/board/board-style";
import { shiftMonth } from "../../_lib/month";
import type { GcalBridge } from "./DayPanel";
import type { DayItem, MonthCell, MonthRow } from "./MonthGrid";

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function useMonthData({ yyyyMM, selected, todayISO, order }: { yyyyMM: string; selected: string; todayISO: string; order: DayOrder }) {
  const qc = useQueryClient();
  const [layers, setLayers] = useState<Layers>({ meet: true, todo: true, event: true });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  // 달력 줄: 그 달 1일이 든 주부터 말일이 든 주까지(5~6줄). 이웃 달 날짜도 같이 읽어 흐리게 보여 준다.
  const { start, weeks, y, mon } = useMemo(() => {
    const [yy, mm] = yyyyMM.split("-").map(Number) as [number, number];
    const first = new Date(yy, mm - 1, 1), last = new Date(yy, mm, 0);
    const s = addDays(first, -((first.getDay() - (order === "fri" ? 5 : 1) + 7) % 7));
    let n = 0;
    while (addDays(s, n * 7) <= last) n++;
    return { start: s, weeks: n, y: yy, mon: mm };
  }, [yyyyMM, order]);
  const startISO = fmtISO(start), endISO = fmtISO(addDays(start, weeks * 7 - 1));
  const prevYM = shiftMonth(yyyyMM, -1), nextYM = shiftMonth(yyyyMM, 1);
  const cur = useMonthMeetings(yyyyMM);
  const prev = useMonthMeetings(startISO.slice(0, 7) === prevYM ? prevYM : "");
  const next = useMonthMeetings(endISO.slice(0, 7) === nextYM ? nextYM : "");
  const courseStart = useWeekMeetings(fmtISO(friOf(parseISO(todayISO)))).data?.courseStart;
  const notes = useScheduleNotes(startISO, fmtISO(friOf(start)), weeks * 7);
  const saveNote = useSaveScheduleNote();
  const memos = notes.data?.memos ?? {};
  const saveMemo = (date: string, text: string) => saveNote.mutate({ kind: "memo", date, text }, { onError: () => showToast("메모를 저장하지 못했어요 — 잠시 뒤 다시 적어 주세요.") });

  const { meetingsByDate, todosByDate, all } = useMemo(() => {
    const mb = new Map<string, Meeting[]>(), tb = new Map<string, Todo[]>(), flat: Meeting[] = [];
    for (const v of [prev.data, cur.data, next.data]) {
      for (const d of v?.daysByMeetingDate ?? []) { mb.set(d.date, d.meetings); flat.push(...d.meetings); }
      for (const d of v?.daysByTodoDate ?? []) tb.set(d.date, d.todos);
    }
    return { meetingsByDate: mb, todosByDate: tb, all: flat };
  }, [prev.data, cur.data, next.data]);

  /** 그 날 일정 — full = 그 날 목록(변경·취소 포함), 아니면 달력 칸(변경·취소는 숨김, 기존 캘린더와 같음). */
  const itemsOf = (date: string, full: boolean): DayItem[] => {
    const out: DayItem[] = [];
    if (layers.meet) for (const m of meetingsByDate.get(date) ?? []) if (full || (m.상태 !== "변경" && m.상태 !== "취소")) out.push({ kind: "m", id: m.id, time: m.미팅시간, m });
    for (const t of todosByDate.get(date) ?? []) {
      const ev = t.type === "일반";
      if (ev ? layers.event : layers.todo) out.push({ kind: ev ? "e" : "t", id: t.id, time: t.예정시각, t });
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  };

  const cs = courseStart ? parseISO(courseStart) : null;
  const rows: MonthRow[] = Array.from({ length: weeks }, (_, r) => {
    const ws = addDays(start, r * 7), we = addDays(ws, 6);
    const a = cs ? weekIndexOf(ws, cs) : 0, z = cs ? weekIndexOf(we, cs) : 0;
    const course = z >= 1;
    const label = !course ? `${md(fmtISO(ws))}~` : a === z ? `수강 ${a}주` : `수강 ${[a, z].filter((n) => n >= 1).join("·")}주`;
    const cells: MonthCell[] = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i), date = fmtISO(d), items = itemsOf(date, false);
      return { date, day: d.getDate(), month: d.getMonth() + 1, dow: d.getDay(), out: d.getMonth() + 1 !== mon, items, count: items.length, memo: !!memos[date], cw: cs ? weekIndexOf(d, cs) : 0 };
    });
    const wm = cells.flatMap((c) => meetingsByDate.get(c.date) ?? []).filter((m) => m.상태 !== "변경" && m.상태 !== "취소");
    const con = wm.filter((m) => m.상태 === "계약").length;
    return { start: fmtISO(ws), label, course, stats: wm.length ? `미팅 ${wm.length}${con ? ` · 계약 ${con}` : ""}` : "", current: todayISO >= fmtISO(ws) && todayISO <= fmtISO(we), cells };
  });

  const firstW = cs ? weekIndexOf(new Date(y, mon - 1, 1), cs) : 0, lastW = cs ? weekIndexOf(new Date(y, mon, 0), cs) : 0;
  const course = lastW < 1 ? "" : firstW === lastW ? `수강 ${firstW}주` : `수강 ${Math.max(firstW, 1)}~${lastW}주`;
  const monthMeetings = useMemo(() => (cur.data?.daysByMeetingDate ?? []).flatMap((d) => d.meetings), [cur.data]);
  const fee = monthMeetings.filter((m) => m.상태 === "계약").reduce((s, m) => s + (m.수임비 || 0), 0);
  const followUps = useMemo(() => new Set(all.flatMap((m) => (m.previousMeetingId ? [m.previousMeetingId] : []))), [all]);

  // 저장 — 주간 보드와 같은 함수. 주간 목록은 어느 주가 바뀌었는지 몰라 통째로 다시 읽게 한다.
  const deleteConfirm = useMeetingDeleteConfirm();
  const manualLink = useManualLinkPrompt();
  const refreshWeeks = () => qc.invalidateQueries({ queryKey: ["week"] });
  const after = <A extends unknown[]>(fn: (...a: A) => unknown) => async (...a: A) => { try { await fn(...a); } finally { void refreshWeeks(); } };
  const patch = useMeetingPatch({ weekStart: "", setPendingId, showToast, manualLink, findMeeting: (id) => all.find((m) => m.id === id) });
  const act = useMeetingActions({ weekStart: "", setPendingId, showToast, deleteConfirm });
  /** BoardMeetingPop 에 그대로 펼쳐 넣는 값 — 주간 보드(schedule/page.tsx)와 같은 구성. */
  const meetingProps = (m: Meeting) => ({
    meeting: m, pending: pendingId === m.id,
    onPatch: after((partial: Partial<Omit<Meeting, "id">>, opts?: { quiet?: boolean }) => patch(m.id, partial, opts)),
    onReschedule: after((d: string, t: string, r: string) => act.handleReschedule(m, d, t, r)),
    onRevert: after(() => act.handleRevert(m.id)), onAddMeeting: after((d: string, t: string) => act.handleAddMeeting(m, d, t)),
    onDelete: after(() => act.handleDelete(m)), hasFollowUp: followUps.has(m.id), onReviveCase: after(() => act.handleReviveCase(m)),
  });

  const toggleLayer = (k: LayerKey) => setLayers((l) => {
    if (l[k] && Object.values(l).filter(Boolean).length === 1) { showToast("적어도 한 가지는 보여야 해요"); return l; }
    return { ...l, [k]: !l[k] };
  });

  // 구글 캘린더 담기 상태 — 선택한 날의 일정만 한 번에 조회(연결한 사람에게만 스위치가 보인다).
  const dayItems = itemsOf(selected, true);
  const dayKey = dayItems.map((i) => `${i.kind}${i.id}`).join(",");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalStates, setGcalStates] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const meetingIds = dayItems.flatMap((i) => (i.kind === "m" ? [i.id] : [])), todoIds = dayItems.flatMap((i) => (i.kind === "m" ? [] : [i.id]));
    if (!meetingIds.length && !todoIds.length) return;
    let cancelled = false;
    void fetch("/api/gcal/states", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingIds, todoIds }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { connected: boolean; states: Record<string, boolean> } | null) => {
        if (cancelled || !data) return;
        setGcalConnected(!!data.connected);
        // 로컬 우선 병합 — 늦게 도착한 조회가 방금 누른 값을 덮지 않게.
        setGcalStates((s) => ({ ...data.states, ...s }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dayKey 가 그 날 일정 목록을 대표한다(배열은 렌더마다 새로 만들어짐)
  }, [dayKey]);
  const gcal: GcalBridge = { connected: gcalConnected, states: gcalStates, onChange: (id, on) => setGcalStates((s) => ({ ...s, [id]: on })), onToast: showToast };

  /** 일반 일정을 만든 뒤 — GeneralEventModal 은 직접 저장하므로 목록을 다시 읽게 한다. */
  const refreshAfterCreate = () => { void qc.invalidateQueries({ queryKey: ["month"] }); void qc.invalidateQueries({ queryKey: ["todos", "all"] }); };

  return {
    y, mon, rows, course, layers, toggleLayer, dayItems, memos, saveMemo, notesReady: notes.isSuccess, isError: cur.isError,
    monthMeetings, fee, thisMonth: yyyyMM === todayISO.slice(0, 7),
    findMeeting: (id: string) => all.find((m) => m.id === id), findTodo: (id: string) => [...todosByDate.values()].flat().find((t) => t.id === id),
    meetingProps, gcal, toast, showToast, refreshAfterCreate, elements: <>{deleteConfirm.element}{manualLink.element}</>,
  };
}
