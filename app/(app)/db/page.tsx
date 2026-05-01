/**
 * DB관리 탭 (PR 09 db-management).
 * 정본: docs/design/prototypes/db-management.html v11 (픽셀 매칭 React 포팅).
 *
 * 시트: 03 DB관리 — 4채널 raw log (매입DB / 직접생산 / 현수막 / 콜·지·기·소).
 * 메인 목표: 채널별 총비용·평균단가 한눈에. 합계는 시트 수식이 자동 계산.
 *
 * SSOT: docs/domains/sheet-structure.md §5
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAppendDB,
  useDBOverview,
  usePatchDB,
  useRemoveDB,
} from "@/query/db-hooks";
import {
  CHANNELS,
  CHANNEL_KEYS,
  KEY_TO_BACKEND,
  summarizeCost,
  type ChannelKey,
} from "./_lib/channels";
import OverallCard from "./_components/OverallCard";
import ChannelTabs from "./_components/ChannelTabs";
import { CostSummary, LeadSummary } from "./_components/SummaryCard";
import RowList from "./_components/RowList";
import RowForm from "./_components/RowForm";
import ConfirmModal from "./_components/ConfirmModal";

type BackendRow = { row: number } & Record<string, unknown>;

const BADGE_CLS: Record<ChannelKey, string> = {
  purchase: "badge-purchase",
  direct: "badge-direct",
  banner: "badge-banner",
  referral: "badge-referral",
};

const CHANNEL_ROWS_KEY: Record<ChannelKey, string> = {
  purchase: "purchases",
  direct: "productions",
  banner: "banners",
  referral: "leads",
};

interface ConfirmTarget {
  rowNum: number;
  label: string;
}

export default function DbPage() {
  const [activeCh, setActiveCh] = useState<ChannelKey>("purchase");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<Record<string, unknown>>({});
  const [pendingRow, setPendingRow] = useState<number | "add" | null>(null);
  const [toast, setToast] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const overview = useDBOverview();
  const append = useAppendDB();
  const patch = usePatchDB();
  const remove = useRemoveDB();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  const switchChannel = (k: ChannelKey) => {
    setActiveCh(k);
    setExpandedRow(null);
    setAddOpen(false);
  };

  const rowsByChannel = useMemo(() => {
    const empty: Record<ChannelKey, BackendRow[]> = {
      purchase: [],
      direct: [],
      banner: [],
      referral: [],
    };
    if (!overview.data) return empty;
    const data = overview.data as unknown as Record<string, BackendRow[]>;
    return {
      purchase: data[CHANNEL_ROWS_KEY.purchase] ?? [],
      direct: data[CHANNEL_ROWS_KEY.direct] ?? [],
      banner: data[CHANNEL_ROWS_KEY.banner] ?? [],
      referral: data[CHANNEL_ROWS_KEY.referral] ?? [],
    };
  }, [overview.data]);

  const ch = CHANNELS[activeCh];
  const rows = rowsByChannel[activeCh];

  const handleSave = async (rowNum: number, data: Record<string, unknown>) => {
    setPendingRow(rowNum);
    try {
      await patch.mutateAsync({
        channel: KEY_TO_BACKEND[activeCh],
        row: rowNum,
        data: data as never,
      });
      setExpandedRow(null);
      showToast("저장되었습니다 📌");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const handleAdd = async () => {
    setPendingRow("add");
    try {
      await append.mutateAsync({
        channel: KEY_TO_BACKEND[activeCh],
        data: addDraft as never,
      });
      setAddOpen(false);
      showToast(`${ch.recordsLabel}이 추가되었습니다 ✨`);
    } catch (e) {
      showToast(`추가 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setPendingRow(target.rowNum);
    try {
      await remove.mutateAsync({
        channel: KEY_TO_BACKEND[activeCh],
        row: target.rowNum,
      });
      setExpandedRow(null);
      showToast("삭제되었습니다 🗑");
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const requestDelete = (row: BackendRow) => {
    const label =
      String(row["업체명"] ?? "") ||
      String(row["소재"] ?? "") ||
      String(row["대표자명"] ?? "") ||
      `시트 row ${row.row}`;
    setConfirmTarget({ rowNum: row.row, label });
  };

  const overall = useMemo(() => {
    const items = CHANNEL_KEYS.map((k) => {
      const meta = CHANNELS[k];
      const rs = rowsByChannel[k];
      if (meta.isCost) {
        const s = summarizeCost(k, rs);
        return {
          key: k,
          name: meta.name,
          color: meta.color,
          count: s.totalCount,
          unit: s.unitLabel,
          cost: s.totalCost,
          isCost: true as const,
        };
      }
      return {
        key: k,
        name: meta.name,
        color: meta.color,
        count: rs.length,
        unit: "건",
        cost: null as number | null,
        isCost: false as const,
      };
    });
    const totalCost = items.reduce((s, it) => s + (it.cost ?? 0), 0);
    const totalCount = items.reduce((s, it) => s + it.count, 0);
    return { items, totalCost, totalCount };
  }, [rowsByChannel]);

  const summary = useMemo(() => {
    if (ch.isCost) return summarizeCost(activeCh, rows);
    return null;
  }, [activeCh, rows, ch.isCost]);

  useEffect(() => {
    if (!addOpen) setAddDraft({});
  }, [addOpen]);

  return (
    <>
      {/* 슬림 브랜드 바 */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-gray-100 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded text-base font-bold text-red-600">
            $
          </div>
          <span className="text-sm font-semibold text-gray-900">
            세일즈PT 경영일지
          </span>
        </div>
        <span className="text-sm font-medium text-gray-600">5기 이수강</span>
      </header>

      {/* 페이지 배너 */}
      <div className="sticky top-12 z-40 flex h-12 items-center gap-3 border-b border-slate-200 bg-slate-100 px-4">
        <div className="h-5 w-1 rounded-sm bg-slate-500" />
        <h1 className="text-sm font-semibold text-slate-700">📊 DB관리</h1>
      </div>

      <main className="px-4 pb-[80px] pt-3">
        <OverallCard
          items={overall.items}
          totalCost={overall.totalCost}
          totalCount={overall.totalCount}
          activeCh={activeCh}
        />

        <ChannelTabs activeCh={activeCh} onSwitch={switchChannel} />

        {/* 힌트 카드 */}
        <div
          className="mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5"
          style={{
            background: ch.bgLight,
            borderColor: ch.borderLight,
            color: ch.textDark,
          }}
        >
          <span className="shrink-0 text-base">💡</span>
          <p className="flex-1 text-xs leading-relaxed">{ch.hint}</p>
        </div>

        {/* 합계 카드 (선택 채널) */}
        <div
          className="mb-4 rounded-xl border-l-4 bg-white p-4 shadow-sm"
          style={{ borderLeftColor: ch.color }}
        >
          {ch.isCost && summary ? (
            <CostSummary
              channel={ch}
              rowCount={rows.length}
              totalCost={summary.totalCost}
              avgUnit={summary.avgUnit}
              totalQty={summary.totalCount}
              unitLabel={summary.unitLabel}
            />
          ) : (
            <LeadSummary count={rows.length} />
          )}
        </div>

        {/* 행 리스트 헤더 */}
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-gray-700">
            {ch.recordsLabel}
          </h3>
        </div>

        <RowList
          loading={overview.isLoading}
          error={overview.isError ? overview.error : null}
          rows={rows}
          ch={ch}
          chKey={activeCh}
          expandedRow={expandedRow}
          pendingRow={pendingRow}
          badgeCls={BADGE_CLS[activeCh]}
          onExpand={(rowNum) => {
            setExpandedRow(rowNum);
            setAddOpen(false);
          }}
          onCollapse={() => setExpandedRow(null)}
          onSave={handleSave}
          onDeleteRequest={requestDelete}
        />

        {/* + 추가 버튼 */}
        {!addOpen && !overview.isLoading && (
          <button
            type="button"
            onClick={() => {
              setAddOpen(true);
              setExpandedRow(null);
            }}
            className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
          >
            + {ch.recordsLabel} 추가
          </button>
        )}

        {/* 추가 폼 */}
        {addOpen && (
          <div className="mt-3 rounded-xl border-2 border-blue-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <span className={`badge ${BADGE_CLS[activeCh]}`}>{ch.name}</span>
              <span className="text-sm font-semibold text-gray-700">
                {ch.recordsLabel} 추가
              </span>
            </div>
            <RowForm channel={ch} onChange={setAddDraft} />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={pendingRow === "add"}
                className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:bg-gray-300"
              >
                {pendingRow === "add" ? "추가중..." : "+ 추가"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-[200] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmTarget && (
        <ConfirmModal
          title={`${ch.recordsLabel} 삭제`}
          message={`'${confirmTarget.label}' 을(를) 삭제할까요?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </>
  );
}
