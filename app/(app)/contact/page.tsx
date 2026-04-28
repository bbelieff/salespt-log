/**
 * 컨택관리 탭 — 4채널 4지표 입력 + 미팅 슬롯 등록.
 * 정본: docs/design/prototypes/contact-daily-input.html (v7)
 *
 * 데이터 흐름:
 *   - useDay(date) → ContactDayView (4채널 metrics + 그날 미팅들)
 *   - useSaveMetrics(date) → 4지표 저장
 *   - useAppendMeeting / usePatchMeeting / useRemoveMeeting → 미팅 CRUD
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
import MetricStepper from "@/components/ui/MetricStepper";
import ChannelBadge from "@/components/ui/ChannelBadge";
import MeetingSlotCard, {
  type NewSlot,
} from "./_components/MeetingSlotCard";
import { fmtISO } from "./_lib/week";

const METRIC_LABELS: Array<{
  key: keyof ChannelDailyRowMetrics;
  label: string;
  hint?: string;
}> = [
  { key: "production", label: "생산" },
  { key: "inflow", label: "유입" },
  { key: "contactProgress", label: "컨택진행" },
  {
    key: "contactSuccess",
    label: "컨택성공",
    hint: "= 미팅예약 슬롯 수",
  },
];

const TODAY_ISO = fmtISO(new Date());

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_METRICS: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  contactSuccess: 0,
};

export default function ContactPage() {
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [activeChannel, setActiveChannel] = useState<Channel>("매입DB");
  const [toast, setToast] = useState<string>("");
  const [newSlotsByChannel, setNewSlotsByChannel] = useState<
    Record<Channel, NewSlot[]>
  >({
    매입DB: [],
    직접생산: [],
    현수막: [],
    "콜·지·기·소": [],
  });

  const dayQuery = useDay(date);
  const saveMetrics = useSaveMetrics(date);
  const appendMeeting = useAppendMeeting(date);
  const patchMeeting = usePatchMeeting(date);
  const removeMeeting = useRemoveMeeting(date);

  const serverChannels = dayQuery.data?.channels;
  const [draft, setDraft] = useState<Record<Channel, ChannelDailyRowMetrics>>({
    매입DB: { ...EMPTY_METRICS },
    직접생산: { ...EMPTY_METRICS },
    현수막: { ...EMPTY_METRICS },
    "콜·지·기·소": { ...EMPTY_METRICS },
  });

  useEffect(() => {
    if (serverChannels) setDraft(serverChannels);
  }, [serverChannels]);

  const channelMeetings = useMemo(() => {
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const updateMetric = (
    channel: Channel,
    key: keyof ChannelDailyRowMetrics,
    value: number,
  ) => {
    setDraft((d) => {
      const next = { ...d, [channel]: { ...d[channel], [key]: value } };
      const ch = next[channel];
      if (ch.contactSuccess > ch.contactProgress) {
        ch.contactSuccess = ch.contactProgress;
      }
      return next;
    });
  };

  const handleSaveMetrics = async () => {
    try {
      await saveMetrics.mutateAsync(draft);
      showToast("저장 완료");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    }
  };

  const addNewSlot = () => {
    setNewSlotsByChannel((all) => ({
      ...all,
      [activeChannel]: [
        ...all[activeChannel],
        {
          tempId: uuid(),
          미팅날짜: date,
          미팅시간: "",
          업체명: "",
          장소: "",
          예약비고: "",
        },
      ],
    }));
  };

  const updateNewSlot = (channel: Channel, tempId: string, next: NewSlot) => {
    setNewSlotsByChannel((all) => ({
      ...all,
      [channel]: all[channel].map((s) => (s.tempId === tempId ? next : s)),
    }));
  };

  const cancelNewSlot = (channel: Channel, tempId: string) => {
    setNewSlotsByChannel((all) => ({
      ...all,
      [channel]: all[channel].filter((s) => s.tempId !== tempId),
    }));
  };

  const registerNewSlot = async (meeting: Meeting) => {
    try {
      await appendMeeting.mutateAsync(meeting);
      const ch = draft[meeting.channel];
      updateMetric(
        meeting.channel,
        "contactSuccess",
        Math.min(ch.contactSuccess + 1, ch.contactProgress),
      );
      cancelNewSlot(meeting.channel, meeting.id);
      showToast("미팅 등록됨");
    } catch (e) {
      showToast(`등록 실패: ${(e as Error).message}`);
    }
  };

  const handlePatchMeeting = async (
    id: string,
    partial: Partial<Omit<Meeting, "id">>,
  ) => {
    try {
      await patchMeeting.mutateAsync({ id, partial });
      showToast("수정 완료");
    } catch (e) {
      showToast(`수정 실패: ${(e as Error).message}`);
    }
  };

  const handleRemoveMeeting = async (meeting: Meeting) => {
    if (!confirm(`'${meeting.업체명}' 미팅을 삭제할까요?`)) return;
    try {
      await removeMeeting.mutateAsync(meeting.id);
      const ch = draft[meeting.channel];
      updateMetric(
        meeting.channel,
        "contactSuccess",
        Math.max(0, ch.contactSuccess - 1),
      );
      showToast("미팅 삭제됨");
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    }
  };

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

  const currentChannel = draft[activeChannel];
  const totals = CHANNEL_ORDER.reduce(
    (acc, ch) => {
      const m = draft[ch];
      acc.production += m.production;
      acc.inflow += m.inflow;
      acc.contactProgress += m.contactProgress;
      acc.contactSuccess += m.contactSuccess;
      return acc;
    },
    { ...EMPTY_METRICS },
  );

  return (
    <section className="px-4 pt-4 pb-4">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {date.slice(5).replace("-", "월 ")}일
            <span className="ml-2 text-xs text-slate-400">
              {dayQuery.data?.weekIndex}주차
            </span>
          </h1>
        </div>
        <input
          type="date"
          className="rounded border border-gray-300 px-2 py-1 text-xs"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </header>

      {/* 채널 탭 */}
      <div className="mb-3 flex border-b border-gray-200">
        {CHANNEL_ORDER.map((ch) => {
          const active = ch === activeChannel;
          return (
            <button
              key={ch}
              type="button"
              onClick={() => setActiveChannel(ch)}
              className={`flex-1 py-2 transition-colors ${
                active ? "border-b-2 border-blue-500" : ""
              }`}
            >
              <ChannelBadge channel={ch} />
            </button>
          );
        })}
      </div>

      {/* 4지표 입력 + 합계 */}
      <div className="mb-3 grid grid-cols-[3fr_2fr] gap-3 rounded-xl bg-white p-3 shadow-sm">
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500">
            {activeChannel} 입력
          </div>
          {METRIC_LABELS.map(({ key, label, hint }) => {
            const cap =
              key === "contactSuccess" &&
              currentChannel.contactSuccess >= currentChannel.contactProgress;
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="w-20 shrink-0">
                  <div className="text-sm font-medium text-gray-700">
                    {label}
                  </div>
                  {hint && (
                    <div className="text-[10px] text-gray-400">{hint}</div>
                  )}
                </div>
                <MetricStepper
                  value={currentChannel[key]}
                  onChange={(v) => updateMetric(activeChannel, key, v)}
                  ariaLabel={`${activeChannel} ${label}`}
                  capped={cap}
                  cappedHint={
                    cap ? "컨택성공은 컨택진행을 넘을 수 없어요" : undefined
                  }
                  max={
                    key === "contactSuccess"
                      ? currentChannel.contactProgress
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="space-y-2 border-l border-gray-100 pl-3">
          <div className="text-xs font-semibold text-gray-500">오늘 총합</div>
          {METRIC_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-baseline justify-between text-sm"
            >
              <span className="text-gray-500">{label}</span>
              <span className="font-bold text-gray-900">{totals[key]}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSaveMetrics}
        disabled={saveMetrics.isPending}
        className="mb-4 w-full rounded-lg bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {saveMetrics.isPending ? "저장 중…" : "💾 4지표 저장"}
      </button>

      {/* 미팅 슬롯 리스트 (활성 채널만) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {activeChannel} 미팅 예약
          </h2>
          <button
            type="button"
            onClick={addNewSlot}
            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            + 새 미팅
          </button>
        </div>

        {channelMeetings[activeChannel].length === 0 &&
          newSlotsByChannel[activeChannel].length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
              등록된 미팅이 없습니다
            </div>
          )}

        {channelMeetings[activeChannel].map((m) => (
          <MeetingSlotCard
            key={m.id}
            mode="saved"
            meeting={m}
            onPatch={(p) => handlePatchMeeting(m.id, p)}
            onRemove={() => handleRemoveMeeting(m)}
          />
        ))}

        {newSlotsByChannel[activeChannel].map((s) => (
          <MeetingSlotCard
            key={s.tempId}
            mode="new"
            channel={activeChannel}
            reservationDate={TODAY_ISO}
            reservationTime={new Date().toTimeString().slice(0, 5)}
            slot={s}
            minDate={date}
            onChange={(next) => updateNewSlot(activeChannel, s.tempId, next)}
            onRegister={registerNewSlot}
            onCancel={() => cancelNewSlot(activeChannel, s.tempId)}
          />
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900/95 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </section>
  );
}
