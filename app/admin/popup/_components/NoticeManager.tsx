/**
 * NoticeManager — admin 공지 작성/수정 (announcement-popup §4 상단).
 *
 * Scope D (bounded autosave draft UX):
 * - 편집 중 입력은 sessionStorage(인증 admin 이메일 키잉)에만 자동 보관.
 *   새로고침·목록 이동·다른 공지 편집 전환에도 초안이 살아남는다.
 * - 서버 전송은 상단 compact [게시]/[게시 반영] 버튼에서만 (POST /api/admin/announcements).
 *   마운트·복원·타이머는 fetch 하지 않는다.
 * - 초안은 ACK된 리비전과 현재 입력이 정확히 일치할 때만 삭제 — 저장 중
 *   이어쓰기·늦은 응답이 타이핑을 덮어쓰지 않는다.
 * - 공지 전환 시 현재 폼이 dirty 면 먼저 보관한 뒤 대상 슬롯(초안 우선, 없으면 게시본)을
 *   로드 — dirty 내용을 조용히 버리거나 덮지 않는다.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Notice } from "@/types";
import {
  clearDraft,
  fingerprint,
  loadDraft,
  saveDraft,
  useScopedSessionDraft,
} from "./useScopedDraft";

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

const NEW_SLOT = "notice:__new__";
const LAST_SLOT = "notice:__last__";
const slotFor = (id: string): string => (id ? `notice:${id}` : NEW_SLOT);

const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-red-300 focus:outline-none";

/** 발행 버튼 — UpdatesManager 일괄 버튼과 같은 compact production 클래스. */
const publishCls =
  "shrink-0 rounded-full bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400";

function sessionStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export default function NoticeManager({
  initialNotices,
  scopeEmail,
}: {
  initialNotices: Notice[];
  scopeEmail: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [justPublished, setJustPublished] = useState(false);
  const [conflict, setConflict] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  // 게시본 스냅샷 — prop 갱신돼도 폼을 덮지 않는다 (dirty 보존).
  const publishedById = useMemo(
    () => new Map(initialNotices.map((n) => [n.id, n])),
    [initialNotices],
  );
  const published = form.id ? publishedById.get(form.id) ?? null : null;
  const publishedRev = fingerprint(published);
  const formRev = fingerprint(form);
  const isNewEmpty =
    !form.id &&
    !form.title.trim() &&
    !form.bodyMd.trim() &&
    !form.start &&
    !form.end &&
    !form.pinned;
  const dirty = form.id ? formRev !== publishedRev : !isNewEmpty;

  const slot = slotFor(form.id);

  // 자동보관 — sessionStorage 에만, dirty 일 때만.
  const { draftSaved, storageOk } = useScopedSessionDraft(scopeEmail, slot, form, {
    baseRev: publishedRev,
    enabled: dirty,
  });

  // 마운트 복원 1회 — 마지막 편집 슬롯 우선, 없으면 새 공지 슬롯. fetch 없음.
  useEffect(() => {
    const store = sessionStore();
    if (!store) return;
    const last = loadDraft<string>(store, scopeEmail, LAST_SLOT);
    const candidates =
      last && typeof last.value === "string" && last.value !== NEW_SLOT
        ? [last.value, NEW_SLOT]
        : [NEW_SLOT];
    for (const s of candidates) {
      const d = loadDraft<Form>(store, scopeEmail, s);
      if (d && d.value && typeof d.value === "object") {
        setForm({ ...EMPTY, ...d.value });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 버전 충돌 판정 — 보관 당시 게시본(base)과 현재 게시본이 다르고, 현재 입력도
  // 게시본과 다르면 경고. 백엔드 변경 없이 클라 비교만.
  useEffect(() => {
    const store = sessionStore();
    if (!store) {
      setConflict(false);
      return;
    }
    const d = loadDraft<Form>(store, scopeEmail, slot);
    setConflict(!!d && !!d.base && d.base !== publishedRev && formRev !== publishedRev);
  }, [scopeEmail, slot, publishedRev, formRev]);

  function preserveCurrent(): void {
    if (!dirty) return;
    const store = sessionStore();
    if (!store) return;
    saveDraft(store, scopeEmail, slot, formRef.current, publishedRev);
  }

  function rememberSlot(s: string): void {
    const store = sessionStore();
    if (!store) return;
    saveDraft(store, scopeEmail, LAST_SLOT, s, "");
  }

  function openForm(next: Form, nextSlot: string): void {
    const store = sessionStore();
    if (store) {
      const d = loadDraft<Form>(store, scopeEmail, nextSlot);
      if (d && d.value && typeof d.value === "object") {
        setForm({ ...EMPTY, ...d.value });
        setMsg("보관된 초안을 불러왔어요.");
        setJustPublished(false);
        rememberSlot(nextSlot);
        return;
      }
    }
    setForm(next);
    setMsg("");
    setJustPublished(false);
    rememberSlot(nextSlot);
  }

  function loadNotice(n: Notice) {
    if (formRef.current.id === n.id) return;
    preserveCurrent(); // 전환 전 현재 dirty 보관 — 조용히 버리지 않음
    openForm({ ...EMPTY, ...n }, slotFor(n.id));
  }

  function newNotice() {
    if (!formRef.current.id && isNewEmpty) return;
    preserveCurrent();
    openForm(EMPTY, NEW_SLOT);
  }

  function update(p: Partial<Form>) {
    setForm((f) => ({ ...f, ...p }));
    setJustPublished(false);
  }

  async function publish() {
    const payload = { ...formRef.current };
    if (!payload.title.trim()) {
      setMsg("제목을 입력해 주세요.");
      return;
    }
    const sentSlot = slotFor(payload.id);
    const sentRev = fingerprint(payload);
    const sentBase = fingerprint(
      payload.id ? publishedById.get(payload.id) ?? null : null,
    );
    setBusy(true);
    setMsg("게시 중…");
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
      if (!res.ok) throw new Error(data.error ?? `게시 ${res.status}`);
      const store = sessionStore();
      const currentRev = fingerprint(formRef.current);
      if (currentRev === sentRev) {
        // 이어쓰기 없음 — ACK된 리비전의 초안만 삭제, 게시본으로 교체.
        if (store) clearDraft(store, scopeEmail, sentSlot);
        setForm({ ...EMPTY, ...data.notice });
        setJustPublished(true);
        setMsg("게시됨. 수강생 팝업에 바로 반영돼요.");
      } else {
        // 저장 중 이어쓴 내용 보존 — 폼을 서버값으로 덮지 않고 초안으로 유지.
        if (store) saveDraft(store, scopeEmail, sentSlot, formRef.current, sentBase);
        setJustPublished(false);
        setMsg("게시됨 — 이어쓰던 내용은 초안으로 보관했어요.");
      }
      router.refresh();
    } catch (e) {
      // 실패는 초안 보존 — 복원 가능한 입력이 사라지지 않는다.
      setMsg(`게시 실패: ${e instanceof Error ? e.message : "unknown"} — 초안은 보관돼 있어요.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-black text-gray-900">공지 작성/수정</h2>
        {/* truthful 상태 — 보관 성공시에만 '초안 보관됨', ACK 직후 '게시됨'. */}
        {justPublished && !dirty ? (
          <span className="text-[11px] font-bold text-green-600">게시됨</span>
        ) : dirty && draftSaved ? (
          <span className="text-[11px] font-bold text-amber-600">초안 보관됨</span>
        ) : dirty && !storageOk ? (
          <span className="text-[11px] font-bold text-red-500">
            초안 보관 안 됨 — 창을 닫으면 입력이 사라져요
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className={publishCls}
          >
            {busy ? "게시 중…" : form.id ? "게시 반영" : "게시"}
          </button>
          <button
            type="button"
            onClick={newNotice}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            + 새 공지
          </button>
        </div>
      </div>
      {conflict && (
        <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
          게시본이 보관 이후 바뀌었어요. 게시 전 내용을 확인해 주세요.
        </p>
      )}

      {/* 기존 공지 목록 */}
      {initialNotices.length > 0 && (
        <ul className="mb-4 divide-y divide-gray-50 rounded-xl border border-gray-100">
          {initialNotices.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => loadNotice(n)}
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
          onChange={(e) => update({ title: e.target.value })}
        />

        {/* 리치 에디터 (WYSIWYG) — 굵게·밑줄·색·형광펜·목록·링크·이미지. 출력=HTML. */}
        <RichNoticeEditor value={form.bodyMd} onChange={(html) => update({ bodyMd: html })} />

        {/* 노출 옵션 */}
        <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
          <label className="text-xs font-semibold text-gray-500">
            대상
            <select
              className={inputCls}
              value={form.audience}
              onChange={(e) => update({ audience: e.target.value })}
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
              onChange={(e) => update({ displayMode: e.target.value })}
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
              onChange={(e) => update({ start: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-gray-500">
            종료일 (빈값 = 무제한)
            <input
              type="date"
              className={inputCls}
              value={form.end}
              onChange={(e) => update({ end: e.target.value })}
            />
          </label>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => update({ pinned: e.target.checked })}
            />
            📌 상단 고정
          </label>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update({ active: e.target.checked })}
            />
            활성 (체크 해제 = 노출 중단)
          </label>
        </div>

        {msg && <p className="text-xs font-semibold text-gray-500">{msg}</p>}
      </div>
    </section>
  );
}
