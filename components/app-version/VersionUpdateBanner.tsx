"use client";
/**
 * 새 버전 알림(2026-10-26 belie) — 화면을 열어 둔 사이에 운영 반영(배포)이 끝나면 화면 아래 가운데에
 * 「새 버전이 나왔어요 · 버전명 · 새로고침」을 띄운다. 닫으면 그 버전은 이 탭에서 다시 묻지 않는다.
 * 확인 시점: 처음 1분 뒤 · 5분마다 · 다른 앱/탭에서 돌아왔을 때. 운영 빌드에서만 돈다.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import "./version-banner.css";

const MINE = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const EVERY_MS = 5 * 60_000;
const FIRST_MS = 60_000;
const DISMISS_KEY = "app-version-dismissed";

/** 서버 버전이 지금 화면과 다르면 새 버전. 어느 한쪽이 비어 있으면(개발·오류) 묻지 않는다. */
export function isNewVersion(mine: string, server: string): boolean {
  return !!mine && !!server && mine !== server;
}

export default function VersionUpdateBanner({ enabled = process.env.NODE_ENV === "production" }: { enabled?: boolean }) {
  const [latest, setLatest] = useState("");
  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version?: string };
      if (!version || !isNewVersion(MINE, version)) return;
      let dismissed = "";
      try { dismissed = sessionStorage.getItem(DISMISS_KEY) ?? ""; } catch { /* 저장소 막힘 */ }
      if (dismissed !== version) setLatest(version);
    } catch { /* 네트워크 끊김 — 다음에 다시 */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(check, FIRST_MS);
    const timer = setInterval(check, EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [enabled, check]);

  if (!latest) return null;
  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, latest); } catch { /* 저장소 막힘 */ }
    setLatest("");
  };
  return <div className="vu-banner" role="status" aria-live="polite">
    <span className="vu-dot" aria-hidden />
    <span className="vu-text"><strong>새 버전이 나왔어요</strong><small>{latest}</small></span>
    <button type="button" className="vu-reload" onClick={() => location.reload()}><RefreshCw size={14} aria-hidden />새로고침</button>
    <button type="button" className="vu-close" onClick={dismiss} aria-label="새 버전 알림 닫기"><X size={16} aria-hidden /></button>
  </div>;
}
