/**
 * RowCard — 데이터 행 카드 (접힘/펼침).
 * 정본: db-management.html v11 `renderRow` + `makeRowSummary`
 *
 * 접힘: row-num + title + sub + 우측(가격 또는 배지) + ›
 * 펼침: row-num + 채널 badge + × close + RowForm + 삭제/저장
 */
"use client";

import { useId, useRef, useState } from "react";
import type { ChannelKey, ChannelMeta } from "../_lib/channels";
import { fmtWon, mdShort } from "../_lib/channels";
import RowForm from "./RowForm";
import { useDirtyEntry } from "@/components/DirtyGuard";

interface Props {
  channelKey: ChannelKey;
  channel: ChannelMeta;
  index: number; // 0-based, 화면 표시는 +1
  row: Record<string, unknown>;
  expanded: boolean;
  pending: boolean;
  badgeCls: string; // "badge-purchase" 등
  onExpand: () => void;
  onCollapse: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onDeleteRequest: () => void;
}

const ch = (r: Record<string, unknown>, k: string): string =>
  String(r[k] ?? "");
const num = (r: Record<string, unknown>, k: string): number =>
  Number(r[k] ?? 0) || 0;

function makeSummary(channelKey: ChannelKey, row: Record<string, unknown>) {
  switch (channelKey) {
    case "purchase": {
      const cost = num(row, "개당단가") * num(row, "주문개수");
      return {
        title: ch(row, "업체명") || "(이름 없음)",
        sub: `${mdShort(ch(row, "구매일")) || "-"} · ${fmtWon(num(row, "개당단가"))}원 × ${num(row, "주문개수")}건`,
        right: `₩${fmtWon(cost)}`,
        rightBadge: null as string | null,
      };
    }
    case "direct": {
      const done = num(row, "생산개수") > 0;
      const start = mdShort(ch(row, "시작일"));
      const end = mdShort(ch(row, "종료일"));
      const period = start && end && start !== end ? `${start}~${end}` : start || "-";
      return {
        title: ch(row, "소재") || "(소재 없음)",
        sub: `${period} · ${done ? `${num(row, "생산개수")}건 완료` : "생산중"}`,
        right: `₩${fmtWon(num(row, "기간예산"))}`,
        rightBadge: done ? null : "생산중",
      };
    }
    case "banner": {
      const cost = num(row, "개당단가") * num(row, "주문개수");
      return {
        title: ch(row, "업체명") || "(이름 없음)",
        sub: `${mdShort(ch(row, "날짜")) || "-"} 발주 · ${mdShort(ch(row, "도착일")) || "-"} 도착 · ${num(row, "주문개수")}장`,
        right: `₩${fmtWon(cost)}`,
        rightBadge: null,
      };
    }
    case "referral":
      return {
        title: `${ch(row, "대표자명") || "-"} · ${ch(row, "업체명") || "-"}`,
        sub: `${mdShort(ch(row, "접수일")) || "-"} · ${ch(row, "소개처")}${ch(row, "조건") ? " · " + ch(row, "조건") : ""}`,
        right: null as string | null,
        rightBadge: ch(row, "구분") || null,
      };
  }
}

export default function RowCard({
  channelKey,
  channel,
  index,
  row,
  expanded,
  pending,
  badgeCls,
  onExpand,
  onCollapse,
  onSave,
  onDeleteRequest,
}: Props) {
  const [draft, setDraft] = useState<Record<string, unknown>>(row);
  // 미저장 이탈 가드. RowForm 은 mount 시 수식필드(개당단가 등) onChange 를 1회 발화하므로
  // row 와의 단순 비교는 거짓 dirty. 그 첫 onChange 값을 "깨끗한 기준선"으로 박아두고
  // 이후 사용자 입력으로 기준선과 달라질 때만 dirty (→ 거짓양성 0). 접어도 draft·ref 보존돼 가드 유지.
  const baselineRef = useRef<string | null>(null);
  const onDraftChange = (next: Record<string, unknown>) => {
    setDraft(next);
    if (baselineRef.current === null) baselineRef.current = JSON.stringify(next);
  };
  const entryId = useId();
  useDirtyEntry(
    entryId,
    baselineRef.current !== null && JSON.stringify(draft) !== baselineRef.current,
    () => onSave(draft),
    () => { if (baselineRef.current) setDraft(JSON.parse(baselineRef.current)); },
    `${channel.name} ${index + 1}행`,
  );
  const displayNum = String(index + 1).padStart(2, "0");

  if (!expanded) {
    const s = makeSummary(channelKey, row);
    const rightCls = channel.isCost ? "text-red-600" : "text-gray-900";
    return (
      <div
        className="row-card flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-3 transition-all hover:border-slate-300"
        onClick={onExpand}
      >
        <span className="row-num shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold tracking-wider text-slate-600 num-mono">
          {displayNum}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">
            {s.title}
          </div>
          <div className="mt-0.5 line-clamp-2 break-keep text-xs text-gray-500">{s.sub}</div>
        </div>
        {s.right && (
          <div
            className={`shrink-0 num-mono text-sm font-bold ${rightCls}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {s.right}
          </div>
        )}
        {s.rightBadge && (
          <span className={`badge ${badgeCls} shrink-0`}>{s.rightBadge}</span>
        )}
        <span className="shrink-0 text-lg leading-none text-gray-300">›</span>
      </div>
    );
  }

  // 펼침
  return (
    <div className="row-card expanded rounded-xl border border-blue-300 bg-white p-3 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold tracking-wider text-slate-600 num-mono">
            {displayNum}
          </span>
          <span className={`badge ${badgeCls}`}>{channel.name}</span>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="접기"
          className="h-8 w-8 text-xl leading-none text-gray-400 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      {/* 현수막 게시로그(AF:AI) 폐기 — 게시=생산은 컨택 게시 스테퍼가 소유(ADR-0025). */}
      {/* initial=draft(=row 사본+편집): 접었다 다시 펼쳐도 RowForm 이 편집값으로 재마운트(되돌림 방지). */}
      <RowForm channel={channel} initial={draft} onChange={onDraftChange} />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDeleteRequest}
          disabled={pending}
          className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          🗑 삭제
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={pending}
          className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300"
        >
          {pending ? "저장중..." : "💾 저장"}
        </button>
      </div>
    </div>
  );
}
