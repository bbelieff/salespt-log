/**
 * NoticePopup — 새소식 모달 (announcement-popup §3).
 *
 * 구조: 상단 공지(pinned 우선 — 서버 정렬 그대로, MD 렌더) → 구분선 →
 * "새로워졌어요 ✨" UpdateAccordion → 하단 [확인].
 * 기존 모달 패턴(z-[300], GeneralEventModal) 재사용 — 외곽 overflow-y-auto 스크롤.
 * 닫기(✕·배경·확인) 전부 onConfirm — "본 것" 처리 일원화 (Gate 가 localStorage 기록).
 */
"use client";

import type { Notice, UpdateItem } from "@/types";
import MarkdownView from "./MarkdownView";
import UpdateAccordion from "./UpdateAccordion";

interface Props {
  notices: Notice[];
  updates: UpdateItem[];
  onConfirm: () => void;
}

export default function NoticePopup({ notices, updates, onConfirm }: Props) {
  const empty = notices.length === 0 && updates.length === 0;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onConfirm}
    >
      <div
        className="mt-10 mb-10 w-full max-w-sm rounded-2xl bg-white shadow-xl 2xl:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-black text-gray-900">새소식</h3>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full px-2 text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3">
          {empty && (
            <p className="py-6 text-center text-sm text-gray-400">
              아직 새소식이 없어요.
            </p>
          )}

          {/* 공지 — pinned 우선(서버 정렬). MD + 이미지. */}
          {notices.map((n) => (
            <section key={n.id} className="mb-4 rounded-xl bg-red-50 p-3">
              <h4 className="mb-1.5 flex items-center gap-1 text-sm font-black text-gray-900">
                {n.pinned && <span aria-label="고정 공지">📌</span>}
                {n.title}
              </h4>
              <MarkdownView markdown={n.bodyMd} />
            </section>
          ))}

          {notices.length > 0 && updates.length > 0 && (
            <div className="mb-3 border-t border-gray-100" />
          )}

          {updates.length > 0 && (
            <section>
              <h4 className="mb-1 text-sm font-black text-gray-900">새로워졌어요 ✨</h4>
              <UpdateAccordion updates={updates} />
            </section>
          )}
        </div>

        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 w-full rounded-xl bg-brand-red text-sm font-bold text-white transition-transform active:scale-95"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
