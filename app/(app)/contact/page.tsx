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
import {
  useDirtyGuard,
  DirtyGuardContext,
} from "./_components/MeetingDirtyGuard";
import ContactResultModals from "./_components/ContactResultModals";
import SaveBar from "./_components/SaveBar";
import { EMPTY_BY_CHANNEL, uuid } from "./_lib/contactDefaults";
import { friOf, fmtISO, parseISO, weekIndexOf } from "./_lib/week";

const TODAY_ISO = fmtISO(new Date());

export default function ContactPage() {
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [activeChannel, setActiveChannel] = useState<Channel>("매입DB");
  const [toast, setToast] = useState<string>("");
  const [draft, setDraft] = useState<Record<Channel, ChannelDailyRowMetrics>>(
    EMPTY_BY_CHANNEL,
  );
  const [newSlots, setNewSlots] = useState<NewSlot[]>([]);
  const [pickerMeetings, setPickerMeetings] = useState<Meeting[] | null>(null);

  const dayQuery = useDay(date);
  const weekStartISO = useMemo(() => fmtISO(friOf(parseISO(date))), [date]);
  const weekQuery = useWeekMeetings(weekStartISO);
  const saveMetrics = useSaveMetrics();
  // 생산(E)은 PR1/ADR-0020 으로 DB생산 집계가 소유 → 컨택 저장 시 DB합 불일치 검사 제거.
  // 2026-06-03 [교차탭1]: DB관리→컨택 이동 직후 생산 입력 행을 잠깐 강조.
  const [highlightProduction, setHighlightProduction] = useState(false);
  const appendMeeting = useAppendMeeting();
  const patchMeeting = usePatchMeeting();
  const removeMeeting = useRemoveMeeting();

  const countsByDay =
    weekQuery.data?.daysByReservationDate.map((d) => d.meetings.length) ??
    (Array(7).fill(0) as number[]);
  const weekFunnel = weekQuery.data?.weekFunnel ?? {
    생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0,
  };

  useEffect(() => {
    if (!dayQuery.data) return;
    setDraft(dayQuery.data.channels);
    setNewSlots([]); // 날짜 바뀌면 신규 슬롯도 비움

    const inconsistencies: string[] = [];
    for (const ch of CHANNEL_ORDER) {
      const sheetSuccess = dayQuery.data.channels[ch].meetingReservation;
      const meetingCount = dayQuery.data.meetings.filter(
        (m) => m.channel === ch,
      ).length;
      if (sheetSuccess > meetingCount) {
        inconsistencies.push(`${ch}: 미팅예약 ${sheetSuccess} vs 미팅 ${meetingCount}건`);
      }
    }
    if (inconsistencies.length > 0) {
      const msg =
        "⚠ 시트 일관성 경고: " +
        inconsistencies.join(", ") +
        ". '−' 버튼으로 정정 가능";
      setToast(msg);
      setTimeout(() => setToast(""), 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayQuery.data?.date]);

  // 2026-06-03 [교차탭1]: DB관리에서 넘어올 때 ?channel=&date=&focus=production 수신.
  // Next 15 useSearchParams Suspense 경계 요구 회피 → mount 시 window.location 직접 파싱.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ch = params.get("channel");
    const d = params.get("date");
    const focus = params.get("focus");
    if (ch && (CHANNEL_ORDER as readonly string[]).includes(ch)) {
      setActiveChannel(ch as Channel);
    }
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDate(d);
    }
    if (focus === "production") {
      setHighlightProduction(true);
      const t = setTimeout(() => setHighlightProduction(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);

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

  // 2026-06-03 [2]: 채널의 실제 미팅카드 수 (저장된 미팅 + 미등록 신규 슬롯).
  // 컨택진행은 이 수보다 작아질 수 없다(작아지면 미팅카드가 orphan 됨).
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
    setDraft((d) => {
      const cur = d[channel];
      const next: ChannelDailyRowMetrics = { ...cur, [key]: Math.max(0, nextValue) };
      // 안전망: 미팅예약 수치(H)가 컨택진행을 넘으면 컨택진행에 맞춰 내림(phantom H 정정).
      // 컨택진행은 setVal/step 가드로 미팅카드 수 이하로 내려가지 않으므로 카드 손실 없음.
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
          // Phase 4: 2건 이상이면 선택 팝업, 1건이면 바로 삭제.
          if (saved.length > 1) {
            setPickerMeetings(saved);
          } else if (saved.length === 1) {
            handleRemoveSavedMeeting(saved[0]!);
          } else if (cur2 > 0) {
            // 미팅카드는 없는데 미팅예약 수치(H)만 남은 desync → 카드 삭제 없이 수치만 정정.
            adjustMetric(ch, "meetingReservation", -1);
            showToast("미팅 카드가 없어 미팅예약 수치만 −1로 정정했어요 · [저장하기]로 반영");
          } else {
            showToast("이 채널의 미팅예약이 이미 0입니다");
          }
        }
      }
      return;
    }

    // 2026-06-03 [2]: 컨택진행을 미팅카드 수보다 작게 만들면 미팅이 orphan 되므로 차단.
    // 미팅 삭제는 반드시 미팅예약(−)을 통해 명시적으로 하도록 안내.
    if (key === "contactProgress" && delta < 0) {
      const cards = meetingCardCount(ch);
      if (cur2 + delta < cards) {
        showToast(
          `⚠ 미팅예약 ${cards}건이 잡혀 있어요. 먼저 미팅예약을 −로 줄여 미팅을 삭제한 뒤 컨택진행을 낮춰주세요`,
        );
        return;
      }
    }

    adjustMetric(ch, key, delta);
  };

  const setVal = (key: keyof ChannelDailyRowMetrics, value: number) => {
    const v = Math.max(0, value);
    // 2026-06-03 [2]: 직접 입력으로도 컨택진행이 미팅카드 수보다 작아지지 않도록 가드.
    if (key === "contactProgress") {
      const cards = meetingCardCount(activeChannel);
      if (v < cards) {
        showToast(
          `⚠ 미팅예약 ${cards}건이 잡혀 있어요. 먼저 미팅예약을 −로 줄여 미팅을 삭제한 뒤 컨택진행을 낮춰주세요`,
        );
        return;
      }
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

  // 신규 슬롯 필수(미팅날짜·시간·업체·장소) 완료 여부 — 미완은 통합 저장에서 append 제외.
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
    const extra = hasContract ? `\n· 수납탭 계약카드 1건 (₩${(meeting.수임비 ?? 0).toLocaleString()})` : "";
    if (!confirm(`'${meeting.업체명}' 미팅을 삭제할까요?\n\n함께 사라지는 것:\n· 일정탭 미팅카드 1건\n· 컨택탭 미팅예약 -1 (${meeting.channel})${extra}`)) return;
    const dateAtClick = date;
    try {
      // server-side cascade (H -1 포함). draft 도 -1 즉시 반영.
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

  // 메트릭 저장 단일 진입점. (생산 E 는 PR1/ADR-0020 으로 DB생산 집계 소유 — 저장 후 DB 검사 없음.)
  const saveMetricsAndCheck = async (
    dateAtClick: string,
    channels: Record<Channel, ChannelDailyRowMetrics>,
  ) => {
    await saveMetrics.mutateAsync({ date: dateAtClick, channels });
  };

  // 통합 저장 — 최하단 [저장하기] 하나로: ① 완료 신규슬롯 append(업체정보 포함) →
  // ② dirty 저장미팅 patch(업체정보 포함) → ③ 지표(H는 카드수로 자동 재계산).
  // 항목별 실패는 그 항목만 드래프트 유지 + 토스트(유실 0). 필수누락 슬롯은 남기고 나머지 저장.
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
    // ① 신규 슬롯: 완료분만 append, 미완/실패분은 유지.
    const keep: NewSlot[] = [];
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
    // ② dirty 저장미팅 patch (업체정보 포함) — 항목별 실패 격리.
    failed += await saveAllDirty();
    // ③ 지표 저장 (saveContactMetrics 가 H 를 카드수로 재계산).
    try {
      await saveMetricsAndCheck(dateAtClick, draftAtClick);
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

  // 미저장 이탈 가드 — 미팅카드가 dirty 면 탭/날짜/주차 이동 전에 한 번 확인.
  const { register, guardedNav, confirmModal, saveAllDirty } = useDirtyGuard();

  const weekSwipe = useSwipe({
    onSwipeLeft: () => guardedNav(() => moveWeek(1)),
    onSwipeRight: () => guardedNav(() => moveWeek(-1)),
  });

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
  // 모든 채널 슬롯을 채널 순서대로 합쳐서 렌더 (시안과 동일)
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
        {/* 배경 full-bleed + 내용은 본문과 동일 6xl 중앙정렬 */}
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

      {/* 2026-05-18 [1]: 스와이프/주차 이동 시 본문 fade 인터랙션 (헤더는 고정). */}
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
          onSelectChannel={(c) => guardedNav(() => setActiveChannel(c))}
          onStep={step}
          onSetVal={setVal}
          highlightKey={highlightProduction ? "production" : undefined}
        />

        {/* 미팅 슬롯 리스트 — dirty 카드는 DirtyGuardContext 로 이탈 가드에 등록 */}
        <DirtyGuardContext.Provider value={register}>
          <MeetingSlotList
            slots={allSlots}
            reservationDate={TODAY_ISO}
            onPatchSaved={handlePatchSavedMeeting}
            onRemoveSaved={handleRemoveSavedMeeting}
            onChangeNew={updateNewSlot}
            onRemoveNew={removeNewSlot}
          />
        </DirtyGuardContext.Provider>
      </PageContainer>
      </main>

      {/* 미저장 이탈 가드 모달 (dirty 카드 있을 때 탭/날짜/주차 이동 시) */}
      {confirmModal}

      {/* 고정 저장 바 (탭바 위) — 분리된 컴포넌트 */}
      <SaveBar
        pending={
          saveMetrics.isPending || appendMeeting.isPending || patchMeeting.isPending
        }
        onSave={handleSave}
      />

      {/* Toast */}
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
    </>
  );
}
