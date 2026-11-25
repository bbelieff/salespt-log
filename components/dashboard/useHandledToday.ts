"use client";
/**
 * 「오늘 N건 처리」 — 서버 기록 없이 이 기기 브라우저만 기억한다(할 일 구역 개편 1단계, 2026-11-24).
 * 그날 본 「남은 건수」의 최댓값을 적어 두고, 지금 남은 건수와의 차이를 처리한 건수로 본다.
 * 그래서 어림값이다: 처리한 뒤 새 일이 들어오면 그만큼 적게 보이고, 다른 기기에서 처리한 일은 그 기기에서 본 만큼만 센다.
 * 저장소를 못 쓰는 브라우저(사생활 보호 창 등)에서는 이번 화면에서 본 값만으로 세고, 화면은 그대로 동작한다.
 * 한 브라우저를 여러 계정이 쓰면 섞이지 않게 계정 표시(scope)의 짧은 해시를 함께 적고, 다르면 새로 센다(원문은 저장하지 않는다).
 */
import { useEffect, useRef, useState } from "react";

export const HANDLED_TODAY_KEY = "followups-handled-today";
type Peak = { date: string; who: string; value: number };

/** 계정을 가르는 용도의 짧은 해시(djb2) — 되돌릴 수 없고, 같은 기기 안에서 다른 계정인지 알아보는 데만 쓴다. */
function shortHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function readPeak(todayISO: string, who: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(HANDLED_TODAY_KEY) ?? "null") as { date?: unknown; who?: unknown; peak?: unknown } | null;
    return saved?.date === todayISO && (saved.who ?? "") === who && typeof saved.peak === "number" && Number.isFinite(saved.peak) ? saved.peak : 0;
  } catch { return 0; }
}

/** todayISO 가 없거나 ready=false(조회 일부 실패 — 남은 건수가 실제보다 적게 보임)면 세지도 적지도 않는다. */
export function useHandledToday(todayISO: string | undefined, remaining: number, ready: boolean, scope = ""): number {
  const who = scope ? shortHash(scope) : "";
  const seen = useRef<Peak | null>(null);
  const [peak, setPeak] = useState<Peak | null>(null);
  useEffect(() => {
    if (!todayISO || !ready) return;
    const value = Math.max(readPeak(todayISO, who), remaining, seen.current?.date === todayISO && seen.current.who === who ? seen.current.value : 0);
    try { localStorage.setItem(HANDLED_TODAY_KEY, JSON.stringify(who ? { date: todayISO, who, peak: value } : { date: todayISO, peak: value })); } catch { /* 저장 못 해도 이번 화면에서는 센다 */ }
    seen.current = { date: todayISO, who, value };
    setPeak(seen.current);
  }, [todayISO, remaining, ready, who]);
  return todayISO && ready && peak?.date === todayISO && peak.who === who ? Math.max(0, peak.value - remaining) : 0;
}
