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
 * - **미팅날짜 = 기록날짜** → 노란 칸으로 눈에만 띄게 한다. 당일 미팅은 실제로 있으므로
 *   판단은 수강생이 한다.
 */
"use client";

import { CHANNEL_ORDER, METRIC_LABEL, type Channel, type MetricKey } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import type { NewSlot } from "./MeetingSlotItem";

/** 채널 4색(고정, components.md) — Tailwind 는 클래스를 **정적으로** 훑어 만든다.
 *  `text-${color}-700` 처럼 조립하면 빌드 결과물에 그 클래스가 없어 색이 안 나온다. */
export const CHANNEL_TEXT: Record<Channel, string> = {
  매입DB: "text-blue-700",
  직접생산: "text-green-700",
  현수막: "text-amber-700",
  "콜·지·기·소": "text-violet-700",
};

const METRIC_ORDER: readonly MetricKey[] = [
  "production",
  "inflow",
  "contactProgress",
  "meetingReservation",
];

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
  saving: boolean;
  onFix: () => void;
  onSave: () => void;
  onClose: () => void;
}

/** 라벨+값 한 칸. 네 요소가 전부 이 한 컴포넌트를 쓴다 = 크기가 어긋날 수 없다. */
function Cell({
  label,
  value,
  sub,
  mark,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  mark?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`min-w-0 p-2.5 ${mark ? "bg-amber-50" : "bg-white"}`}>
      <span
        className={`block text-[10px] font-bold tracking-wide ${
          mark ? "text-amber-700" : "text-gray-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-0.5 block break-keep text-base font-bold leading-snug ${
          valueClass ?? (mark ? "text-amber-800" : "text-gray-900")
        }`}
      >
        {value}
        {sub ? <span className="ml-1 text-sm text-gray-600">{sub}</span> : null}
      </span>
    </div>
  );
}

export default function SaveConfirmModal({
  open,
  date,
  slots,
  draft,
  saving,
  onFix,
  onSave,
  onClose,
}: Props) {
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
        <div className="bg-slate-900 px-4 py-3 text-white">
          <span className="block text-[10px] font-bold tracking-widest text-slate-400">
            저장 전 확인
          </span>
          <h3 className="text-[15px] font-black">이렇게 기록할까요?</h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {channels.map((ch) => {
            const mine = slots.filter((s) => s.channel === ch);
            const m = draft[ch];
            return (
              <div key={ch} className="mb-3 last:mb-0">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-gray-200">
                  <Cell label="기록하는 날짜" value={dateLabel} sub={dow} />
                  <Cell label="채널" value={ch} valueClass={CHANNEL_TEXT[ch]} />
                </div>

                {mine.map((s, i) => {
                  const done = isSlotComplete(s);
                  const flag = done && s.미팅날짜 === date;
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
                        mark={flag || !done}
                      />
                      <Cell
                        label="회사명"
                        value={done ? s.업체명.trim() : "비어 있음"}
                        mark={flag || !done}
                      />
                    </div>
                  );
                })}

                <p className="mb-1.5 mt-3 text-[10px] font-bold tracking-wide text-gray-400">
                  {dateLabel} {ch} 숫자
                </p>
                <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-gray-200">
                  {METRIC_ORDER.map((k) => (
                    <div
                      key={k}
                      className={`py-2 text-center ${
                        k === "meetingReservation" ? "bg-indigo-50" : "bg-gray-50"
                      }`}
                    >
                      <span
                        className={`block text-[10px] font-semibold ${
                          k === "meetingReservation" ? "text-indigo-700" : "text-gray-500"
                        }`}
                      >
                        {METRIC_LABEL[k]}
                      </span>
                      <span
                        className={`block text-lg font-bold leading-tight tabular-nums ${
                          k === "meetingReservation" ? "text-indigo-800" : "text-gray-900"
                        }`}
                      >
                        {m[k]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {unfilled.length > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <b>{unfilled.length}건을 아직 못 채웠어요.</b> 지금 저장하면 숫자만 올라가고
              미팅은 안 들어가요.
            </p>
          ) : sameDay.length > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <b>노란 칸 {sameDay.length}건이 기록하는 날짜와 같은 날</b>이에요. 오늘 만난 게
              맞으면 그대로 저장하세요.
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
            disabled={unfilled.length > 0 || saving}
            className="flex-1 rounded-lg bg-slate-900 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
