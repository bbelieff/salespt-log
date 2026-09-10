/**
 * 저장 전 확인 화면 — 「이렇게 기록할까요?」
 *
 * ## 왜 (2026-09-02 belie)
 * 미팅예약 ＋ 를 누르면 미팅 날짜가 **오늘로 미리 채워진다**. 그대로 저장하면 「오늘 만난
 * 미팅」이 되어 버리는데, 수강생은 저장하고 나서야 알아챈다. 저장 직전에 **무엇이 어디로
 * 들어가는지** 한 번 보여준다.
 *
 * ## 네 가지를 같은 크기로
 * belie 요구: **기록하는 날짜 · 채널 · 예약된 미팅 · 회사명**을 정확히 같은 레벨로.
 * 하나만 크면 나머지를 안 읽는다 — 넷 다 같은 `text-base font-bold` 로 둔다.
 *
 * ## 막는 것과 안 막는 것
 * - **덜 채운 미팅** → 저장만 잠근다. 숫자만 저장되고 미팅은 안 들어가면 어긋난 채 남는다.
 * - **미팅날짜 = 기록날짜** → **빨간 칸**(확인 필요)으로 띄운다. 막지는 않는다 — 당일 미팅은
 *   실제로 있으므로 판단은 수강생이 한다. 노랑(못 채운 칸)과 **색을 나눈 이유**: 둘 다 노랑이면
 *   「채우면 되는 것」과 「맞는지 봐야 하는 것」이 섞여 안 읽힌다(2026-09-05 belie).
 */
"use client";

import { useId, useState } from "react";
import { CHANNEL_ORDER, type Channel, type Meeting } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import { useMeetingScheduleWeeks } from "@/query/contact-hooks";
import { meetingConflicts } from "../_lib/meeting-conflicts";
import { fmtISO, friOf, parseISO } from "../_lib/week";
import MetricComparison from "./MetricComparison";
import type { NewSlot } from "./MeetingSlotItem";

/** 채널 4색(고정, components.md) — Tailwind 는 클래스를 **정적으로** 훑어 만든다.
 *  `text-${color}-700` 처럼 조립하면 빌드 결과물에 그 클래스가 없어 색이 안 나온다. */
export const CHANNEL_TEXT: Record<Channel, string> = {
  매입DB: "text-blue-700",
  직접생산: "text-green-700",
  현수막: "text-amber-700",
  "콜·지·기·소": "text-violet-700",
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** "9월 2일" / "화" — 기록하는 날짜를 사람이 읽는 말로. */
export function formatKoreanDate(iso: string): { label: string; dow: string } {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return { label: iso, dow: "" };
  return { label: `${m}월 ${d}일`, dow: DOW[new Date(y, m - 1, d).getDay()] ?? "" };
}

export function isSlotComplete(s: NewSlot): boolean {
  return !!s.미팅날짜 && !!s.미팅시간 && !!s.업체명.trim() && !!s.장소.trim();
}

interface Props {
  open: boolean;
  /** 기록하는 날짜 — 지금 보고 있는 날짜. 미팅날짜(예정일)와 다르다. */
  date: string;
  slots: NewSlot[];
  draft: Record<Channel, ChannelDailyRowMetrics>;
  savedMeetings?: Meeting[];
  savedChannels?: Record<Channel, ChannelDailyRowMetrics>;
  saving: boolean;
  onFix: () => void;
  onSave: () => void;
  onClose: () => void;
}

/** 라벨+값 한 칸. 네 요소가 전부 이 한 컴포넌트를 쓴다 = 크기가 어긋날 수 없다. */
/**
 * 칸 강조는 **두 종류**이고 색이 달라야 한다(2026-09-05 belie).
 *   `warn`(노랑) — 아직 못 채운 칸. 채우면 없어진다.
 *   `check`(빨강) — 기록일과 미팅예정일이 **같은 날**. 틀린 게 아니라 **확인이 필요한** 것.
 * 둘 다 노랑이면 「채우면 되는 것」과 「맞는지 봐야 하는 것」이 섞여 안 읽힌다.
 */
type Mark = "none" | "warn" | "check";

const MARK_BG: Record<Mark, string> = {
  none: "bg-white",
  warn: "bg-amber-50",
  check: "bg-red-50",
};
const MARK_LABEL: Record<Mark, string> = {
  none: "text-gray-400",
  warn: "text-amber-700",
  check: "text-red-700",
};
const MARK_VALUE: Record<Mark, string> = {
  none: "text-gray-900",
  warn: "text-amber-800",
  check: "text-red-800",
};

function Cell({
  label,
  value,
  sub,
  mark = "none",
  note,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  mark?: Mark;
  note?: string;
  valueClass?: string;
}) {
  return (
    <div className={`min-w-0 p-2.5 ${MARK_BG[mark]}`}>
      <span className={`block text-[10px] font-bold tracking-wide ${MARK_LABEL[mark]}`}>
        {label}
      </span>
      <span
        className={`mt-0.5 block break-keep text-base font-bold leading-snug ${
          valueClass ?? MARK_VALUE[mark]
        }`}
      >
        {value}
        {sub ? <span className="ml-1 text-sm text-gray-600">{sub}</span> : null}
      </span>
      {note ? (
        <span className={`mt-1 block text-[10px] font-bold leading-tight ${MARK_LABEL[mark]}`}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

function CorrectionHelp() {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = hovered || pinned;
  return (
    <div className="mt-3 text-xs leading-relaxed text-gray-600"
      onMouseLeave={() => setHovered(false)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPinned(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setHovered(false); setPinned(false); } }}>
      <span>미팅시간, 회사명, 장소 등을 잘못 적었다면</span>
      <button type="button" aria-label="미팅 정보 수정 방법" aria-expanded={expanded} aria-controls={id}
        onMouseEnter={() => setHovered(true)}
        onClick={() => { setPinned((value) => !value); setHovered(false); }}
        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full align-middle focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
        <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] font-bold">?</span>
      </button>
      <p id={id} hidden={!expanded} className="mt-1 rounded-lg bg-gray-50 p-2.5">
        X로 이 창을 닫고 미팅 카드에서 수정하세요. 기록 날짜·채널을 옮기려면 [잘못 적었어요]에서 선택해요. 창을 닫아도 입력은 남고, [저장하기]를 누르기 전에는 저장되지 않아요.
      </p>
    </div>
  );
}

export default function SaveConfirmModal({
  open,
  date,
  slots,
  draft,
  savedMeetings = [],
  savedChannels,
  saving,
  onFix,
  onSave,
  onClose,
}: Props) {
  const weeks = [...new Set(slots.filter((s) => s.미팅날짜).map((s) => fmtISO(friOf(parseISO(s.미팅날짜)))))];
  const schedules = useMeetingScheduleWeeks(weeks, open);
  const checking = schedules.some((q) => q.isFetching);
  const checkFailed = schedules.some((q) => q.isError);
  const conflicts = meetingConflicts(
    slots.map((s) => ({ ...s, id: s.tempId })),
    [...savedMeetings, ...schedules.flatMap((q) => q.data?.daysByMeetingDate.flatMap((d) => d.meetings) ?? [])],
  );
  if (!open) return null;

  const { label: dateLabel, dow } = formatKoreanDate(date);
  const unfilled = slots.filter((s) => !isSlotComplete(s));
  const sameDay = slots.filter((s) => isSlotComplete(s) && s.미팅날짜 === date);
  const channels = CHANNEL_ORDER.filter((c) => slots.some((s) => s.channel === c));

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="저장 전 확인"
      >
        <div className="relative bg-slate-900 px-4 py-3 pr-14 text-white">
          <span className="block text-[10px] font-bold tracking-widest text-slate-400">
            저장 전 확인
          </span>
          <h3 className="text-[15px] font-black">이렇게 기록할까요?</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="확인창 닫고 수정하기" className="absolute right-3 top-3 h-8 w-8 rounded-lg text-xl hover:bg-slate-700">×</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {channels.map((ch) => {
            const mine = slots.filter((s) => s.channel === ch);
            const existing = savedMeetings.filter((m) => m.channel === ch);
            const m = { ...draft[ch], meetingReservation: existing.length + mine.filter(isSlotComplete).length };
            const before = savedChannels?.[ch] ?? { production: 0, inflow: 0, contactProgress: 0, meetingReservation: existing.length };
            return (
              <div key={ch} className="mb-3 last:mb-0">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-gray-200">
                  <Cell label="기록하는 날짜" value={dateLabel} sub={dow} />
                  <Cell label="채널" value={ch} valueClass={CHANNEL_TEXT[ch]} />
                </div>

                <p className="mb-1 mt-3 text-xs font-bold text-gray-500">기존 예약된 미팅 · {existing.length}건</p>
                {existing.map((m) => <div key={m.id} className="grid grid-cols-2 gap-px rounded-xl bg-gray-200">
                  <Cell label="기존 예약된 미팅" value={formatKoreanDate(m.미팅날짜).label} sub={m.미팅시간} />
                  <Cell label="회사명" value={m.업체명} />
                </div>)}
                <p className="mb-1 mt-3 text-xs font-bold text-blue-700">이번에 저장할 예약된 미팅 · {mine.length}건</p>
                {mine.map((s, i) => {
                  const done = isSlotComplete(s);
                  const sameDay = done && s.미팅날짜 === date;
                  const mark: Mark = !done ? "warn" : sameDay ? "check" : "none";
                  const md = formatKoreanDate(s.미팅날짜);
                  return (
                    <div
                      key={s.tempId}
                      className="mt-px grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-gray-200"
                    >
                      <Cell
                        label={`예약된 미팅${mine.length > 1 ? ` ${i + 1}` : ""}`}
                        value={done ? `${md.label} (${md.dow})` : "시간 미입력"}
                        sub={done ? s.미팅시간 : undefined}
                        mark={mark}
                        note={sameDay ? "확인 필요 · 기록일과 미팅예정일 동일" : undefined}
                      />
                      <Cell
                        label="회사명"
                        value={done ? s.업체명.trim() : "비어 있음"}
                        mark={mark}
                      />
                    </div>
                  );
                })}

                <MetricComparison before={before} after={m} />
              </div>
            );
          })}

          <CorrectionHelp />
          {conflicts.length > 0 && <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
            <b>같은 날짜·시간에 미팅이 겹쳐요. 일정을 확인하고 수정해주세요.</b>
            {conflicts.map((m) => <p key={m.id}>{m.미팅날짜} {m.미팅시간} · {m.업체명}</p>)}
          </div>}
          {checking && <p className="mt-2 text-xs text-gray-500">기존 미팅 일정 확인 중…</p>}
          {checkFailed && <p role="alert" className="mt-2 text-xs text-red-700">기존 일정을 확인하지 못했어요. 창을 닫고 다시 시도해주세요.</p>}
          {unfilled.length > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <b>{unfilled.length}건을 아직 못 채웠어요.</b> 지금 저장하면 숫자만 올라가고
              미팅은 안 들어가요.
            </p>
          ) : sameDay.length > 0 ? (
            <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
              <b>빨간 칸 {sameDay.length}건은 확인이 필요해요</b> — 기록하는 날짜와 미팅
              예정일이 같아요. 오늘 만난 게 맞으면 그대로 저장하세요.
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onFix}
            disabled={slots.every((s) => !isSlotComplete(s))}
            className="flex-1 rounded-lg bg-amber-100 py-3 text-[13px] font-bold text-amber-800 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400"
          >
            잘못 적었어요
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={unfilled.length > 0 || saving || checking || checkFailed || conflicts.length > 0}
            className="flex-1 rounded-lg bg-slate-900 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
