/**
 * AnnouncementsGate — (app) layout mount 시 새소식 자동 팝업 (announcement-popup §3).
 *
 * 자동 팝업 조건(둘 다 아니면 안 띄움):
 *   ① 안 본 새 업데이트 — localStorage `lastSeenPr` < latestPr
 *   ② display_mode 충족 활성 공지 — once: `noticeSeen:{id}` 없음 /
 *      daily: `noticeSeen:{id}:{YYYY-MM-DD}` 없음 / always: 매번
 * 빈도 제어는 전부 클라 localStorage — 서버 기록 금지 (시트 쓰기 과다, SoR §3).
 *
 * 수동 재열람: TopHeader 가 window CustomEvent `salespt:open-announcements` 발신
 * → 조건 무관 열림. [확인] 시 lastSeenPr 갱신 + 표시된 공지 seen 마킹.
 */
"use client";

import { useEffect, useState } from "react";
import { useAnnouncements } from "@/query/announcements-hook";
import type { AnnouncementsView } from "@/service";
import NoticePopup from "./NoticePopup";

export const OPEN_ANNOUNCEMENTS_EVENT = "salespt:open-announcements";
/** [확인] 후 발신 — TopHeader 점 뱃지 즉시 갱신용. */
export const ANNOUNCEMENTS_SEEN_EVENT = "salespt:announcements-seen";

/** 로컬 디바이스 기준 YYYY-MM-DD (daily 빈도 키). */
function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function lastSeenPr(): number {
  const v = Number(localStorage.getItem("lastSeenPr") ?? "0");
  return Number.isFinite(v) ? v : 0;
}

/** display_mode 기준 "지금 자동으로 보여줘야 할" 공지인가. */
function noticeDue(id: string, mode: string, today: string): boolean {
  if (mode === "always") return true;
  if (mode === "daily") return localStorage.getItem(`noticeSeen:${id}:${today}`) === null;
  return localStorage.getItem(`noticeSeen:${id}`) === null; // once
}

/** 자동 팝업 여부 — ① 새 업데이트 or ② due 공지. */
function shouldAutoShow(view: AnnouncementsView): boolean {
  const today = todayLocal();
  if (view.latestPr > lastSeenPr()) return true;
  return view.notices.some((n) => noticeDue(n.id, n.displayMode, today));
}

export default function AnnouncementsGate() {
  const q = useAnnouncements();
  const [open, setOpen] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);

  // 데이터 도착 시 1회 자동 판정 (localStorage 는 클라 전용 → effect 안에서만).
  useEffect(() => {
    if (!q.data || autoChecked) return;
    setAutoChecked(true);
    if (shouldAutoShow(q.data)) setOpen(true);
  }, [q.data, autoChecked]);

  // 헤더 "새소식" 수동 재열람.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ANNOUNCEMENTS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ANNOUNCEMENTS_EVENT, onOpen);
  }, []);

  if (!open || !q.data) return null;

  const confirm = () => {
    const today = todayLocal();
    for (const n of q.data!.notices) {
      if (n.displayMode === "once") localStorage.setItem(`noticeSeen:${n.id}`, "1");
      if (n.displayMode === "daily")
        localStorage.setItem(`noticeSeen:${n.id}:${today}`, "1");
    }
    if (q.data!.latestPr > 0)
      localStorage.setItem("lastSeenPr", String(q.data!.latestPr));
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENTS_SEEN_EVENT));
    setOpen(false);
  };

  return (
    <NoticePopup notices={q.data.notices} updates={q.data.updates} onConfirm={confirm} />
  );
}

/** TopHeader 점 뱃지용 — 안 본 새 업데이트 존재 여부 (클라 전용). */
export function hasUnseenUpdates(latestPr: number): boolean {
  if (typeof window === "undefined") return false;
  return latestPr > lastSeenPr();
}
