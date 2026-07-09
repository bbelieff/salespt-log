/**
 * 캘린더 탭 상단 "구글 캘린더 연동" 카드 (gcal-1, google-calendar-sync §4).
 * 문구는 §4-1 확정판 그대로 — 금지 용어(동기화·토큰·만료·OAuth·캘린더 ID) 화면 노출 금지.
 * 미연결 / 연결됨 / 실패(연결이 풀렸어요) 3상태. 이벤트 전파는 gcal-2.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

interface Cal { id: string; summary: string; primary: boolean }
interface Settings { calendarId: string; meeting: boolean; todo: boolean; general: boolean }
interface CardState { connected: boolean; settings: Settings; calendars: Cal[]; error: boolean }

const TOGGLES: { key: keyof Omit<Settings, "calendarId">; label: string }[] = [
  { key: "meeting", label: "미팅" },
  { key: "todo", label: "실무" },
  { key: "general", label: "일반" },
];

export default function GcalConnectCard() {
  const [state, setState] = useState<CardState | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/gcal", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => { void load(); }, [load]);

  // OAuth 콜백 복귀 처리 (?gcal=connected|denied|error) — 토스트 후 쿼리 정리.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("gcal");
    if (!p) return;
    setToast(p === "connected" ? "구글 캘린더에 연결됐어요" : p === "denied" ? "연결을 취소했어요" : "연결에 실패했어요. 다시 시도해 주세요");
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, []);

  const patch = async (body: Partial<Settings>) => {
    setBusy(true);
    const res = await fetch("/api/gcal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { settings?: Settings };
      setState((s) => (s && data.settings ? { ...s, settings: data.settings } : s));
    }
    setBusy(false);
  };

  const disconnect = async () => {
    setBusy(true);
    await fetch("/api/gcal", { method: "DELETE" });
    setBusy(false);
    setToast("이미 등록된 일정은 구글에 남아요");
    await load();
    setTimeout(() => setToast(null), 3500);
  };

  const card = "rounded-2xl border border-neutral-200 bg-white p-4 text-sm";

  if (state === null) {
    return <div className={`${card} text-neutral-400`}>구글 캘린더 연동 …</div>;
  }

  // 실패(토큰 무효) — "연결이 풀렸어요"
  if (state.error) {
    return (
      <div className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-semibold">구글 캘린더 연동</span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">연결이 풀렸어요</span>
        </div>
        <a href="/api/gcal/auth" className="inline-block rounded-lg bg-neutral-900 px-3 py-2 text-white">다시 연결</a>
        {toast && <p className="mt-2 text-xs text-neutral-500">{toast}</p>}
      </div>
    );
  }

  // 미연결
  if (!state.connected) {
    return (
      <div className={card}>
        <div className="mb-1 font-semibold">구글 캘린더 연동</div>
        <p className="mb-3 text-neutral-500">예약한 일정이 내 구글 캘린더에 자동으로 등록돼요</p>
        <a href="/api/gcal/auth" className="inline-block rounded-lg bg-neutral-900 px-3 py-2 text-white">연결하기</a>
        <p className="mt-2 text-xs text-neutral-400">경고가 떠도 안전해요. [고급] → [이동]을 눌러 주세요.</p>
        {toast && <p className="mt-2 text-xs text-neutral-500">{toast}</p>}
      </div>
    );
  }

  // 연결됨
  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-semibold">구글 캘린더 연동</span>
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">연결됨</span>
      </div>
      <label className="mb-3 flex items-center gap-2">
        <span className="shrink-0 text-neutral-500">캘린더</span>
        <select
          disabled={busy}
          value={state.settings.calendarId}
          onChange={(e) => patch({ calendarId: e.target.value })}
          className="min-w-0 flex-1 truncate rounded-lg border border-neutral-200 px-2 py-1.5"
        >
          {(state.calendars.length ? state.calendars : [{ id: "primary", summary: "기본 캘린더", primary: true }]).map((c) => (
            <option key={c.id} value={c.id}>{c.summary}</option>
          ))}
        </select>
      </label>
      <div className="mb-3 flex gap-2">
        {TOGGLES.map((t) => {
          const on = state.settings[t.key];
          return (
            <button
              key={t.key}
              disabled={busy}
              onClick={() => patch({ [t.key]: !on })}
              className={`flex-1 rounded-lg border px-2 py-1.5 ${on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-500"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button disabled={busy} onClick={disconnect} className="text-xs text-neutral-400 underline">연결 해제</button>
      {toast && <p className="mt-2 text-xs text-neutral-500">{toast}</p>}
    </div>
  );
}
