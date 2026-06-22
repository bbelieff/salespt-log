/**
 * BannerPostingLog — 현수막 주문(P:V) 1건의 게시 로그(AF:AI, 1:N). ADR-0023.
 * 주문ref(= 주문일|업체명)로 게시 행을 묶어 표시 + 게시(게시일·게시수) 추가/삭제.
 * 남은 = 주문장수 − Σ게시수. 생산(E)는 게시일 기준으로 서버가 자동 집계.
 */
"use client";

import { useState } from "react";
import { useDBOverview, useAppendBannerPost, useRemoveBannerPost } from "@/query/db-hooks";

interface Props {
  order: Record<string, unknown>; // 현수막 주문 행 (날짜·업체명·주문개수)
}

const str = (r: Record<string, unknown>, k: string) => String(r[k] ?? "");
const n = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0) || 0;

export default function BannerPostingLog({ order }: Props) {
  const overview = useDBOverview();
  const append = useAppendBannerPost();
  const remove = useRemoveBannerPost();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState("");

  const 주문ref = `${str(order, "날짜")}|${str(order, "업체명")}`;
  const 주문장수 = n(order, "주문개수");
  const posts = (overview.data?.bannerPosts ?? []).filter((p) => p.주문ref === 주문ref);
  const 게시누적 = posts.reduce((s, p) => s + (p.게시수 || 0), 0);
  const 남은 = 주문장수 - 게시누적;

  const pending = append.isPending || remove.isPending;
  const canAdd = count > 0 && !!date && !pending;
  const over = count > 남은;

  const fail = (e: unknown) =>
    setErr(e instanceof Error ? e.message : "저장에 실패했어요. 다시 시도해주세요.");

  const onAdd = () => {
    if (!canAdd) return;
    setErr("");
    append.mutate(
      { 게시id: "", 주문ref, 게시일: date, 게시수: count },
      { onSuccess: () => setCount(0), onError: fail },
    );
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-800">게시 기록</span>
        <span className="text-xs font-medium text-amber-700">
          남은 {남은}장 <span className="text-amber-400">/ 주문 {주문장수}장</span>
        </span>
      </div>

      {posts.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {posts.map((p) => (
            <li
              key={p.row}
              className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs"
            >
              <span className="text-gray-700">
                {p.게시일} · <b className="text-amber-700">{p.게시수}장</b> 게시
              </span>
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  remove.mutate(p.row, { onError: fail });
                }}
                disabled={pending}
                aria-label="게시 삭제"
                className="text-gray-300 hover:text-red-500 disabled:opacity-40"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-amber-600">아직 게시 기록이 없어요. 게시한 날·수량을 추가하세요.</p>
      )}

      {남은 > 0 ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 appearance-none rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={count === 0 ? "" : String(count)}
            placeholder="게시수"
            onChange={(e) => setCount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
            className="w-20 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm focus:border-amber-500 focus:outline-none num-mono"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-gray-300"
          >
            게시
          </button>
        </div>
      ) : (
        <p className="text-xs font-medium text-amber-700">주문 수량을 모두 게시했어요 ✓</p>
      )}
      {over && (
        <p className="mt-1 text-xs text-red-500">남은 수량({남은}장)보다 많아요 — 확인 후 추가됩니다.</p>
      )}
      {err && <p className="mt-1 text-xs text-red-500">⚠ {err}</p>}
    </div>
  );
}
