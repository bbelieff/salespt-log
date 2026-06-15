/**
 * NoticeManager — admin 공지 작성/수정 (announcement-popup §4 상단).
 *
 * 목록에서 선택 → 폼 로드(수정), [새 공지] → 빈 폼. 본문은 리치 에디터
 * (RichNoticeEditor — tiptap WYSIWYG, 출력 HTML). 이미지는 에디터 툴바에서 삽입.
 * 저장 = POST /api/admin/announcements (서버에서 HTML 소독 후 upsert + 캐시 무효화).
 */
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Notice } from "@/types";

// tiptap 은 SSR 비호환 → 클라 전용 동적 로드.
const RichNoticeEditor = dynamic(
  () => import("@/components/announcements/RichNoticeEditor"),
  { ssr: false, loading: () => <div className="min-h-32 rounded-lg border border-gray-200 bg-gray-50" /> },
);

const EMPTY = {
  id: "",
  created: "",
  title: "",
  bodyMd: "",
  audience: "all",
  displayMode: "once",
  start: "",
  end: "",
  pinned: false,
  active: true,
};
type Form = typeof EMPTY;

const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-red-300 focus:outline-none";

export default function NoticeManager({ initialNotices }: { initialNotices: Notice[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  function load(n: Notice) {
    setForm({ ...n });
    setMsg("");
  }

  async function save(overrides?: Partial<Form>) {
    const payload = { ...form, ...overrides };
    if (!payload.title.trim()) {
      setMsg("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setMsg("저장 중…");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          id: payload.id || undefined,
          created: payload.created || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `저장 ${res.status}`);
      setMsg("저장했어요. 수강생 팝업에 바로 반영돼요.");
      setForm({ ...data.notice });
      router.refresh();
    } catch (e) {
      setMsg(`저장 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black text-gray-900">공지 작성/수정</h2>
        <button
          type="button"
          onClick={() => { setForm(EMPTY); setMsg(""); }}
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          + 새 공지
        </button>
      </div>

      {/* 기존 공지 목록 */}
      {initialNotices.length > 0 && (
        <ul className="mb-4 divide-y divide-gray-50 rounded-xl border border-gray-100">
          {initialNotices.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => load(n)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  form.id === n.id ? "bg-red-50" : ""
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${n.active ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">
                  {n.pinned && "📌 "}{n.title}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {n.audience} · {n.displayMode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 편집 폼 */}
      <div className="space-y-2.5">
        <input
          className={inputCls}
          placeholder="공지 제목"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
        />

        {/* 리치 에디터 (WYSIWYG) — 굵게·밑줄·색·형광펜·목록·링크·이미지. 출력=HTML. */}
        <RichNoticeEditor value={form.bodyMd} onChange={(html) => set({ bodyMd: html })} />

        {/* 노출 옵션 */}
        <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
          <label className="text-xs font-semibold text-gray-500">
            대상
            <select
              className={inputCls}
              value={form.audience}
              onChange={(e) => set({ audience: e.target.value })}
            >
              <option value="all">전체</option>
              <option value="arena">아레나만</option>
              <option value="regular">일반 기수만</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-500">
            빈도
            <select
              className={inputCls}
              value={form.displayMode}
              onChange={(e) => set({ displayMode: e.target.value })}
            >
              <option value="once">한 번만 (확인 후 안 봄)</option>
              <option value="daily">하루 1회</option>
              <option value="always">매 접속</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-500">
            시작일 (빈값 = 즉시)
            <input
              type="date"
              className={inputCls}
              value={form.start}
              onChange={(e) => set({ start: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-gray-500">
            종료일 (빈값 = 무제한)
            <input
              type="date"
              className={inputCls}
              value={form.end}
              onChange={(e) => set({ end: e.target.value })}
            />
          </label>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => set({ pinned: e.target.checked })}
            />
            📌 상단 고정
          </label>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set({ active: e.target.checked })}
            />
            활성 (체크 해제 = 노출 중단)
          </label>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="h-11 w-full rounded-xl bg-brand-red text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          {form.id ? "수정 저장" : "공지 올리기"}
        </button>
        {msg && <p className="text-xs font-semibold text-gray-500">{msg}</p>}
      </div>
    </section>
  );
}
