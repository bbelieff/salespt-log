/** 컨택관리 탭 — 4채널 4지표 + 미팅 슬롯. SSOT: docs/design/prototypes/contact-daily-input.html v7. */
"use client";
import PageContainer from "@/components/PageContainer";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHANNEL_ORDER, type Channel, type Meeting } from "@/types";
import {
  useAppendMeeting,
  useDay,
  usePatchMeeting,
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
import { useGuardedNav, useSaveAllDirty, useDirtyEntry } from "@/components/DirtyGuard";
import ContactResultModals from "./_components/ContactResultModals";
import CrossTabHintModal from "@/components/ui/CrossTabHintModal";
import { useRouter } from "next/navigation";
import SaveBar from "./_components/SaveBar";
import { EMPTY_BY_CHANNEL, uuid } from "./_lib/contactDefaults";
import { friOf, fmtISO, parseISO, weekIndexOf } from "./_lib/week";
import { useCrossTabParams } from "./_lib/useCrossTabParams";
import { formatMoney } from "@/lib/format/money";

const TODAY_ISO = fmtISO(new Date());

export default function ContactPage() {
  const router = useRouter();
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [showProductionHold, setShowProductionHold] = useState(false); // ADR-0024 보류 모달
  const [activeChannel, setActiveChannel] = useState<Channel>("매입DB");
  const [toast, setToast] = useState<string>("");
  const [draft, setDraft] = useState<Record<Channel, ChannelDailyRowMetrics>>(
    EMPTY_BY_CHANNEL,
  );
  const [newSlots, setNewSlots] = useState<NewSlot[]>([]);
  const [pickerMeetings, setPickerMeetings] = useState<Meeting[] | null>(null);
  // 지표 스테퍼를 사용자가 만졌는지(미저장 가드 신호). 로드·저장 시 리셋.
  const [metricsTouched, setMetricsTouched] = useState(false);

  const dayQuery = useDay(date);
  const weekStartISO = useMemo(() => fmtISO(friOf(parseISO(date))), [date]);
  const weekQuery = useWeekMeetings(weekStartISO);
  const saveMetrics = useSaveMetrics();
  const [highlightProduction, setHighlightProduction] = useState(false);
  const appendMeeting = useAppendMeeting();
  const patchMeeting = usePatchMeeting();
  const removeMeeting = useRemoveMeeting();

  const countsByDay =
    weekQuery.data?.daysByReservationDate.map((d) => d.meetings.length) ??
    (Array(7).fill(0) as number[]);
  const weekFunnel = weekQuery.data?.weekFunnel ?? { 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0 };

  useEffect(() => {
    if (!dayQuery.data) return;
    setDraft(dayQuery.data.channels);
    setNewSlots([]); // 날짜 바뀌면 신규 슬롯도 비움
    setMetricsTouched(false); // 새 날짜 로드 = 깨끗한 상태

    const bad: string[] = [];
    for (const ch of CHANNEL_ORDER) {
      const h = dayQuery.data.channels[ch].meetingReservation;
      const cnt = dayQuery.data.meetings.filter((m) => m.channel === ch).length;
      if (h > cnt) bad.push(`${ch}: 미팅예약 ${h} vs 미팅 ${cnt}건`);
    }
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

  const setMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    nextValue: number,
  ) => {
    if (key !== "meetingReservation") setMetricsTouched(true); // 미팅예약은 슬롯/미팅 lifecycle 별도
    setDraft((d) => {
      const cur = d[channel];
      const next: ChannelDailyRowMetrics = { ...cur, [key]: Math.max(0, nextValue) };
      if (next.meetingReservation > next.contactProgress) {
        next.meetingReservation = next.contactProgress;
      }
      return { ...d, [channel]: next };
    });
  };

  /** 채널 metric ±delta 조정 (functional setState — stale closure 안전). */
  const adjustMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    delta: number,
  ) => {
    if (key !== "meetingReservation") setMetricsTouched(true); // 미팅예약은 슬롯/미팅 lifecycle 별도
    setDraft((d) => {
      const cur = d[channel];
      const newValue = Math.max(0, cur[key] + delta);
      const next: ChannelDailyRowMetrics = { ...cur, [key]: newValue };
      if (next.meetingReservation > next.contactProgress) {
        next.meetingReservation = next.contactProgress;
      }
      return { ...d, [channel]: next };
    });
  };

  /** step(key, delta): 미팅예약 +1 → 신규 슬롯 생성, -1 → 슬롯 제거 또는 API DELETE. */
  const step = (key: keyof ChannelDailyRowMetrics, delta: number) => {
    const ch = activeChannel;
    const cur = draft[ch];
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
            showToast("미팅 카드가 없어 미팅예약 수치만 −1로 정정했어요 · [저장하기]로 반영");
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

  const slotComplete = (s: NewSlot) =>
    !!s.미팅날짜 && !!s.미팅시간 && !!s.업체명.trim() && !!s.장소.trim();

  const buildMeetingFromSlot = (slot: NewSlot, reservationDate: string): Meeting => ({
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
  });

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

  const handlePatchSavedMeeting = async (
    id: string,
    partial: Partial<Omit<Meeting, "id">>,
  ) => {
    const dateAtClick = date;
    try {
      await patchMeeting.mutateAsync({ date: dateAtClick, id, partial });
      showToast("💾 수정 완료");
    } catch (e) {
      showToast(`수정 실패: ${(e as Error).message}`);
    }
  };

  const saveMetricsAndCheck = (
    dateAtClick: string,
    channels: Record<Channel, ChannelDailyRowMetrics>,
  ) => saveMetrics.mutateAsync({ date: dateAtClick, channels });

  // 통합 저장: ① 신규슬롯 append → ② dirty 미팅 patch → ③ 지표(H=카드수, 직접생산 M). 실패 격리.
  const savingRef = useRef(false);
  const handleSave = async () => {
    if (savingRef.current) return; // 더블클릭/중복저장 방지 (재진입 가드)
    savingRef.current = true;
    try {
      await runSave();
    } finally {
      savingRef.current = false;
    }
  };
  const runSave = async () => {
    const dateAtClick = date;
    const draftAtClick = draft;
    let failed = 0;
    let lacking = 0;
    const keep: NewSlot[] = []; // ① 신규 슬롯: 완료분만 append, 미완/실패분은 유지
    for (const slot of newSlots) {
      if (!slotComplete(slot)) {
        keep.push(slot);
        lacking++;
        continue;
      }
      try {
        await appendMeeting.mutateAsync({
          date: dateAtClick,
          meeting: buildMeetingFromSlot(slot, dateAtClick),
        });
      } catch {
        keep.push(slot);
        failed++;
      }
    }
    if (keep.length !== newSlots.length) setNewSlots(keep);
    failed += await saveAllDirty(); // ② dirty 미팅 patch (실패 격리)
    // ③ 지표 저장 (H=카드수 재계산 + 직접생산 M 동기화).
    try {
      const res = await saveMetricsAndCheck(dateAtClick, draftAtClick);
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
  const saveAllDirty = useSaveAllDirty(); // dirty 미팅카드 전부 저장(전역 레지스트리)

  const weekSwipe = useSwipe({
    onSwipeLeft: () => guardedNav(() => moveWeek(1)),
    onSwipeRight: () => guardedNav(() => moveWeek(-1)),
  });

  // 스테퍼 지표 미저장 가드(unsaved-leave-guard). 숫자만 바꿔도 탭/날짜/주차/닫기 시 모달.
  // dirty = 만졌고 AND 값이 실제로 서버와 다름 → 저장후 파생필드 드리프트·무변화 클릭 거짓양성 0.
  // save 는 지표만(leaf) — runSave/saveAllDirty 호출 금지(전역 saveAll 재귀·중복 append 방지).
  const serverChannels = dayQuery.data?.channels;
  const metricsDirty =
    metricsTouched &&
    !!serverChannels &&
    JSON.stringify(draft) !== JSON.stringify(serverChannels);
  useDirtyEntry(
    "contact-metrics",
    metricsDirty,
    async () => {
      await saveMetrics.mutateAsync({ date, channels: draft });
    },
    () => {
      if (dayQuery.data) setDraft(dayQuery.data.channels);
      setMetricsTouched(false);
    },
    "컨택관리 입력 (저장 안 됨)",
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
      {/* WeekHeader 단독 sticky. 2026-05-17 [A3]: 좌우 스와이프로 주 이동. */}
      <div
        className="sticky top-24 z-30 bg-white shadow-sm"
        {...weekSwipe}
      >
        <PageContainer width="wide">
          <WeekHeader
            weekIndex={weekIndex}
            courseStart={courseStart}
            selectedDate={date}
            todayISO={TODAY_ISO}
            cohortName={undefined}
            countsByDay={countsByDay}
            weekFunnel={weekFunnel}
            onPrevWeek={() => guardedNav(() => moveWeek(-1))}
            onNextWeek={() => guardedNav(() => moveWeek(1))}
            onSelectDay={(d) => guardedNav(() => setDate(d))}
            slideDir={slideDir}
          />
        </PageContainer>
      </div>

      {/* 2026-05-18 [1]: 본문 fade 인터랙션(헤더 고정) */}
      <main
        className={`px-4 pt-4 pb-[160px] transition-opacity duration-200 ${
          dayQuery.isFetching ? "opacity-50" : "opacity-100"
        }`}
      ><PageContainer width="wide">
        <ChannelTabsAndPanel
          active={activeChannel}
          draft={draft}
          date={date}
          inflowWaitBase={dayQuery.data?.inflowWaitBase ?? 0}
          savedInflow={dayQuery.data?.channels[activeChannel]?.inflow ?? 0}
          bannerStockBase={dayQuery.data?.bannerStockBase ?? 0}
          onSelectChannel={(c) => guardedNav(() => setActiveChannel(c))}
          onStep={step}
          onSetVal={setVal}
          highlightKey={highlightProduction ? "production" : undefined}
        />

        <MeetingSlotList
          slots={allSlots}
          reservationDate={TODAY_ISO}
          onPatchSaved={handlePatchSavedMeeting}
          onRemoveSaved={handleRemoveSavedMeeting}
          onChangeNew={updateNewSlot}
          onRemoveNew={removeNewSlot}
        />
      </PageContainer>
      </main>

      <SaveBar
        pending={
          saveMetrics.isPending || appendMeeting.isPending || patchMeeting.isPending
        }
        onSave={handleSave}
      />

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
