/**
 * 컨택관리 탭 — 4채널 4지표 입력 + 미팅 슬롯 등록.
 * 정본: docs/design/prototypes/contact-daily-input.html (v7) — 픽셀 매칭 포팅.
 *
 * 핵심 모델 (시안과 동일):
 *   - 컨택성공 = (등록 완료 미팅 수) + (신규 슬롯 수) per 채널
 *   - 컨택성공 +1 → 빈 신규 슬롯 자동 생성 (선택 채널)
 *   - 신규 슬롯 [등록] → API POST → 등록완료 슬롯으로 전환 (서버측 미팅으로 합류)
 *   - [삭제] (신규/등록완료 모두) → 슬롯 제거 + 컨택성공 -1
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { CHANNEL_ORDER, type Channel, type Meeting } from "@/types";
import {
  useAppendMeeting,
  useDay,
  usePatchMeeting,
  useRemoveMeeting,
  useSaveMetrics,
} from "@/query/contact-hooks";
import type { ChannelDailyRowMetrics } from "@/service";
import WeekHeader from "./_components/WeekHeader";
import ChannelTabsAndPanel from "./_components/ChannelTabsAndPanel";
import MeetingSlotItem, {
  type NewSlot,
} from "./_components/MeetingSlotItem";
import { fmtISO } from "./_lib/week";

const TODAY_ISO = fmtISO(new Date());

const EMPTY_METRICS: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  contactSuccess: 0,
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
  // ⚠️ stateless mutations: date를 hook 인자가 아니라 mutate args로 전달.
  // (hook 인자로 받으면 navigate 도중 race condition으로 잘못된 row 오염)
  const saveMetrics = useSaveMetrics();
  const appendMeeting = useAppendMeeting();
  const patchMeeting = usePatchMeeting();
  const removeMeeting = useRemoveMeeting();

  // 서버 데이터 로드 시 draft 동기화 + 일관성 체크
  useEffect(() => {
    if (!dayQuery.data) return;
    setDraft(dayQuery.data.channels);
    setNewSlots([]); // 날짜 바뀌면 신규 슬롯도 비움

    // 일관성 체크: 시트 H열(컨택성공)과 04 업체관리 그날 미팅 수가 일치하는지
    // 불일치 시 사용자에게 알림 (자동 정정은 안 함 — 사용자가 직접 - 클릭으로 정정)
    const inconsistencies: string[] = [];
    for (const ch of CHANNEL_ORDER) {
      const sheetSuccess = dayQuery.data.channels[ch].contactSuccess;
      const meetingCount = dayQuery.data.meetings.filter(
        (m) => m.channel === ch,
      ).length;
      if (sheetSuccess > meetingCount) {
        inconsistencies.push(`${ch}: 컨택성공 ${sheetSuccess} vs 미팅 ${meetingCount}건`);
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

  // 채널별 등록완료 미팅
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

  // ── 4지표 stepper ────────────────────────────────────────
  const setMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    nextValue: number,
  ) => {
    setDraft((d) => {
      const cur = d[channel];
      const next: ChannelDailyRowMetrics = { ...cur, [key]: Math.max(0, nextValue) };
      // 컨택성공 ≤ 컨택진행 클램프
      if (next.contactSuccess > next.contactProgress) {
        next.contactSuccess = next.contactProgress;
      }
      return { ...d, [channel]: next };
    });
  };

  /**
   * 채널의 metric을 functional setState로 ±delta 만큼 조정.
   * setMetric은 외부에서 nextValue를 계산해 넘기는 방식이라 stale closure 위험.
   * 이 헬퍼는 항상 최신 draft를 사용해 Math.max 적용.
   */
  const adjustMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    delta: number,
  ) => {
    setDraft((d) => {
      const cur = d[channel];
      const newValue = Math.max(0, cur[key] + delta);
      const next: ChannelDailyRowMetrics = { ...cur, [key]: newValue };
      if (next.contactSuccess > next.contactProgress) {
        next.contactSuccess = next.contactProgress;
      }
      return { ...d, [channel]: next };
    });
  };

  /**
   * step(channel, key, delta) — 시안 동작 매칭:
   *   컨택성공 +1: 그 채널에 빈 신규 슬롯 자동 생성
   *   컨택성공 -1:
   *     - 신규 슬롯 있으면 마지막 거 제거
   *     - 없으면 등록완료 슬롯 마지막 거 → API DELETE
   *   다른 키는 단순 ±1
   */
  const step = (key: keyof ChannelDailyRowMetrics, delta: number) => {
    const ch = activeChannel;
    const cur = draft[ch];
    const cur2 = cur[key];

    if (key === "contactSuccess") {
      if (delta > 0) {
        if (cur2 >= cur.contactProgress) {
          showToast("⚠ 컨택성공은 컨택진행보다 클 수 없어요");
          return;
        }
        // 신규 슬롯 자동 생성
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
        adjustMetric(ch, "contactSuccess", +1);
      } else {
        // -1
        const news = newSlotsForChannel(ch);
        if (news.length > 0) {
          // 마지막 신규 슬롯 제거
          const last = news[news.length - 1]!;
          setNewSlots((s) => s.filter((x) => x.tempId !== last.tempId));
          adjustMetric(ch, "contactSuccess", -1);
        } else {
          // 등록완료 슬롯 중 마지막 → API 삭제
          const saved = savedByChannel[ch];
          const last = saved[saved.length - 1];
          if (last) {
            handleRemoveSavedMeeting(last);
          } else if (cur2 > 0) {
            // 시트 일관성 깨진 상태: 미팅 카드는 없는데 컨택성공만 남음.
            // → 로컬 -1 조정만 하고 저장은 [저장하기] 버튼에 위임.
            // (자동 saveMetrics 제거 — Quota 초과 방지)
            adjustMetric(ch, "contactSuccess", -1);
            showToast("컨택성공 -1 · [저장하기]로 시트에 반영하세요");
          } else {
            showToast("이 채널의 컨택성공이 이미 0입니다");
          }
        }
      }
      return;
    }

    // 다른 키 단순 ±1 (functional)
    adjustMetric(ch, key, delta);
  };

  const setVal = (key: keyof ChannelDailyRowMetrics, value: number) => {
    setMetric(activeChannel, key, Math.max(0, value));
  };

  // ── 슬롯 액션 ────────────────────────────────────────────
  const updateNewSlot = (tempId: string, next: NewSlot) =>
    setNewSlots((s) => s.map((x) => (x.tempId === tempId ? next : x)));

  const removeNewSlot = (tempId: string) => {
    const target = newSlots.find((s) => s.tempId === tempId);
    if (!target) return;
    setNewSlots((s) => s.filter((x) => x.tempId !== tempId));
    adjustMetric(target.channel, "contactSuccess", -1);
    showToast("✕ 삭제 · 컨택성공 -1");
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
      // 예약일 = 페이지 선택 날짜 (컨택한 날). 사용자가 4/27 view에서
      // 등록하면 예약일=4/27, 미팅날짜는 슬롯의 값(4/29 등 자유).
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
    // 클로저로 등록 시점의 date를 잡음 (이후 navigate에 영향 안 받음)
    const dateAtClick = date;
    const draftAtClick = draft;
    // 즉시(낙관적) 신규 슬롯에서 제거 → 버튼이 사라져 두 번 클릭 불가
    // 실패 시 복원
    setNewSlots((s) => s.filter((x) => x.tempId !== tempId));
    try {
      // 1) 미팅 등록 (04 업체관리)
      await appendMeeting.mutateAsync({ date: dateAtClick, meeting });
      // 2) 동시에 4지표도 시트에 저장 (01 영업관리 — dateAtClick row)
      //    → 컨택성공이 시트와 UI 일관성 유지 (한 명령으로 일관 보장)
      await saveMetrics.mutateAsync({
        date: dateAtClick,
        channels: draftAtClick,
      });
      showToast("✓ 등록 완료 (시트 동기화됨)");
    } catch (e) {
      // 복원
      setNewSlots((s) => [...s, slot]);
      showToast(`등록 실패: ${(e as Error).message}`);
    }
  };

  const handleRemoveSavedMeeting = async (meeting: Meeting) => {
    if (!confirm(`'${meeting.업체명}' 미팅을 삭제할까요?`)) return;
    const dateAtClick = date;
    try {
      // 1) 시트에서 미팅 행 클리어
      await removeMeeting.mutateAsync({ date: dateAtClick, id: meeting.id });
      // 2) 컨택성공 -1 (functional setState — stale closure 안전)
      adjustMetric(meeting.channel, "contactSuccess", -1);
      // 3) 4지표를 시트에 즉시 저장. functional updater로 latest draft 읽어
      //    명시적으로 dateAtClick row에 저장 (navigate race 방지).
      setDraft((latest) => {
        void saveMetrics.mutateAsync({
          date: dateAtClick,
          channels: latest,
        });
        return latest;
      });
      showToast("✕ 삭제 · 컨택성공 -1 (시트 동기화됨)");
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

  // ── 저장 ─────────────────────────────────────────────────
  const handleSave = async () => {
    // 가드: 미등록 신규 슬롯이 있으면 저장 차단
    // (저장하면 컨택성공 N이 시트에 가는데 미팅 슬롯이 시트에 없으면 일관성 깨짐)
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
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    }
  };

  // ── 주차/날짜 네비 ───────────────────────────────────────
  const moveWeek = (deltaWeeks: number) => {
    if (!dayQuery.data) return;
    const cur = new Date(date);
    cur.setDate(cur.getDate() + deltaWeeks * 7);
    setDate(fmtISO(cur));
  };

  // ── 렌더 ─────────────────────────────────────────────────
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

  const { weekIndex, courseStart } = dayQuery.data;

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
      <WeekHeader
        weekIndex={weekIndex}
        courseStart={courseStart}
        selectedDate={date}
        todayISO={TODAY_ISO}
        cohortName={undefined}
        onPrevWeek={() => moveWeek(-1)}
        onNextWeek={() => moveWeek(1)}
        onSelectDay={setDate}
      />

      <main className="px-4 pt-4 pb-[160px]">
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
              컨택성공 1건 = 미팅예약 1건
            </span>
          </div>

          {allSlots.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-6 text-center">
              <div className="text-sm text-gray-400">
                컨택성공을 입력하면
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
    </>
  );
}
