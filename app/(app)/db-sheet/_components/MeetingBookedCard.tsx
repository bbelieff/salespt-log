"use client";
/**
 * 미팅 등록 확인 카드(2026-11-08 belie 「미팅예약이 STEP 3 에 등록되는 걸 사용자에게 확인시키고, 어떻게 기록됐는지 보고 고칠 수 있게」).
 * 미팅이 이어진 DB 의 미팅예약 칸 아래 — STEP 3 에 들어갔다는 사실 · 미팅 날짜·시간·장소 · 일별 기록에 어떻게 셌는지 · 고치는 길(일정·계약).
 * 값은 미팅 정본(서버가 DB 줄에 투영한 contact)만 보여 준다. 고치기는 기존 일정 변경 화면(edit=schedule)으로 — DB 줄은 미팅 읽기 전용.
 * just = 이 화면에서 방금 등록됨 → 강조 + 화면에 보이게 스크롤.
 */
import { useEffect, useRef } from "react";
import type { Row } from "./model";
import type { ContactDraft } from "./ContactPanel";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
export function meetingWhen(date: string, time: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return [date, time].filter(Boolean).join(" ") || "날짜 미정";
  const day = DAYS[new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).getUTCDay()];
  return `${+m[2]!}/${+m[3]!}(${day})${time ? ` ${time}` : ""}`;
}

export function MeetingBookedCard({ row, draft, just = false }: { row: Pick<Row, "id" | "channel" | "stage" | "meetingId" | "effectiveMeetingId" | "recording">; draft: ContactDraft; just?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!just) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [just]);
  const id = row.effectiveMeetingId ?? row.meetingId ?? "";
  const base = `/schedule?date=${encodeURIComponent(draft.meetingDate)}&focus=${encodeURIComponent(id)}`;
  const counted = row.recording?.activities !== false;
  const reserved = draft.date ? meetingWhen(draft.date, "") : "";
  return (
    <section ref={ref} role="status" aria-label="미팅 등록 확인" className={`db-meeting-booked${just ? " is-just" : ""}`}>
      <p className="db-meeting-booked-title">{just ? "방금 STEP 3 일정에 등록됐어요" : "STEP 3 일정에 등록돼 있어요"}{row.stage && <span className="sheet-badge is-active">{row.stage}</span>}</p>
      <dl className="db-meeting-booked-facts">
        <div><dt>미팅</dt><dd>{meetingWhen(draft.meetingDate, draft.time)}</dd></div>
        <div><dt>장소</dt><dd>{draft.place || draft.ci.소재지 || "—"}</dd></div>
        {draft.reservationNote && <div><dt>예약비고</dt><dd>{draft.reservationNote}</dd></div>}
        <div><dt>일별 기록</dt><dd>{counted ? `${reserved ? `${reserved} ` : ""}${row.channel} · 컨택진행 +1 · 미팅예약 +1` : "일별 기록 꺼짐 — 숫자는 올라가지 않아요"}</dd></div>
      </dl>
      <div className="db-meeting-booked-actions">
        <a className="sheet-btn primary" href={`${base}&edit=schedule`}>날짜·시간 고치기</a>
        <a className="sheet-btn" href={base}>STEP 3 일정에서 보기 →</a>
      </div>
    </section>
  );
}
