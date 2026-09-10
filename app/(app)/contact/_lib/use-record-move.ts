/**
 * 「잘못 적었어요 → 옮기기」 배선 — `page.tsx` 에서 분리(500줄 캡, 2026-09-03).
 *
 * 규칙(무엇이 얼마나 움직이나)은 `record-move.ts`, 화면은 `RecordMoveModal`,
 * 여기는 **결정을 실제 데이터에 적용**하는 부분만 맡는다.
 *
 * RecordMoveModal의 최종 [저장하기]에서만 호출한다. 선택/미리보기/취소에는 쓰기 없음.
 * 선택 채널의 남은 신규 카드도 원래 날짜에 함께 저장해 화면 이동 후 유실을 막는다.
 *
 * ## 순서: 미팅 카드 먼저, 숫자 나중
 * `saveContactMetrics` 가 미팅예약(H)을 **그 날짜·채널의 카드 수로 다시 센다**(ADR-0010).
 * 카드를 먼저 옮겨야 양쪽 날짜의 H 가 옳게 잡힌다.
 */
"use client";

import { useRef, useState } from "react";
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
  saving: boolean;
  error: string;
  receipt: { fromLabel: string; toLabel: string; from: ChannelDailyRowMetrics; to: ChannelDailyRowMetrics } | null;
  clearReceipt: () => void;
} {
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const appended = useRef(new Set<string>());
  const attempt = useRef<{ decision: MoveDecision; source: ChannelDailyRowMetrics } | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ fromLabel: string; toLabel: string; from: ChannelDailyRowMetrics; to: ChannelDailyRowMetrics } | null>(null);
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

  const applyMove = async (decision: MoveDecision) => {
    const d = attempt.current?.decision ?? decision;
    const slot = newSlots.find((x) => x.tempId === d.key);
    if (!slot || lock.current) return;
    attempt.current ??= { decision: d, source: draft[slot.channel] };
    lock.current = true;
    setError("");
    setSaving(true);
    const crossDate = d.to.date !== date;
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
      const sourceSlots = newSlots.filter((x) => x.channel === slot.channel);
      if (sourceSlots.some((x) => !isSlotComplete(x))) throw new Error("남은 미팅의 필수 항목을 먼저 채워주세요");
      for (const sourceSlot of sourceSlots) {
        const movingSlot = sourceSlot.tempId === d.key || wholeChannel;
        const destination = movingSlot ? d.to.date : date;
        const channel = movingSlot ? d.to.channel : sourceSlot.channel;
        if (!appended.current.has(sourceSlot.tempId)) {
          await appendMeeting.mutateAsync({
            date: destination,
            meeting: buildMeetingFromSlot({ ...sourceSlot, channel }, destination),
          });
          appended.current.add(sourceSlot.tempId);
        }
      }
      const res = await moveMetrics.mutateAsync({
        from: { date, channel: slot.channel, metrics: attempt.current.source },
        to: { date: d.to.date, channel: d.to.channel, metrics: d.to.metrics ?? (crossDate ? undefined : draft[d.to.channel]) },
        deltas: d.deltas,
      });
      // 서버는 저장된 카드만 센다. 다른 채널의 미저장 카드가 있으면 UI에만 보존한다.
      const destinationNew = crossDate ? 0 : newSlots.filter((x) => x.channel === d.to.channel && x.channel !== slot.channel).length;
      const from = res.from;
      const to = { ...res.to, meetingReservation: res.to.meetingReservation + destinationNew };
      setDraft((prev) => ({ ...prev, [slot.channel]: from, ...(!crossDate ? { [d.to.channel]: to } : {}) }));
      setReceipt({ fromLabel: `${fmtMD(parseISO(date))} ${slot.channel}`, toLabel: `${fmtMD(parseISO(d.to.date))} ${d.to.channel}`, from, to });
      const savedIds = new Set(sourceSlots.map((x) => x.tempId));
      setNewSlots((prev) => prev.filter((x) => !savedIds.has(x.tempId)));
      attempt.current = null;
      setActiveChannel(d.to.channel);
      // 옮기고 남은 슬롯이 있으면 확인 화면으로 되돌아간다(고친 내용을 다시 보여줌).
      onDone(newSlots.some((x) => !savedIds.has(x.tempId)));
      showToast(
        crossDate
          ? `${d.to.channel} ${fmtMD(parseISO(d.to.date))}로 옮겨 저장했어요`
          : wholeChannel
            ? `${d.to.channel}로 바꿨어요${alsoSaved.length ? ` · 미팅 ${alsoSaved.length + 1}건 함께` : ""}`
            : `${d.to.channel}로 옮겼어요`,
      );
    } catch (e) {
      setError(`저장을 완료하지 못했어요: ${(e as Error).message}. 일부 기록은 반영됐을 수 있어요. 같은 내용으로 저장을 다시 눌러 마무리해주세요.`);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return { moveCandidates, applyMove, saving, error, receipt, clearReceipt: () => setReceipt(null) };
}
