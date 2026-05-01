/**
 * RowList — 행 리스트 (loading/error/empty/rows).
 */
"use client";

import type { ChannelKey, ChannelMeta } from "../_lib/channels";
import RowCard from "./RowCard";

type BackendRow = { row: number } & Record<string, unknown>;

interface Props {
  loading: boolean;
  error: unknown;
  rows: BackendRow[];
  ch: ChannelMeta;
  chKey: ChannelKey;
  expandedRow: number | null;
  pendingRow: number | "add" | null;
  badgeCls: string;
  onExpand: (rowNum: number) => void;
  onCollapse: () => void;
  onSave: (rowNum: number, data: Record<string, unknown>) => void;
  onDeleteRequest: (row: BackendRow) => void;
}

export default function RowList({
  loading,
  error,
  rows,
  ch,
  chKey,
  expandedRow,
  pendingRow,
  badgeCls,
  onExpand,
  onCollapse,
  onSave,
  onDeleteRequest,
}: Props) {
  if (loading) {
    return <div className="text-sm text-slate-500">불러오는 중…</div>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        ⚠ 불러오기 실패: {(error as Error).message}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        아직 {ch.recordsLabel}이 없습니다
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <RowCard
          key={r.row}
          channelKey={chKey}
          channel={ch}
          index={i}
          row={r}
          expanded={expandedRow === r.row}
          pending={pendingRow === r.row}
          badgeCls={badgeCls}
          onExpand={() => onExpand(r.row)}
          onCollapse={onCollapse}
          onSave={(data) => onSave(r.row, data)}
          onDeleteRequest={() => onDeleteRequest(r)}
        />
      ))}
    </div>
  );
}
