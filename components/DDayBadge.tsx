/**
 * DDayBadge — 슬림 브랜드 바 중앙에 표시되는 D-day 카운터 위젯.
 *
 * 데이터: useMe()의 weekTargetISO (= 수강시작일 + 49일, 7주차 D-day target).
 * 계산: target - today (브라우저 로컬 자정 기준).
 *
 * 표시 규칙:
 *  - 양수 N: D-N (남은 일수, 검정 박스 흰 글자)
 *  - 0: D-DAY (빨강 강조)
 *  - 음수 N: D+|N| (지난 일수, 회색조)
 *  - 데이터 없음: "D-—"
 *
 * 디자인 참조: 철제 카운트다운 달력 — 두 자리 숫자 박스 분할 (10의 자리 / 1의 자리).
 *   2자리 한도(99일) 가정. 7주(49일) 기준이라 충분.
 */
"use client";

import { useEffect, useState } from "react";

interface Props {
  weekTargetISO: string | undefined; // YYYY-MM-DD or undefined (loading)
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  // 자정 기준 정수 일수 차이 (timezone offset 무시 — ISO 문자열 직접 비교).
  const [fy, fm, fd] = fromISO.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toISO.split("-").map(Number) as [number, number, number];
  const fromUTC = Date.UTC(fy, fm - 1, fd);
  const toUTC = Date.UTC(ty, tm - 1, td);
  return Math.round((toUTC - fromUTC) / 86_400_000);
}

export default function DDayBadge({ weekTargetISO }: Props) {
  // hydration mismatch 방지 — 클라이언트에서만 today 계산
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(todayISO());
    // 자정 넘어가면 update — 30분 polling으로 충분 (정확성 less critical)
    const t = setInterval(() => setToday(todayISO()), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!weekTargetISO || !today) {
    // 로딩 placeholder
    return (
      <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-400">
        <span>D-—</span>
      </div>
    );
  }

  const remain = daysBetween(today, weekTargetISO);
  const abs = Math.abs(remain);
  const tens = Math.floor(abs / 10);
  const ones = abs % 10;

  // 색 분기
  let prefix = "D-";
  let cls = "bg-gray-900 text-white";
  if (remain === 0) {
    return (
      <div className="flex items-center rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-white">
        D-DAY
      </div>
    );
  }
  if (remain < 0) {
    prefix = "D+";
    cls = "bg-gray-400 text-white";
  } else if (remain <= 7) {
    cls = "bg-red-600 text-white"; // 임박 강조
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-bold tracking-tight text-gray-500">
        {prefix}
      </span>
      <div className="flex items-center gap-0.5">
        <DigitBox digit={tens} cls={cls} />
        <DigitBox digit={ones} cls={cls} />
      </div>
    </div>
  );
}

function DigitBox({ digit, cls }: { digit: number; cls: string }) {
  return (
    <div
      className={`relative flex h-6 w-5 items-center justify-center rounded-sm font-mono text-[14px] font-extrabold leading-none ${cls}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {/* 가운데 가로선 — flip clock 분할 표시 */}
      <span
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-px border-t border-black/30"
        aria-hidden
      />
      {digit}
    </div>
  );
}
