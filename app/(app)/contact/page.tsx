/** 컨택관리 탭 — 4채널 4지표 + 미팅 슬롯. SSOT: docs/design/prototypes/contact-daily-input.html v7. */
"use client";
import PageContainer from "@/components/PageContainer";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";

import { useEffect, useMemo, useState } from "react";
import { CHANNEL_ORDER, type Channel, type Meeting } from "@/types";
import {
  useAppendMeeting,
  useDay,
  usePatchMeeting,
  useMoveDailyMetrics,
  useRemoveMeeting,
  useSaveMetrics,
  useWeekMeetings,
} from "@/query/contact-hooks";
import type { ChannelDailyRowMetrics } from "@/service";
import { useSwipe } from "@/lib/hooks/useSwipe";
import WeekHeader from "./_components/WeekHeader";
import ChannelTabsAndPanel from "./_components/ChannelTabsAndPanel";
import TopHeader from "@/components/TopHeader";
import type { NewSlot } from "./_components/MeetingSlotItem";
import MeetingSlotList from "./_components/MeetingSlotList";
import { useGuardedNav, useDirtyEntry } from "@/components/DirtyGuard";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import ContactResultModals from "./_components/ContactResultModals";
import CrossTabHintModal from "@/components/ui/CrossTabHintModal";
import { useRouter } from "next/navigation";
import { uuid } from "./_lib/contactDefaults";
import { useContactMetrics } from "./_lib/use-contact-metrics";
import { friOf, fmtISO, parseISO, weekIndexOf } from "./_lib/week";
import { useCrossTabParams } from "./_lib/useCrossTabParams";
import { formatMoney } from "@/lib/format/money";
import RecordMoveModal from "./_components/RecordMoveModal";
import { slotComplete } from "./_lib/meeting-draft";
import { useSlotRegister } from "./_lib/use-slot-register";
import {
  channelConsistencyWarnings,
  metricsSavePayload,
} from "./_lib/metrics-autosave";
import RecordMoveReceipt from "./_components/RecordMoveReceipt";
import { useRecordMove } from "./_lib/use-record-move";
import { discardUnsaved } from "@/components/weekly-goals/weeklyGoalAutosave";

const TODAY_ISO = fmtISO(new Date());

export default function ContactPage() {
  const router = useRouter();
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [showProductionHold, setShowProductionHold] = useState(false); // ADR-0024 보류 모달
  const [activeChannel, setActiveChannel] = useState<Channel>("매입DB");
  const [toast, setToast] = useState<string>("");
  const [newSlots, setNewSlots] = useState<NewSlot[]>([]);
  const [pickerMeetings, setPickerMeetings] = useState<Meeting[] | null>(null);
  // 「잘못 적었어요」 옮기기 (2026-09-03 belie) — 숫자 확인 모달 없음, 자동 저장.
  const [moveOpen, setMoveOpen] = useState(false);

  const dayQuery = useDay(date);
  const weekStartISO = useMemo(() => fmtISO(friOf(parseISO(date))), [date]);
  const weekQuery = useWeekMeetings(weekStartISO);
  const saveMetrics = useSaveMetrics();
  const [highlightProduction, setHighlightProduction] = useState(false);
  const appendMeeting = useAppendMeeting();
  const patchMeeting = usePatchMeeting();
  const removeMeeting = useRemoveMeeting();
  const moveMetrics = useMoveDailyMetrics();

  const countsByDay =
    weekQuery.data?.daysByReservationDate.map((d) => d.meetings.length) ??
    (Array(7).fill(0) as number[]);
  const weekFunnel = weekQuery.data?.weekFunnel ?? { 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0 };

  // 숫자 지표 자동 저장 — 채널 숫자만 POST, 미팅 드래프트·dirty 카드와 무관.
  // 서버 스냅샷 병합은 훅 안에서 content-keyed syncServer 로 처리.
  const metrics = useContactMetrics({
    date,
    serverChannels: dayQuery.data?.date === date ? dayQuery.data.channels : undefined,
    saveMetrics,
    onProductionHold: () => setShowProductionHold(true),
  });

  // 날짜 교체 = 신규 슬롯 비움 + 일관성 안내. 숫자 기준 이동은 훅이 담당.
  useEffect(() => {
    const server = dayQuery.data;
    if (!server || server.date !== date) return;
    setNewSlots([]); // 날짜 바뀌면 신규 슬롯도 비움
    clearRegisterErrors();

    const bad = channelConsistencyWarnings(server);
    if (bad.length > 0) {
      setToast("⚠ 시트 일관성 경고: " + bad.join(", ") + ". '−' 버튼으로 정정 가능");
      setTimeout(() => setToast(""), 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayQuery.data?.date]);

  useCrossTabParams({ setActiveChannel, setDate, setHighlightProduction });

  const savedByChannel = useMemo(() => {
    const result: Record<Channel, Meeting[]> = {
      매입DB: [],
      직접생산: [],
      현수막: [],
      "콜·지·기·소": [],
    };
    for (const m of dayQuery.data?.meetings ?? []) {
      result[m.channel].push(m);
    }
    return result;
  }, [dayQuery.data]);

  const newSlotsForChannel = (ch: Channel) =>
    newSlots.filter((s) => s.channel === ch);

  const meetingCardCount = (ch: Channel) =>
    savedByChannel[ch].length + newSlotsForChannel(ch).length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  // Per-draft 예약 등록 (실패해도 폼 유지 + 인라인 재시도, 중복 방지).
  const { registerSlot, registering, registerErrors, clearRegisterErrors } = useSlotRegister({
    date, newSlots, serverMeetings: dayQuery.data?.meetings ?? [], appendMeeting, setNewSlots, showToast,
    refetchMeetings: async () => (await dayQuery.refetch?.())?.data?.meetings ?? [],
  });

  const setMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    nextValue: number,
  ) => {
    const cur = metrics.draft[channel];
    const next: ChannelDailyRowMetrics = { ...cur, [key]: Math.max(0, nextValue) };
    if (next.meetingReservation > next.contactProgress) {
      next.meetingReservation = next.contactProgress;
    }
    metrics.update({ ...metrics.draft, [channel]: next });
  };

  /** 채널 metric ±delta 조정 (functional 대신 최신 draft 읽기 — stale closure 안전). */
  const adjustMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    delta: number,
  ) => {
    const cur = metrics.draft[channel];
    const newValue = Math.max(0, cur[key] + delta);
    const next: ChannelDailyRowMetrics = { ...cur, [key]: newValue };
    if (next.meetingReservation > next.contactProgress) {
      next.meetingReservation = next.contactProgress;
    }
    metrics.update({ ...metrics.draft, [channel]: next });
  };

  /** step(key, delta): 미팅예약 +1 → 신규 슬롯 생성, -1 → 슬롯 제거 또는 API DELETE. */
  const step = (key: keyof ChannelDailyRowMetrics, delta: number) => {
    const ch = activeChannel;
    const cur = metrics.draft[ch];
    const cur2 = cur[key];

    if (key === "meetingReservation") {
      if (delta > 0) {
        if (cur2 >= cur.contactProgress) {
          showToast("⚠ 미팅예약은 컨택진행보다 클 수 없어요");
          return;
        }
        const empty: NewSlot = {
          tempId: uuid(),
          channel: ch,
          미팅날짜: date,
          미팅시간: "",
          업체명: "",
          장소: "",
          예약비고: "",
        };
        setNewSlots((s) => [...s, empty]);
        adjustMetric(ch, "meetingReservation", +1);
      } else {
        const news = newSlotsForChannel(ch);
        if (news.length > 0) {
          const last = news[news.length - 1]!;
          setNewSlots((s) => s.filter((x) => x.tempId !== last.tempId));
          adjustMetric(ch, "meetingReservation", -1);
        } else {
          const saved = savedByChannel[ch];
          if (saved.length > 1) {
            setPickerMeetings(saved);
          } else if (saved.length === 1) {
            handleRemoveSavedMeeting(saved[0]!);
          } else if (cur2 > 0) {
            adjustMetric(ch, "meetingReservation", -1); // 카드 없는 phantom H 정정
            showToast("미팅 카드가 없어 미팅예약 수치만 −1로 정정했어요");
          } else {
            showToast("이 채널의 미팅예약이 이미 0입니다");
          }
        }
      }
      return;
    }

    if (key === "contactProgress" && delta < 0) {
      const cards = meetingCardCount(ch);
      if (cur2 + delta < cards) {
        showToast(
          `⚠ 미팅예약 ${cards}건이 잡혀 있어요. 먼저 미팅예약을 −로 줄여 미팅을 삭제한 뒤 컨택진행을 낮춰주세요`,
        );
        return;
      }
    }

    // 현수막 게시(production): 재고 0 이면 + 불가(ADR-0025).
    if (ch === "현수막" && key === "production" && delta > 0) {
      if ((dayQuery.data?.bannerStockBase ?? 0) - cur2 <= 0) {
        showToast("⚠ 현수막 재고가 없어요. 먼저 DB생산에서 주문을 추가하세요");
        return;
      }
    }

    adjustMetric(ch, key, delta);
  };

  const setVal = (key: keyof ChannelDailyRowMetrics, value: number) => {
    const v = Math.max(0, value);
    if (key === "contactProgress") {
      const cards = meetingCardCount(activeChannel);
      if (v < cards) {
        showToast(
          `⚠ 미팅예약 ${cards}건이 잡혀 있어요. 먼저 미팅예약을 −로 줄여 미팅을 삭제한 뒤 컨택진행을 낮춰주세요`,
        );
        return;
      }
    }
    // 현수막 게시는 재고 초과 불가 (ADR-0025).
    const bStock = dayQuery.data?.bannerStockBase ?? 0;
    if (activeChannel === "현수막" && key === "production" && v > bStock) {
      showToast("⚠ 현수막 재고를 초과할 수 없어요");
      setMetric(activeChannel, key, Math.max(0, bStock));
      return;
    }
    setMetric(activeChannel, key, v);
  };

  const updateNewSlot = (tempId: string, next: NewSlot) =>
    setNewSlots((s) => s.map((x) => (x.tempId === tempId ? next : x)));

  const removeNewSlot = (tempId: string) => {
    const target = newSlots.find((s) => s.tempId === tempId);
    if (!target) return;
    setNewSlots((s) => s.filter((x) => x.tempId !== tempId));
    adjustMetric(target.channel, "meetingReservation", -1);
    showToast("✕ 삭제 · 미팅예약 -1");
  };

  const handleRemoveSavedMeeting = async (meeting: Meeting) => {
    const hasContract = meeting.상태 === "계약";
    const extra = hasContract ? `\n· 수납탭 계약카드 1건 (₩${formatMoney(meeting.수임비)})` : "";
    if (!confirm(`'${meeting.업체명}' 미팅을 삭제할까요?\n\n함께 사라지는 것:\n· 일정탭 미팅카드 1건\n· 컨택탭 미팅예약 -1 (${meeting.channel})${extra}`)) return;
    const dateAtClick = date;
    try {
      await removeMeeting.mutateAsync({ date: dateAtClick, id: meeting.id });
      adjustMetric(meeting.channel, "meetingReservation", -1);
      showToast(hasContract ? "✕ 미팅 + 계약카드 삭제 (미팅예약 -1)" : "✕ 삭제 · 미팅예약 -1");
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    }
  };

  // 등록 카드 자동 저장 — 성공은 조용히, 실패는 카드 내 재시도로.
  const handlePatchSavedMeeting = (
    id: string,
    partial: Partial<Omit<Meeting, "id">>,
    frozenDate: string,
  ) => patchMeeting.mutateAsync({ date: frozenDate, id, partial });

  /** 2026-05-18 [2]: 슬라이드 방향 state. */
  const [slideDir, setSlideDir] = useState<"right" | "left" | null>(null);
  const moveWeek = (deltaWeeks: number) => {
    if (!dayQuery.data) return;
    setSlideDir(deltaWeeks > 0 ? "right" : "left");
    const cur = new Date(date);
    cur.setDate(cur.getDate() + deltaWeeks * 7);
    setDate(fmtISO(cur));
    setTimeout(() => setSlideDir(null), 260);
  };

  const guardedNav = useGuardedNav();

  const { moveCandidates, applyMove, saving: moving, error: moveError, receipt, clearReceipt } = useRecordMove({
    date, draft: metrics.draft, newSlots, appendMeeting, patchMeeting, moveMetrics,
    savedMeetings: dayQuery.data?.meetings ?? [],
    setNewSlots,
    setDraft: (action) => {
      const next = typeof action === "function"
        ? (action as (p: Record<Channel, ChannelDailyRowMetrics>) => Record<Channel, ChannelDailyRowMetrics>)(metrics.draft)
        : action;
      metrics.syncServer(next); // 옮기기 결과는 서버 쓰기 — 재POST 없이 기준 이동
    },
    setActiveChannel,
    onDone: () => { setMoveOpen(false); },
    showToast,
  });

  const weekSwipe = useSwipe({
    onSwipeLeft: () => guardedNav(() => moveWeek(1)),
    onSwipeRight: () => guardedNav(() => moveWeek(-1)),
  });

  // 숫자 미저장 가드 — unsent/invalid 만 등록. 저장 성공분은 조용히 해제.
  // 이탈-버림은 discard (F2 core discard() 자동 사용; 아래 syncServer 2곳은
  // 옮기기/버림-복원이라는 서버 쓰기 결과의 기준 이동이라 discard가 아니다).
  useDirtyEntry(
    "contact-metrics",
    metrics.dirty,
    () => metrics.flush(),
    () => discardUnsaved(metrics),
    "컨택관리 입력 (저장 안 됨)",
  );

  // 미등록 신규 슬롯 가드 — save-and-leave 는 완성분만 등록, 미완성은 머무름.
  useDirtyEntry(
    "contact-new-slots",
    newSlots.length > 0,
    async () => {
      for (const s of newSlots) {
        if (!slotComplete(s)) throw new Error("필수 입력이 빠진 미팅이 있어요. 카드를 채우거나 삭제해 주세요.");
      }
      for (const s of newSlots) {
        const ok = await registerSlot(s.tempId);
        if (!ok) throw new Error("미팅 등록에 실패했어요. 다시 시도해 주세요.");
      }
    },
    () => {
      const counts = new Map<Channel, number>();
      for (const s of newSlots) counts.set(s.channel, (counts.get(s.channel) ?? 0) + 1);
      setNewSlots([]);
      if (counts.size > 0 && dayQuery.data) {
        // 버린 슬롯의 H 복원 — 즉시 1회 전송(디바운스 없이), 실패는 다음 자동 저장에.
        const next = { ...metrics.draft };
        for (const [ch, n] of counts) {
          next[ch] = { ...next[ch], meetingReservation: Math.max(0, next[ch].meetingReservation - n) };
        }
        metrics.syncServer(next);
        void saveMetrics.mutateAsync({ date, channels: metricsSavePayload(next) }).catch(() => {});
      }
    },
    "미등록 미팅",
  );

  if (dayQuery.isLoading) return null; // 전역 오버레이가 처리
  if (dayQuery.isError) {
    return (
      <section className="px-4 pt-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </div>
      </section>
    );
  }
  if (!dayQuery.data) return null;

  const { courseStart } = dayQuery.data;
  const weekIndex = weekIndexOf(parseISO(date), parseISO(courseStart));
  const allSlots: Array<
    | { kind: "saved"; meeting: Meeting }
    | { kind: "new"; slot: NewSlot }
  > = [];
  for (const ch of CHANNEL_ORDER) {
    for (const m of savedByChannel[ch]) allSlots.push({ kind: "saved", meeting: m });
    for (const s of newSlotsForChannel(ch)) allSlots.push({ kind: "new", slot: s });
  }

  return (
    <>
      <TopHeader pageEmoji="📞" pageTitle="컨택관리" />
      {/* 2026-05-18 [1]: 본문 fade 인터랙션(헤더 고정) */}
      <main
        className={`px-4 pt-4 pb-6 transition-opacity duration-200 ${
          dayQuery.isFetching ? "opacity-50" : "opacity-100"
        }`}
      ><PageContainer width="wide">
        <ChannelTabsAndPanel
          contextHeader={<div {...weekSwipe}><div className="px-3 pt-3 text-xs font-semibold text-slate-700">기록 날짜</div><WeekHeader
            weekIndex={weekIndex}
            courseStart={courseStart}
            selectedDate={date}
            todayISO={TODAY_ISO}
            cohortName={undefined}
            countsByDay={countsByDay}
            onPrevWeek={() => guardedNav(() => moveWeek(-1))}
            onNextWeek={() => guardedNav(() => moveWeek(1))}
            onSelectDay={(d) => guardedNav(() => setDate(d))}
            slideDir={slideDir}
          /></div>}
          active={activeChannel}
          draft={metrics.draft}
          date={date}
          inflowWaitBase={dayQuery.data?.inflowWaitBase ?? 0}
          savedInflow={dayQuery.data?.channels[activeChannel]?.inflow ?? 0}
          bannerStockBase={dayQuery.data?.bannerStockBase ?? 0}
          onSelectChannel={(channel) => {
            setActiveChannel(channel);
            try { sessionStorage.setItem("salespt-contact-channel", channel); } catch { /* Optional preference only. */ }
          }}
          onStep={step}
          onSetVal={setVal}
          highlightKey={highlightProduction ? "production" : undefined}
        />

        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="mb-1 flex flex-wrap gap-x-3 text-xs text-slate-500">주차합계 · 생산 {weekFunnel.생산} · 유입 {weekFunnel.유입} · 컨택진행 {weekFunnel.컨택진행} · 미팅예약 {weekFunnel.미팅예약}</div>
          <WeeklyGoalSummary compact date={date} metrics={["inflow", "contacts"]} />
        </div>
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5">
          <span className="text-xs text-slate-500">숫자는 자동으로 저장돼요</span>
          <AutosaveStatus status={metrics.status} error={metrics.error}
            savedAt={metrics.savedAt} onRetry={metrics.retry} />
        </div>
        <MeetingSlotList
          slots={allSlots}
          reservationDate={date}
          onPatchSaved={handlePatchSavedMeeting}
          onRemoveSaved={handleRemoveSavedMeeting}
          onChangeNew={updateNewSlot}
          onRemoveNew={removeNewSlot}
          onRegisterNew={(tempId) => { void registerSlot(tempId); }}
          registeringIds={registering}
          registerErrors={registerErrors}
          onMove={newSlots.length > 0 ? () => setMoveOpen(true) : null}
        />
      </PageContainer>
      </main>

      {moveOpen && (
        <RecordMoveModal
          open
          fromDate={date}
          candidates={moveCandidates}
          draft={metrics.draft}
          onBack={() => setMoveOpen(false)}
          onDismiss={() => setMoveOpen(false)}
          saving={moving}
          error={moveError}
          incomplete={newSlots.some((s) => !slotComplete(s))}
          onApply={(d) => { void applyMove(d); }}
        />
      )}

      {receipt && <RecordMoveReceipt receipt={receipt} onClose={clearReceipt} />}

      {toast && (
        <div className="fixed bottom-[152px] left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <ContactResultModals
        pickerMeetings={pickerMeetings}
        onPick={(m) => { setPickerMeetings(null); handleRemoveSavedMeeting(m); }}
        onPickerClose={() => setPickerMeetings(null)}
      />

      {/* 직접생산 유입 저장했으나 활성 생산 기간 없음 — DB생산 기간 먼저 추가 안내 (ADR-0024) */}
      <CrossTabHintModal
        open={showProductionHold}
        title="📊 진행 중인 생산이 없어요"
        body={
          <>
            유입은 저장됐어요. 그런데 <b>진행 중인 생산 기간</b>이 없어 생산개수에 자동
            집계되지 않았어요. DB생산에서 <b>생산목록(기간)</b>을 먼저 추가하면 이 기간의
            유입이 생산개수로 자동 카운트돼요.
          </>
        }
        navLabel="📊 DB생산으로 가기"
        onNavigate={() => {
          setShowProductionHold(false);
          router.push("/db?channel=직접생산");
        }}
        onClose={() => setShowProductionHold(false)}
      />
    </>
  );
}
