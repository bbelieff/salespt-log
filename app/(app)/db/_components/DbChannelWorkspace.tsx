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
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import {
  useAppendDB,
  useDBOverview,
  usePatchDB,
  useRemoveDB,
} from "@/query/db-hooks";
import {
  CHANNELS,
  KEY_TO_BACKEND,
  summarizeCost,
  type ChannelKey,
} from "../_lib/channels";


import { CostSummary, LeadSummary } from "./SummaryCard";
import RowList from "./RowList";
import RowForm from "./RowForm";


import ConfirmModal from "./ConfirmModal";
import { useRouter } from "next/navigation";
import CrossTabHintModal from "@/components/ui/CrossTabHintModal";
import { eulReul, iGa } from "@/util/josa";

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

export default function DbChannelWorkspace({ activeCh }: { activeCh: ChannelKey }) {
  const router = useRouter();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(true);
  const [addDraft, setAddDraft] = useState<Record<string, unknown>>({});
  const [pendingRow, setPendingRow] = useState<number | "add" | null>(null);
  const [toast, setToast] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  // 2026-05-17 [DB-1/DB-2]: 목록 추가 후 「다음에 뭘 해야 하는지」 안내.
  // 2026-09-19: 전 채널로 확대(현수막 제외 해제) + 채널별로 말이 갈린다(handleAdd 주석).
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

  // 안내 모달이 쓸 말 — **그 채널 컨택탭 화면에 실제로 있는 것**만 말한다.
  //
  // 채널마다 「목록을 넣은 뒤 학생이 더 할 일」이 다르다. 그런데 예전 안내는 전 채널에
  // "컨택관리에서 **생산**을 기록하라"고 똑같이 말했다. 실측하면 그게 가능한 채널이 없다시피 하다:
  //   · 매입DB  — 컨택 첫 행이 「유입대기 🔒DB자동」 **읽기전용**. 손으로 못 적는다.
  //   · 콜·지·기·소 — 첫 행이 「생산 🔒DB자동」, 유입 행도 잠김(ADR-0029 파생). 역시 못 적는다.
  //   · 직접생산 — 「유입」 스테퍼로 적는다. 「생산」이 아니다(ADR-0024).
  //   · 현수막   — 「게시」 스테퍼로 적는다. 「생산」이 아니다(ADR-0025).
  // 즉 "생산을 기록하라"는 **어느 채널에도 맞지 않는 말**이었다. 학생은 화면에 없는 단어를
  // 찾다 포기하고, 기록이 비면 대시보드도 빈다(대시보드는 주문·재고를 보지 않는다).
  //
  // ※ 활성 채널이 아니라 **안내가 가리키는 채널**로 조회한다(저장 후 채널을 옮길 수 있다).
  const hintKey = productionHint?.channel ?? null;
  const hintRecordsLabel = hintKey ? CHANNELS[hintKey].recordsLabel : "목록";
  /** 그 채널에서 학생이 실제로 손으로 넣어야 하는 지표명. null = 넣을 것 없음(자동). */
  const hintMetricLabel: string | null =
    hintKey === "banner" ? "게시" : hintKey === "direct" ? "유입" : null;
  /** 컨택탭에서 강조할 스테퍼 — 채널이 실제로 쓰는 지표여야 한다. */
  const hintFocus = hintKey === "direct" ? "inflow" : "production";

  // DB생산 [1]: 채널 진입 시 최신 행을 기본 펼침(접어두지 않음). 채널당 1회 —
  // 이후 사용자가 접/펼 자유롭게(데이터 refetch 로 되돌리지 않음).
  useEffect(() => {
    if (!overview.data || addOpen || autoExpandedCh === activeCh) return;
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
      // 가드(saveAll)가 실패를 관측하도록 rethrow → fail>0 → 모달 유지·이동 취소·행 유지
      // (안 그러면 '저장하고 이동' 시 저장 실패해도 접혀서 편집이 무음 유실 — §2.5).
      throw e;
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
      showToast(`${ch.recordsLabel}${iGa(ch.recordsLabel)} 추가되었습니다 ✨`);
      // 2026-05-17 [DB-1/DB-2]: 목록 추가 후 다음 할 일 안내.
      //
      // 2026-09-19 — 여기 있던 `if (activeCh !== "banner")` 를 **없앴다.** 근거였던
      // "현수막은 게시한날=생산이라 별도 입력 불필요" 는 ADR-0023(게시로그를 DB생산 탭에
      // 따로 적으면 syncProduction 이 E 를 채우던 시절) 기준이라 그때는 맞았다. 그러나
      // **ADR-0025(2026-06-23)가 게시로그를 폐기**하고 생산(E)=게시를 **컨택탭 스테퍼 소유**로
      // 옮겼다. 그 뒤로 현수막은 **컨택에서 게시를 적어야만** 지표가 생긴다 — 즉 안내가
      // 가장 필요한 채널인데 유일하게 빠져 있었다. 실제로 「목록을 넣었는데 대시보드에
      // 안 뜬다」 신고가 여기서 나왔다. 안내 문구는 채널별로 갈린다(위 hintMetricLabel).
      setProductionHint({
        channel: activeCh,
        date: /^\d{4}-\d{2}-\d{2}$/.test(addedDate) ? addedDate : undefined,
      });
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
    `db-add-row-${activeCh}`,
    addOpen && addDirty,
    async () => {
      await append.mutateAsync({ channel: KEY_TO_BACKEND[activeCh], data: addDraft as never });
      setAddOpen(false);
    },
    () => setAddOpen(false),
    `${ch.recordsLabel} 추가`,
  );

  return (
    <>
{/* 추가 폼 */}
        {addOpen && (
          <div className="mb-3 rounded-xl border-2 border-blue-200 bg-white p-4 shadow-md">
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
                onClick={() => guardedNav(() => setAddOpen(false))}
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
          onExpand={(rowNum) =>
            // 다른 행으로 전환도 미저장 가드 — 펼친 행이 dirty 면 접히며 유실되므로 선확인.
            guardedNav(() => {
              setExpandedRow(rowNum);
              setAddOpen(false);
            })
          }
          onCollapse={() => guardedNav(() => setExpandedRow(null))}
          onSave={handleSave}
          onDeleteRequest={requestDelete}
        />

        {/* + 추가 버튼 */}
        {!addOpen && !overview.isLoading && (
          <button
            type="button"
            onClick={() =>
              // 추가폼 열기도 펼친 행을 접으므로 미저장 가드로 감싼다(dirty 면 선확인).
              guardedNav(() => {
                setAddOpen(true);
                setExpandedRow(null);
              })
            }
            className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
          >
            + {ch.recordsLabel} 추가
          </button>
        )}



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

      {/* 2026-05-17 [DB-1]: 추가 후 컨택탭 안내. 직접생산은 유입→생산개수 자동(ADR-0024).
          2026-09-19: 이 안내가 **화면에 없는 단어**를 찾게 만들고 있었다 —
          ① 목록 이름을 「구매목록」으로 통으로 박았는데 현수막은 「제작목록」이고,
          ② 컨택탭에서 「생산」을 찾으라 했는데 현수막 스테퍼는 「게시」다(ADR-0025).
          학생이 없는 걸 찾다 기록을 못 하면 대시보드에도 안 잡힌다 —
          대시보드는 주문·재고를 보지 않고 컨택탭에 적힌 수치만 본다.
          그래서 채널이 실제로 쓰는 말(recordsLabel·지표명)로 바꾼다. */}
      <CrossTabHintModal
        open={productionHint !== null}
        title={
          hintMetricLabel
            ? `📞 컨택관리에서 ${hintMetricLabel}${eulReul(hintMetricLabel)} 입력하세요`
            : "✅ 추가됐어요 — 더 하실 일은 없어요"
        }
        body={
          hintMetricLabel ? (
            // 입력형 — 학생이 컨택탭에서 손으로 넣어야 지표가 생긴다.
            <>
              <b>{hintKey ? KEY_TO_BACKEND[hintKey] : ""}</b> {hintRecordsLabel}
              {iGa(hintRecordsLabel)} 추가됐어요. 이제 <b>컨택관리</b>에서{" "}
              <b>{hintMetricLabel}</b>
              {eulReul(hintMetricLabel)} 입력하면 <b>대시보드에 바로 보여요.</b>
            </>
          ) : (
            // 자동형 — 컨택탭 해당 행이 「🔒 DB자동」 읽기전용이라 손댈 것이 없다.
            <>
              <b>{hintKey ? KEY_TO_BACKEND[hintKey] : ""}</b> {hintRecordsLabel}
              {iGa(hintRecordsLabel)} 추가됐어요. <b>따로 입력하지 않으셔도 돼요</b> —
              컨택관리에 자동으로 반영돼요.
            </>
          )
        }
        navLabel={hintMetricLabel ? "📞 컨택관리로 이동" : "📞 확인하러 가기"}
        onNavigate={() => {
          const hint = productionHint;
          const focus = hintFocus;
          setProductionHint(null);
          if (hint) {
            const ch = KEY_TO_BACKEND[hint.channel];
            const qs = new URLSearchParams({ channel: ch, focus });
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
