/**
 * /updates — 업데이트 보관함 (announcement-popup §7-4).
 *
 * updates 탭 전체(visible) 최신순 누적: 항목 형식은 팝업과 동일(UpdateAccordion),
 * 월별 구분선 + [더 보기] 페이징(항목 단위). 새 배포가 쌓이면 자동 누적.
 * 헤더 "새소식" 진입점이 여기로 연결된다.
 */
"use client";

import { useEffect, useState } from "react";
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import UpdateAccordion from "@/components/announcements/UpdateAccordion";
import type { UpdateItem } from "@/types";

const PAGE = 15;

/** ISO → "YYYY년 M월" (월 구분선). */
function monthLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}년 ${Number(m[2])}월` : "";
}

export default function UpdatesArchivePage() {
  const [rows, setRows] = useState<UpdateItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore(nextOffset: number) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/announcements/archive?offset=${nextOffset}&limit=${PAGE}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `${res.status}`);
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.pr));
        return [...prev, ...(d.rows as UpdateItem[]).filter((r) => !seen.has(r.pr))];
      });
      setTotal(d.totalItems);
      setOffset(nextOffset + PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadMore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 월별 구분 — 항목(그룹) 단위 렌더를 위해 행을 월로 쪼개 UpdateAccordion 에 전달.
  // 그룹은 같은 월(마지막 머지일 기준)에 묶이는 것이 일반적 — 월 경계는 대표 행 기준.
  const byMonth: { label: string; rows: UpdateItem[] }[] = [];
  for (const r of rows) {
    const label = monthLabel(r.date);
    const last = byMonth[byMonth.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else byMonth.push({ label, rows: [r] });
  }
  const hasMore = total !== null && offset < total;

  return (
    <>
      <TopHeader pageEmoji="✨" pageTitle="새소식 보관함" pageSubtitle="업데이트 모아보기" />
      <main className="px-4 pt-3">
        <PageContainer width="narrow">
          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {byMonth.map((m) => (
            <section key={m.label} className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-black text-gray-400">{m.label}</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <UpdateAccordion updates={m.rows} />
            </section>
          ))}
          {rows.length === 0 && !loading && !error && (
            <p className="py-8 text-center text-sm text-gray-400">아직 업데이트가 없어요.</p>
          )}
          {hasMore && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadMore(offset)}
              className="mb-6 h-11 w-full rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "불러오는 중…" : "더 보기"}
            </button>
          )}
        </PageContainer>
      </main>
    </>
  );
}
