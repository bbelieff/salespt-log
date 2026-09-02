/**
 * 「잘못 적었어요」 → 기록 옮기기. `어느 미팅` → `무엇을` → `어디로` 3단계.
 *
 * ## 왜 3단계인가
 * 한 화면에 미팅 고르기 + 네 선택지 + 채널 + 날짜를 다 넣으면 휴대폰에서 스크롤 지옥이 된다.
 * belie 요구대로 각 단계에 **뒤로가기**를 두어 되짚을 수 있게 했다.
 *
 * ## 각 선택지가 언제인지 ⟨?⟩ 로 알려준다
 * 셋(넷)을 놓고 매번 헷갈리는 게 진짜 문제다. 마우스를 올릴 수 없는 휴대폰이라
 * **눌러서 펼치는** 방식으로 넣었다. 고른 선택지의 팁은 저절로 펼쳐진다.
 *
 * 규칙(무엇이 얼마나 움직이나)은 전부 `_lib/record-move.ts` 가 정한다 — 여기는 그리기만.
 */
"use client";

import { useMemo, useState } from "react";
import { CHANNEL_ORDER, type Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import { useDay } from "@/query/contact-hooks";
import {
  describeDeltas,
  hasAnyRecord,
  isDateLocked,
  isInflowLocked,
  isSamePlace,
  moveDeltas,
  MOVE_OPTIONS,
  type MoveOption,
} from "../_lib/record-move";
import { CHANNEL_TEXT, formatKoreanDate } from "./SaveConfirmModal";
import { addDays, fmtISO, friOf, parseISO } from "../_lib/week";

/** 옮길 대상 한 건 — 저장 전 슬롯이든 저장된 미팅이든 이 모양으로 넘어온다. */
export interface MoveCandidate {
  key: string;
  channel: Channel;
  업체명: string;
  미팅날짜: string;
  미팅시간: string;
}

export interface MoveDecision {
  key: string;
  option: MoveOption;
  to: { date: string; channel: Channel };
  deltas: { inflow?: number; contactProgress?: number };
}

interface Props {
  open: boolean;
  /** 기록된 날짜 — 옮기기 전 자리. 채널은 고른 미팅이 정한다. */
  fromDate: string;
  candidates: MoveCandidate[];
  /** 화면 draft — 저장 안 한 입력까지 포함한 지금 숫자. */
  draft: Record<Channel, ChannelDailyRowMetrics>;
  onBack: () => void;
  onApply: (decision: MoveDecision) => void;
}

const CHIP_BG: Record<Channel, string> = {
  매입DB: "bg-blue-100 text-blue-700",
  직접생산: "bg-green-100 text-green-700",
  현수막: "bg-amber-100 text-amber-700",
  "콜·지·기·소": "bg-violet-100 text-violet-700",
};

const OPTION_TEXT: Record<MoveOption, { title: string; when: React.ReactNode }> = {
  meet: {
    title: "미팅만 옮기기",
    when: (
      <>
        <b>숫자는 맞는데 미팅 카드만 엉뚱한 자리에 걸렸을 때.</b> 유입·컨택진행·미팅예약
        숫자는 지금 자리에 그대로 남고, 미팅 한 건만 옮겨가요.
      </>
    ),
  },
  part: {
    title: "이 미팅과 관련지표들 묶음 옮기기",
    when: (
      <>
        <b>이 미팅 하나를 통째로 잘못 적었을 때.</b> 미팅 카드와 함께 유입·컨택진행을{" "}
        <b>1씩</b> 데려가요. 가장 많이 쓰는 선택지예요.
      </>
    ),
  },
  all: {
    title: "기록된 날짜＋채널의 숫자 전부 옮기기",
    when: (
      <>
        <b>그날 그 채널로 한 일을 통째로 다른 날에 적었을 때.</b> 그 자리 숫자가 전부
        빠져나가고 이 미팅도 함께 가요. 그날 다른 미팅이 있으면 그건 남으니 확인하세요.
      </>
    ),
  },
  chan: {
    title: "같은 날짜에서 채널만 바꾸기",
    when: (
      <>
        <b>날짜는 맞는데 채널을 잘못 골랐을 때.</b> 날짜는 그대로 두고 채널만 바꿔요 — 미팅
        카드와 그 몫 1씩이 새 채널로 옮겨가요.
      </>
    ),
  },
};

type Step = "which" | "what" | "where";

export default function RecordMoveModal({
  open,
  fromDate,
  candidates,
  draft,
  onBack,
  onApply,
}: Props) {
  const needsPick = candidates.length > 1;
  const [step, setStep] = useState<Step>(needsPick ? "which" : "what");
  const [pickedKey, setPickedKey] = useState<string>(
    needsPick ? "" : (candidates[0]?.key ?? ""),
  );
  const [option, setOption] = useState<MoveOption | null>(null);
  const [openTip, setOpenTip] = useState<MoveOption | null>(null);
  const first = candidates[0]?.channel ?? "매입DB";
  const [toChannel, setToChannel] = useState<Channel>(first);
  const [toDate, setToDate] = useState<string>(fromDate);

  const weekDates = useMemo(() => {
    const fri = friOf(parseISO(fromDate));
    return Array.from({ length: 7 }, (_, i) => fmtISO(addDays(fri, i)));
  }, [fromDate]);

  const dateLocked = option ? isDateLocked(option) : false;
  const targetDate = dateLocked ? fromDate : toDate;
  // 옮길 자리에 이미 뭐가 적혀 있는지 — 다른 날짜일 때만 서버에서 확인한다.
  const targetDay = useDay(step === "where" && targetDate !== fromDate ? targetDate : "");
  const targetMetrics =
    targetDate === fromDate
      ? undefined // 같은 날짜의 다른 채널 — 화면이 이미 들고 있어 굳이 안 읽는다
      : targetDay.data?.channels[toChannel];

  if (!open) return null;

  const picked = candidates.find((c) => c.key === pickedKey);
  const fromChannel: Channel = picked?.channel ?? first;
  const inflowLocked = isInflowLocked(fromChannel, toChannel);
  const deltas = option ? moveDeltas(option, draft[fromChannel], inflowLocked) : {};
  const same = isSamePlace(
    { date: fromDate, channel: fromChannel },
    { date: targetDate, channel: toChannel },
  );
  const busy = targetDate !== fromDate && hasAnyRecord(targetMetrics);

  const stepNo = needsPick
    ? { which: 1, what: 2, where: 3 }[step]
    : { which: 1, what: 1, where: 2 }[step];
  const stepTotal = needsPick ? 3 : 2;
  const title =
    step === "which"
      ? "어느 미팅이 잘못됐나요?"
      : step === "what"
        ? "무엇을 옮길까요?"
        : "어디로 옮길까요?";

  const goBack = () => {
    if (step === "where") setStep("what");
    else if (step === "what" && needsPick) setStep("which");
    else onBack();
  };

  const from = formatKoreanDate(fromDate);
  const to = formatKoreanDate(targetDate);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-3 text-white">
          <button
            type="button"
            onClick={goBack}
            aria-label="뒤로"
            className="h-7 w-7 shrink-0 rounded-lg bg-slate-700 text-sm font-bold text-slate-200 hover:bg-slate-600 hover:text-white"
          >
            ←
          </button>
          <div>
            <span className="block text-[10px] font-bold tracking-wide text-slate-400">
              {stepNo} / {stepTotal} 단계
              {step === "where" && option ? ` · ${OPTION_TEXT[option].title}` : ""}
            </span>
            <h3 className="text-[15px] font-black leading-tight">{title}</h3>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {step === "which" && (
            <>
              {candidates.map((c) => {
                const md = formatKoreanDate(c.미팅날짜);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setPickedKey(c.key)}
                    className={`mb-1.5 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                      pickedKey === c.key
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                        pickedKey === c.key
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-gray-300"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-gray-900">
                        {c.업체명}
                      </span>
                      <span className="block text-[11px] font-semibold text-gray-500">
                        {md.label} ({md.dow}) {c.미팅시간}
                      </span>
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {step === "what" && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-gray-200">
                <div className="bg-white p-2.5">
                  <span className="block text-[10px] font-bold tracking-wide text-gray-400">
                    고칠 미팅
                  </span>
                  <span className="mt-0.5 block truncate text-base font-bold text-gray-900">
                    {picked?.업체명 ?? "—"}
                  </span>
                </div>
                <div className="bg-white p-2.5">
                  <span className="block text-[10px] font-bold tracking-wide text-gray-400">
                    지금 기록
                  </span>
                  <span
                    className={`mt-0.5 block text-base font-bold ${CHANNEL_TEXT[fromChannel]}`}
                  >
                    {fromChannel}
                    <span className="block text-sm text-gray-600">{from.label}</span>
                  </span>
                </div>
              </div>

              {MOVE_OPTIONS.map((k) => (
                <div
                  key={k}
                  onClick={() => {
                    setOption(k);
                    setOpenTip(k);
                  }}
                  className={`mb-1.5 cursor-pointer rounded-xl border px-3 py-2.5 ${
                    option === k ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                        option === k ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
                      }`}
                    />
                    <span
                      className={`text-[13px] font-bold leading-snug ${
                        option === k ? "text-indigo-700" : "text-gray-900"
                      }`}
                    >
                      {OPTION_TEXT[k].title}
                    </span>
                    <button
                      type="button"
                      aria-label={`${OPTION_TEXT[k].title} — 언제 고르나요`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenTip(openTip === k ? null : k);
                      }}
                      className="ml-auto h-5 w-5 shrink-0 rounded-full border border-gray-300 bg-white text-[10px] font-bold text-gray-500 hover:border-gray-400 hover:text-gray-900"
                    >
                      ?
                    </button>
                  </div>
                  {openTip === k && (
                    <p className="ml-5 mt-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 text-[11px] leading-relaxed text-gray-600">
                      {OPTION_TEXT[k].when}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}

          {step === "where" && (
            <>
              <div className="mb-3">
                <span className="mb-1.5 block text-[10px] font-bold tracking-wide text-gray-400">
                  채널
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNEL_ORDER.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setToChannel(c)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${CHIP_BG[c]} ${
                        c === toChannel ? "ring-2 ring-slate-900" : "opacity-40"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <span className="mb-1.5 block text-[10px] font-bold tracking-wide text-gray-400">
                  기록하는 날짜
                  {dateLocked ? " — 이 선택지는 날짜를 안 바꿔요" : ""}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {weekDates.map((d) => {
                    const k = formatKoreanDate(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={dateLocked}
                        onClick={() => setToDate(d)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40 ${
                          d === targetDate
                            ? "bg-slate-900 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {k.label} ({k.dow})
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-900">
                <b>
                  {fromChannel} {from.label}
                </b>{" "}
                →{" "}
                <b>
                  {toChannel} {to.label}
                </b>
                <br />
                미팅 1건
                {describeDeltas(deltas) ? ` · ${describeDeltas(deltas)}` : " (숫자는 그대로)"}
              </p>

              {same && (
                <p className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-600">
                  지금과 <b>같은 자리</b>예요. 채널이나 날짜를 바꿔주세요.
                </p>
              )}
              {busy && (
                <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                  <b>
                    {to.label} {toChannel}에 이미 기록이 있어요.
                  </b>{" "}
                  덮어쓰지 않고 더해집니다.
                </p>
              )}
              {inflowLocked && (
                <p className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-600">
                  <b>콜·지·기·소 유입은 못 옮겨요.</b> 영업기회 접수에서 자동으로 나오는
                  숫자라서, 옮기려면 STEP 1 에서 그 영업기회의 접수일을 고쳐주세요.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={goBack}
            className="flex-1 rounded-lg bg-gray-100 py-3 text-[13px] font-bold text-gray-700 hover:bg-gray-200"
          >
            뒤로
          </button>
          {step === "which" && (
            <button
              type="button"
              disabled={!pickedKey}
              onClick={() => setStep("what")}
              className="flex-1 rounded-lg bg-slate-900 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400"
            >
              다음
            </button>
          )}
          {step === "what" && (
            <button
              type="button"
              disabled={!option}
              onClick={() => {
                setToChannel(picked?.channel ?? first);
                setToDate(fromDate);
                setStep("where");
              }}
              className="flex-1 rounded-lg bg-slate-900 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400"
            >
              다음
            </button>
          )}
          {step === "where" && (
            <button
              type="button"
              disabled={same || !option || !picked}
              onClick={() =>
                onApply({
                  key: picked!.key,
                  option: option!,
                  to: { date: targetDate, channel: toChannel },
                  deltas: {
                    inflow: deltas.inflow,
                    contactProgress: deltas.contactProgress,
                  },
                })
              }
              className="flex-1 rounded-lg bg-slate-900 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400"
            >
              옮기기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
