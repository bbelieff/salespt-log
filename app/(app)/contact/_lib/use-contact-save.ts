/**
 * 컨택탭 통합 저장 — `page.tsx` 에서 분리(500줄 캡, 2026-09-03).
 *
 * 로직은 **한 줄도 안 바꿨다.** 「저장 전 확인 화면」을 붙일 자리를 page.tsx 에 만들려고
 * 그대로 들어냈을 뿐이다. 순서·실패격리·coalescer 전부 이전과 동일:
 *   ① 신규슬롯 append(병렬) → ② dirty 미팅 patch(병렬) → ③ 지표 저장
 *
 * BBE-243 주석 보존: savingRef 애드혹 가드는 저장 중 재클릭을 그냥 버렸다(최신 draft 무시
 * 위험) — 공용 coalescer 로 교체(마지막 draft 로 1회 더 실행). append 루프도 병렬화해
 * 항목마다 Sheets 429 재시도 백오프가 순차로 쌓이는 "긴 정지"를 없앤다.
 */
"use client";

import { useRef } from "react";
import type { Channel, Meeting } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import type {
  useAppendMeeting,
  useSaveMetrics,
} from "@/query/contact-hooks";
import { createSaveCoalescer } from "@/util/save-coalesce";
import type { NewSlot } from "../_components/MeetingSlotItem";

export function slotComplete(s: NewSlot): boolean {
  return !!s.미팅날짜 && !!s.미팅시간 && !!s.업체명.trim() && !!s.장소.trim();
}

/** 슬롯 → 04 업체관리 1행. `reservationDate` 가 예약일(B) = 기록하는 날짜.
 *  「잘못 적었어요」로 다른 날짜에 옮겨 저장할 때는 호출부가 그 날짜를 넘긴다. */
export function buildMeetingFromSlot(slot: NewSlot, reservationDate: string): Meeting {
  return {
    id: slot.tempId,
    예약일: reservationDate,
    예약시각: new Date().toTimeString().slice(0, 5),
    미팅날짜: slot.미팅날짜,
    미팅시간: slot.미팅시간,
    channel: slot.channel,
    업체명: slot.업체명.trim(),
    장소: slot.장소.trim(),
    예약비고: slot.예약비고.trim(),
    업체정보: slot.업체정보, // 신규 슬롯에서 입력한 업체정보 → 04 T~AS (§3-1)
    상태: "예약",
    계약여부: false,
    수임비: 0,
    미팅사유: "",
    계약조건: "",
  };
}

interface Deps {
  date: string;
  draft: Record<Channel, ChannelDailyRowMetrics>;
  newSlots: NewSlot[];
  appendMeeting: ReturnType<typeof useAppendMeeting>;
  saveMetrics: ReturnType<typeof useSaveMetrics>;
  saveAllDirty: () => Promise<number>;
  setNewSlots: (next: NewSlot[]) => void;
  setMetricsTouched: (v: boolean) => void;
  setShowProductionHold: (v: boolean) => void;
  showToast: (msg: string) => void;
}

export function useContactSave(deps: Deps): { handleSave: () => void } {
  const coalescer = useRef(createSaveCoalescer<void>());
  const latest = useRef(deps);
  latest.current = deps;

  const runSave = async () => {
    const {
      date: dateAtClick,
      draft: draftAtClick,
      newSlots: newSlotsAtClick,
      appendMeeting,
      saveMetrics,
      saveAllDirty,
      setNewSlots,
      setMetricsTouched,
      setShowProductionHold,
      showToast,
    } = latest.current;

    let failed = 0;
    const completable = newSlotsAtClick.filter(slotComplete);
    const lacking = newSlotsAtClick.length - completable.length;
    const completableIds = new Set(completable.map((s) => s.tempId));
    const results = await Promise.allSettled(
      completable.map((slot) =>
        appendMeeting.mutateAsync({
          date: dateAtClick,
          meeting: buildMeetingFromSlot(slot, dateAtClick),
        }),
      ),
    );
    const failedIds = new Set(
      completable.filter((_, i) => results[i]!.status === "rejected").map((s) => s.tempId),
    );
    failed += failedIds.size;
    // ① 완료돼 append 성공한 슬롯만 제거 — 미완료·실패분은 원래 순서 그대로 유지.
    const keep = newSlotsAtClick.filter(
      (s) => !completableIds.has(s.tempId) || failedIds.has(s.tempId),
    );
    if (keep.length !== newSlotsAtClick.length) setNewSlots(keep);
    failed += await saveAllDirty(); // ② dirty 미팅 patch (병렬, 실패 격리)
    // ③ 지표 저장 (H=카드수 재계산 + 직접생산 M 동기화).
    try {
      const res = await saveMetrics.mutateAsync({
        date: dateAtClick,
        channels: draftAtClick,
      });
      if (res?.directProductionHold) setShowProductionHold(true);
      setMetricsTouched(false); // 지표 저장 성공 → 미저장 표식 해제
    } catch {
      failed++;
    }
    if (lacking > 0)
      showToast(`⚠ 필수누락 ${lacking}건은 남겨뒀어요 · 나머지는 저장됨`);
    else if (failed > 0)
      showToast(`일부 저장 실패 ${failed}건 — 다시 시도해주세요`);
    else showToast("✅ 저장 완료");
  };

  return {
    handleSave: () => {
      void coalescer.current.trigger(runSave);
    },
  };
}
