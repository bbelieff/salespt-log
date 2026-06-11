/**
 * NoticeManager — admin 공지 작성/수정 (announcement-popup §4 상단).
 *
 * 목록에서 선택 → 폼 로드(수정), [새 공지] → 빈 폼. MD 에디터는 편집/미리보기
 * 토글(MarkdownView — 수강생 팝업과 동일 렌더). [🖼 이미지] = 파일 선택 →
 * POST /api/admin/notice-image → 반환 URL 을 MD 이미지 문법으로 커서 위치 삽입.
 * 저장 = POST /api/admin/announcements (upsert + 수강생 캐시 무효화).
 */
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Notice } from "@/types";
import MarkdownView from "@/components/announcements/MarkdownView";

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
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  function load(n: Notice) {
    setForm({ ...n });
    setPreview(false);
    setMsg("");
  }

  async function uploadImage(file: File) {
    setBusy(true);
    setMsg("이미지 올리는 중…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/notice-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `업로드 ${res.status}`);
      const md = `\n![이미지](${data.url})\n`;
      const ta = bodyRef.current;
      const pos = ta?.selectionStart ?? form.bodyMd.length;
      set({ bodyMd: form.bodyMd.slice(0, pos) + md + form.bodyMd.slice(pos) });
      setMsg("이미지를 본문에 넣었어요.");
    } catch (e) {
      setMsg(`이미지 업로드 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
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

        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-full bg-gray-100 p-1">
            {(["편집", "미리보기"] as const).map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreview(i === 1)}
                className={`h-7 rounded-full text-xs font-bold ${
                  preview === (i === 1) ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="cursor-pointer rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
            🖼 이미지
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {preview ? (
          <div className="min-h-24 rounded-lg border border-gray-100 bg-red-50 p-3">
            <MarkdownView markdown={form.bodyMd || "(본문이 비어 있어요)"} />
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            className="min-h-32 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-red-300 focus:outline-none"
            placeholder={"공지 본문 (마크다운)\n이미지는 [🖼 이미지] 버튼으로 넣을 수 있어요."}
            value={form.bodyMd}
            onChange={(e) => set({ bodyMd: e.target.value })}
          />
        )}

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
