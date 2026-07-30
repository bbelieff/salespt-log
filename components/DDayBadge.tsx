/**
 * DDayBadge — 슬림 브랜드 바 중앙에 표시되는 D-day 카운터 위젯.
 *
 * 데이터: useMe()의 graduationISO — 시트 **O2 직접값**이 진실(종강총회일 = 수료일).
 *   offset(7기+ 50일 / 6기 legacy 57일)은 ADR-0005·@/config/cohort-dates 참조 — 여기서 가정하지 않는다.
 * 계산: graduationISO − today (브라우저 로컬 자정 기준).
 *
 * 표시 규칙:
 *  - 양수 N: D-N (남은 일수, 검정 박스 흰 글자)
 *  - 0: D-DAY (빨강 강조)
 *  - 음수(종강 경과): **🎓 수료** (R4 W1-3 기본안·📥 — 무제한 CRM에선 D+N 이 3자리를
 *    넘을 수 있어 지난 일수 카운트 자체를 중단)
 *  - 데이터 없음: "D-—"
 *
 * 디자인 참조: 철제 카운트다운 달력 — 두 자리 숫자 박스 분할 (10의 자리 / 1의 자리).
 *   2자리(99일) 가정은 **남은 일수에만** 적용 — 코스 50일이라 충분. 지난 일수는 수료 표시로 대체.
 */
"use client";

import { useEffect, useState } from "react";

interface Props {
  graduationISO: string | undefined; // YYYY-MM-DD or undefined (loading)
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

export default function DDayBadge({ graduationISO }: Props) {
  // hydration mismatch 방지 — 클라이언트에서만 today 계산
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(todayISO());
    // 자정 넘어가면 update — 30분 polling으로 충분 (정확성 less critical)
    const t = setInterval(() => setToday(todayISO()), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!graduationISO || !today) {
    // 로딩 placeholder
    return (
      <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-400">
        <span>D-—</span>
      </div>
    );
  }

  const remain = daysBetween(today, graduationISO);
  const abs = Math.abs(remain);
  const tens = Math.floor(abs / 10);
  const ones = abs % 10;

  // 색 분기 (수료·D-DAY 는 아래서 조기 return — 숫자 박스는 남은 일수 전용)
  let cls = "bg-gray-900 text-white";
  if (remain === 0) {
    return (
      <div className="flex items-center rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-white">
        D-DAY
      </div>
    );
  }
  if (remain < 0) {
    // 종강 경과 = 수료 — D+N 카운트 대신 상태 뱃지 (R4 W1-3).
    return (
      <div className="flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-white">
        🎓 수료
      </div>
    );
  }
  if (remain <= 7) {
    cls = "bg-red-600 text-white"; // 임박 강조
  }

  return (
    <div className="flex items-center gap-0.5">
      {/* "D" 박스 + "−" 박스 — 숫자와 동일한 철제달력 스타일 (남은 일수 전용) */}
      <CharBox char="D" cls={cls} />
      <CharBox char="−" cls={cls} />
      <DigitBox digit={tens} cls={cls} />
      <DigitBox digit={ones} cls={cls} />
    </div>
  );
}

function CharBox({ char, cls }: { char: string; cls: string }) {
  return (
    <div
      className={`relative flex h-6 w-5 items-center justify-center rounded-sm font-mono text-[14px] font-extrabold leading-none ${cls}`}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-px border-t border-black/30"
        aria-hidden
      />
      {char}
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
