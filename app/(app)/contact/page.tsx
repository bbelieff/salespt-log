/** 컨택관리 탭 — 4채널 4지표 + 미팅 슬롯. SSOT: docs/design/prototypes/contact-daily-input.html v7. */
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useDBOverview } from "@/query/db-hooks";
import { useRouter } from "next/navigation";
import CrossTabHintModal from "@/components/ui/CrossTabHintModal";
import {
  findProductionMismatch,
  type ProductionMismatch,
} from "./_lib/dbProductionCheck";
import { useSwipe } from "@/lib/hooks/useSwipe";
import WeekHeader from "./_components/WeekHeader";
import ChannelTabsAndPanel from "./_components/ChannelTabsAndPanel";
import TopHeader from "@/components/TopHeader";
import MeetingSlotItem, {
  type NewSlot,
} from "./_components/MeetingSlotItem";
import { friOf, fmtISO, parseISO, weekIndexOf } from "./_lib/week";

const TODAY_ISO = fmtISO(new Date());

const EMPTY_METRICS: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  meetingReservation: 0,
};

const EMPTY_BY_CHANNEL = (): Record<Channel, ChannelDailyRowMetrics> => ({
  매입DB: { ...EMPTY_METRICS },
  직접생산: { ...EMPTY_METRICS },
  현수막: { ...EMPTY_METRICS },
  "콜·지·기·소": { ...EMPTY_METRICS },
});

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ContactPage() {
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [activeChannel, setActiveChannel] = useState<Channel>("매입DB");
  const [toast, setToast] = useState<string>("");
  const [draft, setDraft] = useState<Record<Channel, ChannelDailyRowMetrics>>(
    EMPTY_BY_CHANNEL,
  );
  const [newSlots, setNewSlots] = useState<NewSlot[]>([]);

  const dayQuery = useDay(date);
  const weekStartISO = useMemo(() => fmtISO(friOf(parseISO(date))), [date]);
  const weekQuery = useWeekMeetings(weekStartISO);
  const saveMetrics = useSaveMetrics();
  const router = useRouter();
  const dbOverview = useDBOverview();
  const [dbMismatch, setDbMismatch] = useState<ProductionMismatch | null>(null);
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
          const last = saved[saved.length - 1];
          if (last) {
            handleRemoveSavedMeeting(last);
          } else if (cur2 > 0) {
            adjustMetric(ch, "meetingReservation", -1);
            showToast("미팅예약 -1 · [저장하기]로 시트에 반영하세요");
          } else {
            showToast("이 채널의 미팅예약이 이미 0입니다");
          }
        }
      }
      return;
    }

    adjustMetric(ch, key, delta);
  };

  const setVal = (key: keyof ChannelDailyRowMetrics, value: number) => {
    setMetric(activeChannel, key, Math.max(0, value));
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

  const registerNewSlot = async (tempId: string) => {
    const slot = newSlots.find((s) => s.tempId === tempId);
    if (!slot) return; // 이미 등록 진행중이거나 사라진 슬롯 → 무시 (이중 클릭 방지)
    if (!slot.미팅날짜 || !slot.미팅시간 || !slot.업체명.trim() || !slot.장소.trim()) {
      showToast("⚠ 미팅 일정·시간·업체명·장소는 필수입니다");
      return;
    }
    const now = new Date();
    const meeting: Meeting = {
      id: slot.tempId,
      예약일: date,
      예약시각: now.toTimeString().slice(0, 5),
      미팅날짜: slot.미팅날짜,
      미팅시간: slot.미팅시간,
      channel: slot.channel,
      업체명: slot.업체명.trim(),
      장소: slot.장소.trim(),
      예약비고: slot.예약비고.trim(),
      상태: "예약",
      계약여부: false,
      수임비: 0,
      미팅사유: "",
      계약조건: "",
    };
    const dateAtClick = date;
    const draftAtClick = draft;
    setNewSlots((s) => s.filter((x) => x.tempId !== tempId));
    try {
      await appendMeeting.mutateAsync({ date: dateAtClick, meeting });
      await saveMetrics.mutateAsync({
        date: dateAtClick,
        channels: draftAtClick,
      });
      showToast("✓ 등록 완료 (시트 동기화됨)");
    } catch (e) {
      setNewSlots((s) => [...s, slot]);
      showToast(`등록 실패: ${(e as Error).message}`);
    }
  };

  const handleRemoveSavedMeeting = async (meeting: Meeting) => {
    // 2026-05-18 Phase 1: cascade — confirm + 계약카드 자동 삭제.
    const hasContract = meeting.상태 === "계약";
    const extra = hasContract ? `\n· 수납탭 계약카드 1건 (₩${(meeting.수임비 ?? 0).toLocaleString()})` : "";
    if (!confirm(`'${meeting.업체명}' 미팅을 삭제할까요?\n\n함께 사라지는 것:\n· 일정탭 미팅카드 1건\n· 컨택탭 미팅예약 -1 (${meeting.channel})${extra}`)) return;
    const dateAtClick = date;
    try {
      // 2026-05-19: server-side cascade — H -1 도 서버 (race 회피).
      await removeMeeting.mutateAsync({ date: dateAtClick, id: meeting.id });
      // local draft 도 -1 (즉시 반영, dayQuery refetch 까지 깜빡임 회피).
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

  const handleSave = async () => {
    // (저장하면 미팅예약 N이 시트에 가는데 미팅 슬롯이 시트에 없으면 일관성 깨짐)
    if (newSlots.length > 0) {
      showToast(
        `⚠ 미등록 미팅 ${newSlots.length}건 — 먼저 [✓ 등록] 또는 [✕ 삭제]를 진행하세요`,
      );
      return;
    }
    const dateAtClick = date;
    try {
      await saveMetrics.mutateAsync({ date: dateAtClick, channels: draft });
      showToast("✅ 저장 완료");
      if (dbOverview.data) {
        const m = findProductionMismatch(dbOverview.data, dateAtClick, draft);
        if (m) setDbMismatch(m);
      }
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    }
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

  const weekSwipe = useSwipe({
    onSwipeLeft: () => moveWeek(1),
    onSwipeRight: () => moveWeek(-1),
  });

  if (dayQuery.isLoading) {
    return (
      <section className="px-4 pt-6 text-sm text-slate-500">
        불러오는 중…
      </section>
    );
  }
  if (dayQuery.isError) {
    return (
      <section className="px-4 pt-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠ 불러오기 실패: {(dayQuery.error as Error).message}
        </div>
      </section>
    );
  }
  if (!dayQuery.data) return null;

  const { courseStart } = dayQuery.data;
  // weekIndex는 UI 기준(Fri-Thu)으로 재계산 — 백엔드는 courseStart-DOW 기준.
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
      <TopHeader pageEmoji="📞" pageTitle="컨택관리" pageSubtitle="01 영업관리" />
      {/* WeekHeader 단독 sticky. 2026-05-17 [A3]: 좌우 스와이프로 주 이동. */}
      <div
        className="sticky top-24 z-30 bg-white shadow-sm"
        {...weekSwipe}
      >
        <WeekHeader
          weekIndex={weekIndex}
          courseStart={courseStart}
          selectedDate={date}
          todayISO={TODAY_ISO}
          cohortName={undefined}
          countsByDay={countsByDay}
          weekFunnel={weekFunnel}
          onPrevWeek={() => moveWeek(-1)}
          onNextWeek={() => moveWeek(1)}
          onSelectDay={setDate}
          slideDir={slideDir}
        />
      </div>

      {/* 2026-05-18 [1]: 스와이프/주차 이동 시 본문 fade 인터랙션 (헤더는 고정). */}
      <main
        className={`px-4 pt-4 pb-[160px] transition-opacity duration-200 ${
          dayQuery.isFetching ? "opacity-50" : "opacity-100"
        }`}
      >
        <ChannelTabsAndPanel
          active={activeChannel}
          draft={draft}
          onSelectChannel={setActiveChannel}
          onStep={step}
          onSetVal={setVal}
        />

        {/* 미팅 슬롯 리스트 */}
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-gray-700">
              미팅예약하기
              {allSlots.length > 0 ? ` · ${allSlots.length}건` : ""}
            </span>
            <span className="text-xs text-gray-400">
              미팅예약 1건 = 미팅예약 1건
            </span>
          </div>

          {allSlots.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-6 text-center">
              <div className="text-sm text-gray-400">
                미팅예약을 입력하면
                <br />
                미팅예약 카드가 자동 생성됩니다
              </div>
            </div>
          ) : (
            allSlots.map((entry, i) =>
              entry.kind === "saved" ? (
                <MeetingSlotItem
                  key={entry.meeting.id}
                  mode="saved"
                  index={i}
                  meeting={entry.meeting}
                  onPatch={(p) => handlePatchSavedMeeting(entry.meeting.id, p)}
                  onRemove={() => handleRemoveSavedMeeting(entry.meeting)}
                />
              ) : (
                <MeetingSlotItem
                  key={entry.slot.tempId}
                  mode="new"
                  index={i}
                  slot={entry.slot}
                  reservationDate={TODAY_ISO}
                  onChange={(next) => updateNewSlot(entry.slot.tempId, next)}
                  onRegister={() => registerNewSlot(entry.slot.tempId)}
                  onRemove={() => removeNewSlot(entry.slot.tempId)}
                />
              ),
            )
          )}
        </div>
      </main>

      {/* 고정 저장 버튼 (탭바 위) */}
      <div className="fixed bottom-[64px] left-0 right-0 z-[49] bg-gradient-to-t from-white via-white to-transparent px-4 pb-3 pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMetrics.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-600 active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          {saveMetrics.isPending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              시트 저장중...
            </>
          ) : (
            <>💾 저장하기</>
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[152px] left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 2026-05-17 [C-2]: DB ↔ 생산 불일치 안내 */}
      <CrossTabHintModal
        open={dbMismatch !== null}
        title="⚠ DB관리 입력 확인 필요"
        body={
          dbMismatch && (
            <>
              <b>{dbMismatch.channel}</b> 생산 입력값(<b>{dbMismatch.expected}</b>)이{" "}
              DB관리 시트 합(<b>{dbMismatch.actual}</b>)과 다릅니다.
              <br />
              DB관리 탭에서 구매목록을 추가하셨나요?
            </>
          )
        }
        navLabel="🗂 DB관리로 이동"
        onNavigate={() => {
          setDbMismatch(null);
          router.push("/db");
        }}
        onClose={() => setDbMismatch(null)}
      />
    </>
  );
}
