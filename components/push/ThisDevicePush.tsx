"use client";
/**
 * 「이 기기에서 알림 받기」 — one block that knows which browser it is on (plan §2-2 2번).
 * Android/PC Chrome ask for permission; an iPhone tab is guided to the home-screen app first;
 * the KakaoTalk in-app browser is sent to Chrome.
 */
import { useState } from "react";
import { track, EVENTS } from "@/analytics";
import type { PushReadiness } from "@/util/push-device";
import type { useThisDevicePush } from "@/query/push-hooks";

type Device = ReturnType<typeof useThisDevicePush>;

const IOS_STEPS = [
  "화면 아래(또는 위) 공유 버튼을 눌러요.",
  "「홈 화면에 추가」를 눌러요.",
  "홈 화면에 생긴 경영일지 아이콘으로 열고, 여기서 다시 「알림 받기」를 눌러요.",
];

function openInChrome() {
  const target = window.location.href;
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`;
}

export default function ThisDevicePush({ device, onSubscribed }: { device: Device; onSubscribed?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const readiness: PushReadiness | null = device.readiness;

  if (readiness === null) return <p className="push-muted" role="status">이 기기를 확인하고 있어요…</p>;

  if (readiness === "subscribed") {
    return <p className="push-ok" role="status">이 기기로 알림을 받고 있어요.</p>;
  }
  if (readiness === "kakao") {
    return <div className="push-stack">
      <p>카카오톡 안에서는 알림을 받을 수 없어요. 크롬에서 열어 주세요.</p>
      <button type="button" className="push-primary" onClick={openInChrome}>크롬으로 열기</button>
    </div>;
  }
  if (readiness === "ios_too_old") {
    return <p>아이폰을 iOS 16.4 이상으로 업데이트하면 알림을 받을 수 있어요. 설정 → 일반 → 소프트웨어 업데이트에서 확인해 주세요.</p>;
  }
  if (readiness === "ios_needs_home") {
    return <div className="push-stack">
      <p>아이폰은 홈 화면에 추가한 경영일지 아이콘에서만 알림을 받을 수 있어요.</p>
      <ol className="push-steps">{IOS_STEPS.map(s => <li key={s}>{s}</li>)}</ol>
      <p className="push-muted">크롬 아이콘을 눌렀을 때 주소창이 보이면 사파리에서 이 주소를 열고 다시 추가해 주세요.</p>
    </div>;
  }
  if (readiness === "denied") {
    return <p>이 브라우저에서 알림이 차단돼 있어요. 브라우저 설정 → 사이트 설정 → 알림에서 salesptlog.online 을 허용으로 바꾼 뒤 이 화면을 새로 열어 주세요.</p>;
  }
  if (readiness === "unsupported") {
    return <p>이 브라우저는 알림을 지원하지 않아요. 안드로이드·PC는 크롬, 아이폰은 홈 화면 아이콘으로 열어 주세요.</p>;
  }

  async function enable() {
    setBusy(true);
    setNote(null);
    const result = await device.subscribe();
    setBusy(false);
    track(EVENTS.PUSH_PROMPT_RESULT, { result: result === "subscribed" ? "accepted" : result, platform: device.device?.kind ?? "other" });
    if (result === "subscribed") { track(EVENTS.PUSH_SUBSCRIBED, { platform: device.device?.kind ?? "other", browser: device.device?.browser ?? "" }); onSubscribed?.(); }
    else if (result === "denied") setNote("알림을 허용하지 않았어요. 나중에 브라우저 설정에서 다시 켤 수 있어요.");
    else setNote("알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요.");
  }

  return <div className="push-stack">
    <p>잠금화면에 업체명이 보일 수 있어요. 아래 설정에서 숨길 수 있어요.</p>
    <button type="button" className="push-primary" onClick={enable} disabled={busy} aria-busy={busy}>
      {busy ? "켜는 중…" : "이 기기에서 알림 받기"}
    </button>
    {note && <p className="push-muted" role="status">{note}</p>}
  </div>;
}
