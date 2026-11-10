/**
 * NoticePopup — 새소식 모달 (announcement-popup §3).
 *
 * 구조: 상단 공지(pinned 우선 — 서버 정렬 그대로, MD 렌더) → 구분선 →
 * "새로워졌어요 ✨" UpdateAccordion → 하단 [확인].
 * 기존 모달 패턴(z-[300], GeneralEventModal) 재사용 — 외곽 overflow-y-auto 스크롤.
 * 「본 것」 기록(onConfirm)은 ✕·[확인]·링크처럼 직접 누른 것만. 배경 탭·Esc 는 닫기만(onDismiss) —
 * 스크롤하다 배경을 스친 것으로 한 번만 보이는 공지가 영영 사라지지 않게(2026-11-10 UI 점검).
 */
"use client";

import { useEffect, useRef } from "react";

import { guideUrl } from "@/config";
import type { Notice, UpdateItem } from "@/types";
import NoticeContentView from "./NoticeContentView";
import UpdateAccordion from "./UpdateAccordion";

interface Props {
  notices: Notice[];
  updates: UpdateItem[];
  onConfirm: () => void;
  /** 기록 없이 닫기(배경 탭·Esc). 다음에 다시 뜬다. */
  onDismiss: () => void;
}

export default function NoticePopup({ notices, updates, onConfirm, onDismiss }: Props) {
  const empty = notices.length === 0 && updates.length === 0;
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss.current(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, []);
  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onDismiss}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="새소식"
        tabIndex={-1}
        className="mt-8 mb-8 w-full max-w-sm rounded-2xl bg-white shadow-xl outline-none 2xl:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h3 className="text-sm font-black text-slate-900">새소식</h3>
          <button
            type="button"
            onClick={onConfirm}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-2.5">
          {empty && (
            <p className="py-6 text-center text-sm text-slate-400">
              아직 새소식이 없어요.
            </p>
          )}

          {/* 공지 — pinned 우선(서버 정렬). MD + 이미지. */}
          {notices.map((n) => (
            <section key={n.id} className="mb-3 rounded-xl bg-red-50 p-2.5">
              <h4 className="mb-1 flex items-center gap-1 text-xs font-black text-slate-900">
                {n.pinned && <span aria-label="고정 공지">📌</span>}
                {n.title}
              </h4>
              <NoticeContentView content={n.bodyMd} />
            </section>
          ))}

          {notices.length > 0 && updates.length > 0 && (
            <div className="mb-3 border-t border-slate-100" />
          )}

          {updates.length > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-black text-slate-900">새로워졌어요 ✨</h4>
              <UpdateAccordion updates={updates} />
              <a
                href="/updates"
                onClick={onConfirm}
                className="mt-1 block text-center text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                지난 업데이트 모두 보기 →
              </a>
            </section>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-100 p-2.5">
          {/* 사용 가이드(노션) — env 설정 시 항상 노출(공지·업데이트 없어도). 새 탭. */}
          {guideUrl() && (
            <a
              href={guideUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onConfirm}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-red text-sm font-bold text-white transition-transform active:scale-95"
            >
              📚 사용 가이드 보기
            </a>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`h-11 w-full rounded-xl text-sm font-bold transition-transform active:scale-95 ${
              guideUrl()
                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                : "bg-brand-red text-white"
            }`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
