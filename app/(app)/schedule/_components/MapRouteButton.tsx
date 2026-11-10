"use client";
/**
 * 🧭 길찾기 (2026-11-07 belie 모바일 기획 2판 ④⑤) — 미팅 카드에서 카카오맵·네이버지도·티맵 중 하나로
 * 미팅 장소(주소가 아니면 업체 소재지)가 검색된 화면을 연다. 처음 한 번 고르고 「다음에도 이 앱으로」면 바로 연다.
 * 📞 통화 앱 고르기와 같은 방식. 검색어가 없으면 버튼 자체를 그리지 않는다.
 */
import { useState } from "react";
import { MAP_APPS, detectPlatform, mapLaunch, mapQuery, type MapAppId } from "@/util/map-links";

const KEY = "map-route-app";
function readApp(): MapAppId | null {
  try { const v = localStorage.getItem(KEY); return MAP_APPS.some(a => a.id === v) ? (v as MapAppId) : null; } catch { return null; }
}
function saveApp(v: MapAppId | null) {
  try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* 못 저장하면 다음에 다시 고른다 */ }
}

function launch(app: MapAppId, query: string) {
  const { open, fallback } = mapLaunch(app, query, detectPlatform(navigator.userAgent), window.location.hostname);
  window.location.href = open;
  if (!fallback) return;
  // 아이폰 — 앱이 열리면 화면이 가려진다. 1.5초 뒤에도 보이면 앱이 없는 것 → 대신 갈 곳.
  const timer = window.setTimeout(() => { if (document.visibilityState === "visible") window.location.href = fallback; }, 1500);
  document.addEventListener("visibilitychange", () => window.clearTimeout(timer), { once: true });
}

export default function MapRouteButton({ place, address }: { place?: string; address?: string }) {
  const query = mapQuery(place, address);
  const [picking, setPicking] = useState(false);
  const [keep, setKeep] = useState(true);
  const saved = readApp();
  if (!query) return null;
  const go = (app: MapAppId) => { if (keep) saveApp(app); setPicking(false); launch(app, query); };
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">📍 {query}</span>
        <button type="button" onClick={() => (saved ? launch(saved, query) : setPicking(true))}
          className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 active:bg-amber-100">
          🧭 길찾기
        </button>
        {saved && (
          <button type="button" onClick={() => setPicking(true)} className="shrink-0 text-xs text-slate-400 underline">
            지도 바꾸기
          </button>
        )}
      </div>
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPicking(false)}>
          <div role="dialog" aria-modal="true" aria-label="어느 지도로 갈까요?" onClick={e => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">어느 지도로 갈까요?</h2>
              <button type="button" aria-label="닫기" onClick={() => setPicking(false)} className="px-2 text-slate-400">✕</button>
            </div>
            <p className="truncate text-xs text-slate-500">{query}</p>
            <div className="grid gap-2" role="group" aria-label="지도 앱">
              {MAP_APPS.map(a => (
                <button key={a.id} type="button" onClick={() => go(a.id)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-bold text-slate-800 active:bg-slate-50">
                  {a.name}
                </button>
              ))}
              {saved && (
                <button type="button" onClick={() => { saveApp(null); setPicking(false); }} className="rounded-xl px-4 py-2 text-left text-xs text-slate-500">
                  매번 묻기
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} className="h-4 w-4" />
              다음에도 이 앱으로
            </label>
          </div>
        </div>
      )}
    </>
  );
}
