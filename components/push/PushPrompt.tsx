"use client";
/**
 * Dashboard invitation under 「오늘 챙길 일」 (plan §2-2 1번). Pilot users only, never a
 * permission popup: it links to the settings screen, where the tap asks for permission.
 * Hidden once this browser receives, and for 7 days after 「나중에」.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track, EVENTS } from "@/analytics";
import { usePushState } from "@/query/push-hooks";
import "./push.css";

const SNOOZE_KEY = "push-prompt-snoozed-until";
const SNOOZE_DAYS = 7;

function snoozed(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now(); } catch { return false; }
}

export default function PushPrompt() {
  const state = usePushState();
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!state.data?.available || snoozed()) return;
    let cancelled = false;
    (async () => {
      let receiving = false;
      try {
        const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : undefined;
        const sub = await reg?.pushManager.getSubscription();
        receiving = !!sub && state.data.devices.some(d => d.endpointTail === sub.endpoint.slice(-16));
      } catch { receiving = false; }
      if (!cancelled) setVisible(!receiving);
    })();
    return () => { cancelled = true; };
  }, [state.data]);

  useEffect(() => {
    if (visible && !shown.current) { shown.current = true; track(EVENTS.PUSH_PROMPT_SHOWN, { where: "dashboard" }); }
  }, [visible]);

  if (!visible) return null;
  function later() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* still hide for now */ }
    track(EVENTS.PUSH_PROMPT_RESULT, { result: "later", where: "dashboard" });
    setVisible(false);
  }
  return <section className="push-prompt" aria-labelledby="push-prompt-title">
    <h2 id="push-prompt-title">챙길 일을 폰으로 알려 드릴까요?</h2>
    <p>앱을 안 열어도 아침·저녁에 꼭 챙길 업체를 알려 드려요. 시간과 받을 내용은 직접 고를 수 있어요.</p>
    <div className="push-row">
      <Link href="/settings/notifications" className="push-primary inline-flex items-center">알림 켜기</Link>
      <button type="button" className="push-link" onClick={later}>나중에</button>
    </div>
  </section>;
}
