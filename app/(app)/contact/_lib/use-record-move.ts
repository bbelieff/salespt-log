/**
 * 「잘못 적었어요 → 옮기기」 배선 — `page.tsx` 에서 분리(500줄 캡, 2026-09-03).
 *
 * 규칙(무엇이 얼마나 움직이나)은 `record-move.ts`, 화면은 `RecordMoveModal`,
 * 여기는 **결정을 실제 데이터에 적용**하는 부분만 맡는다.
 *
 * ## 다른 날짜로 옮기면 왜 바로 저장하나
 * 저장 전 슬롯은 **지금 보고 있는 날짜에 묶여 있다** — 날짜를 바꾸면 `page.tsx` 의
 * 로드 이펙트가 신규 슬롯을 비운다(`setNewSlots([])`). 그래서 슬롯을 다른 날짜로 「들고
 * 갈」 수가 없다. 옮기는 순간 그 날짜로 append 해서 확정한다. 토스트가 「옮겨 저장했어요」로
 * 그 사실을 말해 준다.
 *
 * ## 순서: 미팅 카드 먼저, 숫자 나중
 * `saveContactMetrics` 가 미팅예약(H)을 **그 날짜·채널의 카드 수로 다시 센다**(ADR-0010).
 * 카드를 먼저 옮겨야 양쪽 날짜의 H 가 옳게 잡힌다.
 */
"use client";

import type { Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import type {
  useAppendMeeting,
  useMoveDailyMetrics,
  usePatchMeeting,
} from "@/query/contact-hooks";
import type { Meeting } from "@/types";
import type { NewSlot } from "../_components/MeetingSlotItem";
import type { MoveCandidate, MoveDecision } from "../_components/RecordMoveModal";
import { isSlotComplete } from "../_components/SaveConfirmModal";
import { buildMeetingFromSlot } from "./use-contact-save";
import { fmtMD, parseISO } from "./week";

interface Deps {
  date: string;
  draft: Record<Channel, ChannelDailyRowMetrics>;
  newSlots: NewSlot[];
  appendMeeting: ReturnType<typeof useAppendMeeting>;
  patchMeeting: ReturnType<typeof usePatchMeeting>;
  moveMetrics: ReturnType<typeof useMoveDailyMetrics>;
  /** 그날 이미 저장된 미팅 — 「채널 바꾸기」는 이것들도 함께 데려간다. */
  savedMeetings: Meeting[];
  setNewSlots: React.Dispatch<React.SetStateAction<NewSlot[]>>;
  setDraft: React.Dispatch<React.SetStateAction<Record<Channel, ChannelDailyRowMetrics>>>;
  setActiveChannel: (c: Channel) => void;
  onDone: (reopenConfirm: boolean) => void;
  showToast: (msg: string) => void;
}

export function useRecordMove(deps: Deps): {
  moveCandidates: MoveCandidate[];
  applyMove: (d: MoveDecision) => Promise<void>;
} {
  const {
    date, draft, newSlots, appendMeeting, patchMeeting, moveMetrics, savedMeetings,
    setNewSlots, setDraft, setActiveChannel, onDone, showToast,
  } = deps;

  const moveCandidates: MoveCandidate[] = newSlots.filter(isSlotComplete).map((s) => ({
    key: s.tempId,
    channel: s.channel,
    업체명: s.업체명.trim(),
    미팅날짜: s.미팅날짜,
    미팅시간: s.미팅시간,
  }));

  const applyMove = async (d: MoveDecision) => {
    const slot = newSlots.find((x) => x.tempId === d.key);
    if (!slot) return;
    const crossDate = d.to.date !== date;
    const wantsMetrics = (d.deltas.inflow ?? 0) > 0 || (d.deltas.contactProgress ?? 0) > 0;
    // 「채널 바꾸기」는 그 자리 기록이 통째로 다른 채널 몫이라는 뜻 — 그날 그 채널의
    // **대기 슬롯도 저장된 미팅도 전부** 따라가야 한다. 일부만 옮기면 숫자와 카드가 어긋난다.
    const wholeChannel = d.option === "chan";
    const alsoSaved = wholeChannel
      ? savedMeetings.filter((m) => m.예약일 === date && m.channel === slot.channel)
      : [];
    try {
      for (const m of alsoSaved) {
        await patchMeeting.mutateAsync({ date, id: m.id, partial: { channel: d.to.channel } });
      }
      if (crossDate) {
        await appendMeeting.mutateAsync({
          date: d.to.date,
          meeting: buildMeetingFromSlot({ ...slot, channel: d.to.channel }, d.to.date),
        });
        setNewSlots((prev) => prev.filter((x) => x.tempId !== d.key));
      } else {
        setNewSlots((prev) =>
          prev.map((x) =>
            x.tempId === d.key || (wholeChannel && x.channel === slot.channel)
              ? { ...x, channel: d.to.channel }
              : x,
          ),
        );
      }
      if (wantsMetrics) {
        const res = await moveMetrics.mutateAsync({
          from: { date, channel: slot.channel, metrics: draft[slot.channel] },
          to: {
            date: d.to.date,
            channel: d.to.channel,
            metrics: crossDate ? undefined : draft[d.to.channel],
          },
          deltas: d.deltas,
        });
        setDraft((prev) => {
          const next = { ...prev, [slot.channel]: res.from };
          if (!crossDate) next[d.to.channel] = res.to;
          return next;
        });
      }
      setActiveChannel(d.to.channel);
      // 옮기고 남은 슬롯이 있으면 확인 화면으로 되돌아간다(고친 내용을 다시 보여줌).
      onDone(newSlots.length > (crossDate ? 1 : 0));
      showToast(
        crossDate
          ? `${d.to.channel} ${fmtMD(parseISO(d.to.date))}로 옮겨 저장했어요`
          : wholeChannel
            ? `${d.to.channel}로 바꿨어요${alsoSaved.length ? ` · 미팅 ${alsoSaved.length + 1}건 함께` : ""}`
            : `${d.to.channel}로 옮겼어요`,
      );
    } catch (e) {
      onDone(false);
      showToast(`옮기기 실패: ${(e as Error).message}`);
    }
  };

  return { moveCandidates, applyMove };
}
