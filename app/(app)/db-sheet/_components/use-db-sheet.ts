"use client";
/**
 * DB관리시트 화면 훅 — 저장 규칙은 db-sheet-store(React 무관)에 있고, 여기서는 화면에 연결만 한다
 * (2026-10-19 구조 개선 ⑪). 반환 모양은 그대로라 화면 코드는 바뀌지 않는다.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useQueryClient } from "@tanstack/react-query";
import { todayKST } from "@/util/week";
import { contactDraft } from "./ContactPanel";
import { sheetRequest } from "./recording-client";
import { createDbSheetStore } from "./db-sheet-store";

/** 저장 뒤 다시 불러올 다른 화면 캐시. */
const AFFECTED_QUERIES = ["day", "week", "month", "dashboard", "db-sheet", "db", "meeting-follow-ups"];

export function useDbSheet() {
  const queryClient = useQueryClient();
  const [store] = useState(() => createDbSheetStore({
    transport: sheetRequest,
    invalidate: () => Promise.all(AFFECTED_QUERIES.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
    today: todayKST,
    contactDraft,
  }));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useEffect(() => store.load(), [store]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (state.pending || state.error || state.deleting) event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [state.pending, state.error, state.deleting]);
  // 10초 되돌리기 중인 삭제도 「변경사항」 — 다른 화면으로 가면 저장(=삭제 확정) 또는 버리기(=되돌리기)를 고른다.
  useDirtyEntry("db-sheet", state.pending > 0 || !!state.error || !!state.deleting, store.flushAll, store.discard, "DB관리시트 변경사항");
  return {
    ...state,
    clearAddition: store.clearAddition, clearNotice: store.clearNotice,
    stage: store.stage, absence: store.absence, linkMeeting: store.linkMeeting, bulkInflow: store.bulkInflow, scheduleDelete: store.scheduleDelete, undoDelete: store.undoDelete, commitDelete: store.commitDelete,
    edit: store.edit, asInfo: store.asInfo, contact: store.contact, record: store.record, register: store.register,
    add: store.add, flush: store.flush, recordingPreview: store.recordingPreview, configure: store.configure,
    inflowPreview: store.inflowPreview, configureInflow: store.configureInflow, reload: store.reload,
  };
}
