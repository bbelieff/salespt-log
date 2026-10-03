/**
 * Per-draft 예약 등록 — stable tempId, single-flight, idempotent retry.
 * 실패해도 폼 유지 + 인라인 재시도. 성공 응답을 못 받았을 수 있어도(타임아웃)
 * 재시도 전 서버 존재를 확인하므로 중복 행이 생기지 않는다.
 */
"use client";

import { useRef, useState } from "react";
import type { Meeting } from "@/types";
import type { useAppendMeeting } from "@/query/contact-hooks";
import type { NewSlot } from "../_components/MeetingSlotItem";
import { buildMeetingFromSlot, slotComplete } from "./meeting-draft";
import { shouldSkipRegister } from "./metrics-autosave";

interface Deps {
  date: string;
  newSlots: NewSlot[];
  serverMeetings: Meeting[];
  appendMeeting: ReturnType<typeof useAppendMeeting>;
  setNewSlots: React.Dispatch<React.SetStateAction<NewSlot[]>>;
  showToast: (msg: string) => void;
  /** Fresh server meetings after a failure (timeout ambiguity check). */
  refetchMeetings: () => Promise<Meeting[]>;
}

export function useSlotRegister(deps: Deps): {
  registerSlot: (tempId: string) => Promise<boolean>;
  registering: Set<string>;
  registerErrors: Record<string, string>;
  clearRegisterErrors: () => void;
} {
  const latest = useRef(deps);
  latest.current = deps;
  const flight = useRef(new Set<string>());
  const [registering, setRegistering] = useState<Set<string>>(new Set());
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  const registerSlot = async (tempId: string): Promise<boolean> => {
    const {
      date: dateAtClick, newSlots: slots, serverMeetings: saved,
      appendMeeting, setNewSlots, showToast, refetchMeetings,
    } = latest.current;
    if (flight.current.has(tempId)) return false;
    const slot = slots.find((s) => s.tempId === tempId);
    if (!slot) return true;
    if (!slotComplete(slot)) {
      showToast("미팅 카드의 필수 입력을 먼저 채워주세요.");
      return false;
    }
    flight.current.add(tempId);
    setRegistering(new Set(flight.current));
    setRegisterErrors((e) => {
      if (!(tempId in e)) return e;
      const next = { ...e };
      delete next[tempId];
      return next;
    });
    try {
      const existing = new Set(saved.map((m) => m.id));
      if (!shouldSkipRegister(tempId, existing)) {
        await appendMeeting.mutateAsync({
          date: dateAtClick, // 이 동작의 기록 날짜로 고정
          meeting: buildMeetingFromSlot(slot, dateAtClick),
        });
      }
      setNewSlots((s) => s.filter((x) => x.tempId !== tempId));
      return true;
    } catch (e) {
      // 타임아웃 애매성: 재조회 후 존재하면(경합에서 이겼으면) 성공 처리.
      const fresh = await refetchMeetings().catch(() => [] as Meeting[]);
      if (shouldSkipRegister(tempId, new Set(fresh.map((m) => m.id)))) {
        setNewSlots((s) => s.filter((x) => x.tempId !== tempId));
        return true;
      }
      setRegisterErrors((errs) => ({
        ...errs,
        [tempId]: `등록 실패: ${(e as Error).message} · 입력은 그대로 있어요`,
      }));
      return false;
    } finally {
      flight.current.delete(tempId);
      setRegistering(new Set(flight.current));
    }
  };

  return {
    registerSlot,
    registering,
    registerErrors,
    clearRegisterErrors: () => setRegisterErrors({}),
  };
}
