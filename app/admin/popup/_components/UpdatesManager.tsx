/**
 * UpdatesManager — 자동 수집 업데이트 현황 (announcement-popup §4 하단).
 *
 * Scope D (bounded autosave draft UX):
 * - 인라인 편집분은 sessionStorage(인증 admin 이메일 키잉, 단일 `updates:drafts`
 *   슬롯 — { pr: { value, base, rev } } 오버레이)에만 자동 보관. 새로고침해도 복원.
 * - 서버 전송은 상단 단일 [게시 반영 (N)] 버튼에서만 (PATCH /api/admin/announcements).
 *   마운트·복원·타이머는 fetch 하지 않는다.
 * - 초안 삭제는 행별 ACK 리비전과 현재 입력이 일치할 때만. 게시 중 이어쓰기·
 *   늦은 응답이 타이핑을 덮어쓰지 않고, 실패분 초안은 그대로 보관된다.
 * - 보관 당시 게시본(base)과 현재 게시본이 다르면 행에 충돌 표시 (백엔드 변경 없음).
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UpdateItem } from "@/types";
import {
  fingerprint,
  loadDraft,
  saveDraft,
  useScopedSessionDraft,
} from "./useScopedDraft";

const SLOT = "updates:drafts";

interface DraftEntry {
  value: UpdateItem;
  base: string;
  rev: string;
}
interface Overlay {
  entries: Record<string, DraftEntry>;
}

function sessionStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export default function UpdatesManager({
  initialUpdates,
  scopeEmail,
}: {
  initialUpdates: UpdateItem[];
  scopeEmail: string;
}) {
  const [rows, setRows] = useState(initialUpdates);
  // 게시 기준선 — dirty 판정·충돌 비교용. prop 갱신돼도 편집 중 행을 덮지 않는다.
  const [baseline, setBaseline] = useState(
    () => new Map(initialUpdates.map((u) => [u.pr, u])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [justPublished, setJustPublished] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const edit = (pr: number, p: Partial<UpdateItem>) => {
    setRows((rs) => rs.map((r) => (r.pr === pr ? { ...r, ...p } : r)));
    setJustPublished(false);
  };

  const isDirty = (r: UpdateItem): boolean => {
    const o = baseline.get(r.pr);
    return (
      !o ||
      o.titleUser !== r.titleUser ||
      o.milestone !== r.milestone ||
      o.visible !== r.visible ||
      o.anchor !== r.anchor
    );
  };
  const dirtyRows = rows.filter(isDirty);

  // 마운트 복원 1회 — 보관 오버레이를 현재 행에 덧씌운다. fetch 없음.
  // prop 행 자체는 건드리지 않고, 보관값이 게시본과 다를 때만 적용한다.
  useEffect(() => {
    const store = sessionStore();
    if (!store) return;
    const d = loadDraft<Overlay>(store, scopeEmail, SLOT);
    const entries = d?.value?.entries;
    if (!entries) return;
    setRows((prev) =>
      prev.map((r) => {
        const e = entries[String(r.pr)];
        if (!e || !e.value || typeof e.value !== "object") return r;
        if (e.value.pr !== r.pr) return r;
        if (fingerprint(e.value) === fingerprint(r)) return r;
        return { ...r, ...e.value, pr: r.pr };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자동보관용 오버레이 — dirty 행만 { value, base(당시 게시본 지문) } 로.
  const overlay: Overlay = useMemo(
    () => ({
      entries: Object.fromEntries(
        dirtyRows.map((r) => {
          const base = fingerprint(baseline.get(r.pr) ?? null);
          return [String(r.pr), { value: r, base, rev: fingerprint(r) }];
        }),
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, baseline],
  );
  const { draftSaved, storageOk } = useScopedSessionDraft(scopeEmail, SLOT, overlay);

  // 버전 충돌 — 보관 당시 base 와 현재 게시본이 다르고, 현재 입력도 게시본과 다름.
  // store 읽기는 effect 에서 (하이드레이션 mismatch 방지).
  const [conflictPrs, setConflictPrs] = useState<Set<number>>(new Set());
  useEffect(() => {
    const store = sessionStore();
    if (!store) {
      setConflictPrs(new Set());
      return;
    }
    const d = loadDraft<Overlay>(store, scopeEmail, SLOT);
    const entries = d?.value?.entries;
    if (!entries) {
      setConflictPrs(new Set());
      return;
    }
    const out = new Set<number>();
    for (const r of rowsRef.current) {
      const e = entries[String(r.pr)];
      if (!e) continue;
      const publishedRev = fingerprint(baseline.get(r.pr) ?? null);
      if (e.base && e.base !== publishedRev && fingerprint(r) !== publishedRev) {
        out.add(r.pr);
      }
    }
    setConflictPrs(out);
  }, [rows, baseline, scopeEmail]);

  async function publishAll() {
    if (!dirtyRows.length || busy) return;
    const sent = new Map(
      dirtyRows.map((r) => [r.pr, { row: r, rev: fingerprint(r) }]),
    );
    const prs = [...sent.keys()];
    setBusy(true);
    setMsg("");
    setJustPublished(false);
    try {
      const results = await Promise.allSettled(
        prs.map(async (pr) => {
          const row = sent.get(pr)!.row;
          const res = await fetch("/api/admin/announcements", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pr: row.pr,
              titleUser: row.titleUser,
              milestone: row.milestone,
              visible: row.visible,
              anchor: row.anchor,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `#${row.pr} 게시 ${res.status}`);
          }
        }),
      );
      let ok = 0;
      const okPrs: number[] = [];
      results.forEach((res, i) => {
        const pr = prs[i];
        if (res.status === "fulfilled" && pr !== undefined) {
          ok += 1;
          okPrs.push(pr);
        }
      });
      const fail = prs.length - ok;
      const store = sessionStore();

      // 게시 기준선은 ACK된 행만 전송값으로 갱신 (실패분은 이전 게시본 유지).
      setBaseline((prev) => {
        const next = new Map(prev);
        for (const pr of okPrs) next.set(pr, sent.get(pr)!.row);
        return next;
      });

      // 초안 정리는 ACK 리비전==현재 입력일 때만. 이어쓰기분은 새 게시본 기준으로 보관.
      if (store) {
        const env = loadDraft<Overlay>(store, scopeEmail, SLOT);
        const entries = { ...(env?.value?.entries ?? {}) };
        for (const pr of okPrs) {
          const sentRev = sent.get(pr)!.rev;
          const cur = rowsRef.current.find((r) => r.pr === pr);
          const curRev = cur ? fingerprint(cur) : null;
          if (curRev === sentRev) {
            delete entries[String(pr)];
          } else if (cur && curRev) {
            entries[String(pr)] = { value: cur, base: sentRev, rev: curRev };
          }
        }
        saveDraft(store, scopeEmail, SLOT, { entries }, "");
      }

      if (fail === 0) {
        setJustPublished(true);
        setMsg(`${ok}건 게시 반영했어요.`);
      } else {
        setMsg(
          `${ok}건 게시 반영, ${fail}건 실패 — 실패분 초안은 보관돼 있어요. 다시 시도해 주세요.`,
        );
      }
    } catch (e) {
      // allSettled 위이므로 여기 도달은 예외적 — 그래도 초안은 건드리지 않는다.
      setMsg(`게시 실패: ${e instanceof Error ? e.message : "unknown"} — 초안은 보관돼 있어요.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-gray-900">업데이트 현황</h2>
        <div className="flex shrink-0 items-center gap-2">
          {/* truthful 상태 — 보관 성공시에만, 게시 ACK 후 dirty 0이면 게시됨. */}
          {justPublished && dirtyRows.length === 0 ? (
            <span className="text-[11px] font-bold text-green-600">게시됨</span>
          ) : dirtyRows.length > 0 && draftSaved ? (
            <span className="text-[11px] font-bold text-amber-600">
              초안 {dirtyRows.length}건 보관됨
            </span>
          ) : dirtyRows.length > 0 && !storageOk ? (
            <span className="text-[11px] font-bold text-red-500">초안 보관 안 됨</span>
          ) : null}
          <button
            type="button"
            disabled={dirtyRows.length === 0 || busy}
            onClick={() => void publishAll()}
            className="shrink-0 rounded-full bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy ? "게시 반영 중…" : `게시 반영 (${dirtyRows.length})`}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        배포할 때마다 자동으로 쌓여요. 문구를 수강생이 읽기 쉽게 다듬고, 보여줄지 정하세요.
      </p>
      {conflictPrs.size > 0 && (
        <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
          {conflictPrs.size}건이 보관 이후 바뀐 게시본과 달라요. 게시 전 내용을 확인해 주세요.
        </p>
      )}

      {/* 열 헤더 — 데스크탑(pc:)만. 모바일은 카드 자체 라벨이라 헤더 불필요.
          순서는 본문 데스크탑 컬럼(유형·#·날짜·내용·마일스톤·노출)과 1:1. */}
      {rows.length > 0 && (
        <div className="hidden items-center gap-2 border-b border-gray-100 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 pc:flex">
          <span className="w-10 shrink-0">유형</span>
          <span className="w-10 shrink-0">#</span>
          <span className="w-16 shrink-0">날짜</span>
          <span className="min-w-0 flex-1">내용</span>
          <span className="w-28 shrink-0">마일스톤</span>
          <span className="w-28 shrink-0">앵커</span>
          <span className="w-24 shrink-0 text-center">노출</span>
        </div>
      )}

      <ul className="space-y-1">
        {rows.map((u) => {
          const dirty = isDirty(u);
          return (
            <li
              key={u.pr}
              className={`flex flex-col gap-2 rounded-lg border-l-4 py-2 pl-2 pr-2 pc:flex-row pc:items-center pc:gap-2 ${
                dirty ? "border-yellow-400 bg-yellow-50" : "border-transparent"
              }`}
            >
              {/* 메타줄 — 모바일: [유형·#·날짜](좌) ↔ [노출](우) 한 줄.
                  데스크탑: pc:contents 로 펼쳐 각 컬럼이 li 의 직접 flex 자식이 됨. */}
              <div className="flex items-center justify-between gap-2 pc:contents">
                <div className="flex items-center gap-2 pc:contents">
                  <span
                    className={`shrink-0 rounded-full px-1 py-0.5 text-center text-[10px] font-bold pc:w-10 ${
                      u.type === "feat" || u.type === "fix"
                        ? "bg-red-50 text-brand-red"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {u.type || "-"}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-gray-400 pc:w-10">
                    #{u.pr}
                  </span>
                  <span className="shrink-0 truncate text-xs text-gray-400 pc:w-16">
                    {u.date}
                  </span>
                </div>
                {/* 노출 라벨 + 표준 스위치 — 모바일 우측, 데스크탑 끝 컬럼(pc:order-last, w-24). */}
                <div className="flex shrink-0 items-center justify-end gap-2 pc:order-last pc:w-24">
                  <span
                    className={`w-7 text-right text-[11px] font-bold ${
                      u.visible ? "text-brand-red" : "text-gray-400"
                    }`}
                  >
                    {u.visible ? "노출" : "숨김"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={u.visible}
                    aria-label="노출 여부"
                    title={u.visible ? "노출 중 (눌러서 숨김)" : "숨김 (눌러서 노출)"}
                    onClick={() => edit(u.pr, { visible: !u.visible })}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                      u.visible ? "bg-brand-red" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        u.visible ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 제목 — 모바일 w-full, 데스크탑 flex-1(긴 제목이 우측 안 밂). */}
              <input
                className="h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-900 focus:border-red-300 focus:outline-none pc:min-w-0 pc:flex-1"
                value={u.titleUser}
                onChange={(e) => edit(u.pr, { titleUser: e.target.value })}
                placeholder="수강생이 읽는 한 줄"
              />
              {/* 마일스톤 — 모바일 w-full, 데스크탑 w-28 고정. */}
              <input
                className="h-9 w-full rounded-lg border border-gray-200 px-2 text-xs text-gray-700 placeholder:text-gray-300 focus:border-red-300 focus:outline-none pc:w-28 pc:shrink-0"
                value={u.milestone}
                onChange={(e) => edit(u.pr, { milestone: e.target.value })}
                placeholder="마일스톤 (선택)"
              />
              {/* 앵커 키 — 앱 내 NEW 위치 (lib/config/anchors.ts 등록 키만 유효). */}
              <input
                className="h-9 w-full rounded-lg border border-gray-200 px-2 text-xs text-gray-700 placeholder:text-gray-300 focus:border-red-300 focus:outline-none pc:w-28 pc:shrink-0"
                value={u.anchor}
                onChange={(e) => edit(u.pr, { anchor: e.target.value })}
                placeholder="앵커 키 (선택)"
              />
              {conflictPrs.has(u.pr) && (
                <span className="shrink-0 text-[11px] font-bold text-amber-600">
                  ⚠ 새 게시본 있음
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          아직 수집된 업데이트가 없어요. 다음 배포부터 자동으로 쌓여요.
        </p>
      )}
      {msg && <p className="mt-2 text-xs font-semibold text-gray-500">{msg}</p>}
    </section>
  );
}
