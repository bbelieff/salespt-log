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

import PageContainer from "@/components/PageContainer";

import { useEffect, useMemo, useState } from "react";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
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
import DbNudgeBanner from "./_components/DbNudgeBanner";
import TopHeader from "@/components/TopHeader";
import ConfirmModal from "./_components/ConfirmModal";
import { useRouter } from "next/navigation";
import CrossTabHintModal from "@/components/ui/CrossTabHintModal";

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

// 2026-06-03 [교차탭1]: 채널별 날짜 입력 필드 키 (컨택탭에 날짜를 들고 넘기기 위함).
const CHANNEL_DATE_FIELD: Record<ChannelKey, string> = {
  purchase: "구매일",
  direct: "종료일",
  banner: "날짜",
  referral: "접수일",
};

interface ConfirmTarget {
  rowNum: number;
  label: string;
}

export default function DbPage() {
  const router = useRouter();
  const [activeCh, setActiveCh] = useState<ChannelKey>("purchase");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<Record<string, unknown>>({});
  const [pendingRow, setPendingRow] = useState<number | "add" | null>(null);
  const [toast, setToast] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  // 2026-05-17 [DB-1/DB-2]: 추가 후 컨택탭 생산 입력 안내 (현수막 제외).
  // 2026-06-03 [교차탭1]: 추가행 날짜도 담아 컨택탭에 채널+날짜를 들고 넘김.
  const [productionHint, setProductionHint] = useState<{
    channel: ChannelKey;
    date?: string;
  } | null>(null);

  // DB생산 [1]: 채널당 최신 행 자동 펼침 추적(채널당 1회).
  const [autoExpandedCh, setAutoExpandedCh] = useState<ChannelKey | null>(null);

  const overview = useDBOverview();
  const append = useAppendDB();
  const patch = usePatchDB();
  const remove = useRemoveDB();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  // 화면 안 이동도 미저장 가드 — 채널 전환·행 접기 시 dirty 면 모달.
  const guardedNav = useGuardedNav();
  const switchChannel = (k: ChannelKey) =>
    guardedNav(() => {
      setActiveCh(k);
      setAddOpen(false);
      // expandedRow 는 아래 effect 가 채널별 최신 행으로 자동 펼침(요청 DB생산 [1]).
    });

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

  // DB생산 [1]: 채널 진입 시 최신 행을 기본 펼침(접어두지 않음). 채널당 1회 —
  // 이후 사용자가 접/펼 자유롭게(데이터 refetch 로 되돌리지 않음).
  useEffect(() => {
    if (!overview.data || autoExpandedCh === activeCh) return;
    setExpandedRow(rows.length > 0 ? Number(rows[rows.length - 1]!.row) : null);
    setAutoExpandedCh(activeCh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.data, activeCh, autoExpandedCh, rows]);

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
      // 2026-06-03 [교차탭1]: 입력한 날짜를 캡처 (clear 전).
      const addedDate = String(addDraft[CHANNEL_DATE_FIELD[activeCh]] ?? "");
      setAddOpen(false);
      showToast(`${ch.recordsLabel}이 추가되었습니다 ✨`);
      // 2026-05-17 [DB-1/DB-2]: 현수막 외 채널은 컨택탭 생산 입력 안내.
      // 현수막은 게시한날=생산이라 별도 입력 불필요.
      if (activeCh !== "banner") {
        setProductionHint({
          channel: activeCh,
          date: /^\d{4}-\d{2}-\d{2}$/.test(addedDate) ? addedDate : undefined,
        });
      }
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

  // 신규행 추가 폼 미저장 가드 — 판정은 RowForm(rowFormDirty, 자동 필드 제외 → 거짓 dirty 0).
  const [addDirty, setAddDirty] = useState(false);
  useEffect(() => {
    if (!addOpen) { setAddDraft({}); setAddDirty(false); }
  }, [addOpen]);
  useDirtyEntry(
    "db-add-row",
    addOpen && addDirty,
    async () => {
      await append.mutateAsync({ channel: KEY_TO_BACKEND[activeCh], data: addDraft as never });
      setAddOpen(false);
    },
    () => setAddOpen(false),
    `${ch.recordsLabel} 추가`,
  );

  // 2026-06-03 [교차탭1]: 컨택탭 불일치 안내에서 ?channel=&focus=add 로 넘어오면
  // 해당 채널을 선택하고 추가폼을 자동으로 열어 "여기에 입력" 을 빠르게 인지시킴.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const chName = params.get("channel");
    const focus = params.get("focus");
    if (!chName) return;
    const entry = (CHANNEL_KEYS as readonly ChannelKey[]).find(
      (k) => KEY_TO_BACKEND[k] === chName,
    );
    if (entry) {
      setActiveCh(entry);
      setExpandedRow(null);
      if (focus === "add") setAddOpen(true);
    }
  }, []);

  return (
    <>
      <TopHeader pageEmoji="📊" pageTitle="DB생산" />

      <main className="px-4 pb-[80px] pt-3">
      <PageContainer width="wide">
        <OverallCard
          items={overall.items}
          totalCost={overall.totalCost}
          totalCount={overall.totalCount}
          activeCh={activeCh}
        />

        <DbNudgeBanner onGoDirect={() => switchChannel("direct")} />

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
          onCollapse={() => guardedNav(() => setExpandedRow(null))}
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
            <RowForm channel={ch} onChange={setAddDraft} onDirtyChange={setAddDirty} />
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
      </PageContainer>
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

      {/* 2026-05-17 [DB-1]: 추가 후 컨택탭 안내. 직접생산은 유입→생산개수 자동(ADR-0024). */}
      <CrossTabHintModal
        open={productionHint !== null}
        title={
          productionHint?.channel === "direct"
            ? "📞 컨택관리에서 유입을 입력하세요"
            : "✏️ 컨택관리에 생산 입력하셨나요?"
        }
        body={
          productionHint?.channel === "direct" ? (
            <>
              생산목록(기간)이 추가됐어요. 이제 <b>컨택관리</b>에서 <b>유입</b>을
              +입력·저장하면 이 기간의 <b>생산개수</b>가 자동으로 집계돼요.
            </>
          ) : (
            <>
              <b>{productionHint ? KEY_TO_BACKEND[productionHint.channel] : ""}</b>{" "}
              구매목록 추가됐어요. 컨택관리 탭의 해당 일자/채널에{" "}
              <b>생산</b>도 기록해야 합니다.
            </>
          )
        }
        navLabel="📞 컨택관리로 이동"
        onNavigate={() => {
          const hint = productionHint;
          setProductionHint(null);
          if (hint) {
            const ch = KEY_TO_BACKEND[hint.channel];
            const qs = new URLSearchParams({ channel: ch, focus: "production" });
            if (hint.date) qs.set("date", hint.date);
            router.push(`/contact?${qs.toString()}`);
          } else {
            router.push("/contact");
          }
        }}
        onClose={() => setProductionHint(null)}
      />
    </>
  );
}
