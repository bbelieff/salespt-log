/**
 * DB관리 탭 (PR 09 db-management).
 * 시트: 03 DB관리, 4채널 raw log (매입DB / 직접생산 / 현수막 / 콜·지·기·소).
 *
 * 메인 목표 (사용자 정의):
 *   - 채널별 총비용·평균단가 모니터링
 *   - 합계·평균단가는 시트 수식이 자동 계산 → 우리는 raw 입력만
 *
 * SSOT: docs/domains/sheet-structure.md §5
 */
"use client";

import { useMemo, useState } from "react";
import {
  useAppendDB,
  useDBOverview,
  usePatchDB,
  useRemoveDB,
  type DBChannel,
} from "@/query/db-hooks";
import DBSection, {
  type FieldDef,
  type RowData,
} from "./_components/DBSection";

const CHANNELS: DBChannel[] = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];

const FIELDS: Record<DBChannel, readonly FieldDef[]> = {
  매입DB: [
    { key: "구매일", label: "구매일", type: "date" },
    { key: "업체명", label: "업체명", type: "text" },
    { key: "개당단가", label: "개당단가", type: "number", unit: "원" },
    { key: "주문개수", label: "주문개수", type: "number", unit: "건" },
    { key: "주문금액", label: "주문금액", type: "number", unit: "원", computed: true },
    { key: "기타", label: "기타", type: "text" },
  ],
  직접생산: [
    { key: "날짜", label: "날짜", type: "date" },
    { key: "소재", label: "소재", type: "text" },
    { key: "기간예산", label: "기간예산", type: "number", unit: "원" },
    { key: "생산개수", label: "생산개수", type: "number", unit: "건" },
    { key: "개당단가", label: "개당단가", type: "number", unit: "원", computed: true },
    { key: "기타", label: "기타", type: "text" },
  ],
  현수막: [
    { key: "날짜", label: "날짜", type: "date" },
    { key: "업체명", label: "업체명", type: "text" },
    { key: "도착일", label: "도착일", type: "date" },
    { key: "개당단가", label: "개당단가", type: "number", unit: "원" },
    { key: "주문개수", label: "주문개수", type: "number", unit: "건" },
    { key: "주문금액", label: "주문금액", type: "number", unit: "원", computed: true },
    { key: "기타", label: "기타", type: "text" },
  ],
  "콜·지·기·소": [
    {
      key: "구분",
      label: "구분",
      type: "select",
      options: ["콜드콜", "지인", "기고객", "소개"],
    },
    { key: "접수일", label: "접수일", type: "date" },
    { key: "대표자명", label: "대표자명", type: "text" },
    { key: "업체명", label: "업체명", type: "text" },
    { key: "소개처", label: "소개처", type: "text" },
    { key: "연락처", label: "연락처", type: "text" },
    { key: "조건", label: "조건", type: "text" },
  ],
};

const CHANNEL_HINT: Record<DBChannel, string> = {
  매입DB: "외부 명단 구매 비용 (단가 × 개수)",
  직접생산: "광고비 (메타 등) — 기간예산 ÷ 생산수 = 단가",
  현수막: "현수막 제작·설치 비용",
  "콜·지·기·소": "콜드콜·지인·기고객·소개 영업 기회 (비용 X)",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function DbPage() {
  const [active, setActive] = useState<DBChannel>("매입DB");
  const [pendingRow, setPendingRow] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const overview = useDBOverview();
  const append = useAppendDB();
  const patch = usePatchDB();
  const remove = useRemoveDB();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const rowsByChannel: Record<DBChannel, RowData[]> = useMemo(() => {
    const empty = {
      매입DB: [],
      직접생산: [],
      현수막: [],
      "콜·지·기·소": [],
    } as Record<DBChannel, RowData[]>;
    if (!overview.data) return empty;
    return {
      매입DB: overview.data.purchases as unknown as RowData[],
      직접생산: overview.data.productions as unknown as RowData[],
      현수막: overview.data.banners as unknown as RowData[],
      "콜·지·기·소": overview.data.leads as unknown as RowData[],
    };
  }, [overview.data]);

  // 채널별 총비용·평균단가 (콜·지·기·소 제외)
  const summary = useMemo(() => {
    const rows = rowsByChannel[active];
    if (active === "콜·지·기·소") {
      return { count: rows.length, total: 0, avg: 0 };
    }
    let total = 0;
    let totalQty = 0;
    for (const r of rows) {
      if (active === "직접생산") {
        total += Number(r["기간예산"] ?? 0);
        totalQty += Number(r["생산개수"] ?? 0);
      } else {
        total += Number(r["주문금액"] ?? 0);
        totalQty += Number(r["주문개수"] ?? 0);
      }
    }
    const avg = totalQty > 0 ? total / totalQty : 0;
    return { count: rows.length, total, avg };
  }, [rowsByChannel, active]);

  const handleAdd = async (data: Record<string, string | number>) => {
    setPendingRow(-1);
    try {
      await append.mutateAsync({ channel: active, data: data as never });
      showToast("✓ 추가 완료");
    } catch (e) {
      showToast(`추가 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const handlePatch = async (
    row: number,
    data: Record<string, string | number>,
  ) => {
    setPendingRow(row);
    try {
      await patch.mutateAsync({ channel: active, row, data: data as never });
      showToast("✓ 수정 완료");
    } catch (e) {
      showToast(`수정 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  const handleRemove = async (row: number) => {
    setPendingRow(row);
    try {
      await remove.mutateAsync({ channel: active, row });
      showToast("✓ 삭제 완료");
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setPendingRow(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-base font-bold text-gray-900">📊 DB관리</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            채널별 비용·영업기회 raw 입력 · 합계는 시트 수식 자동
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 pb-2">
          {CHANNELS.map((ch) => {
            const isActive = ch === active;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setActive(ch)}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 pb-[80px] pt-3">
        <div className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
          💡 {CHANNEL_HINT[active]}
        </div>

        {overview.isLoading ? (
          <div className="text-sm text-slate-500">불러오는 중…</div>
        ) : overview.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            ⚠ 불러오기 실패: {(overview.error as Error).message}
          </div>
        ) : (
          <DBSection
            fields={FIELDS[active]}
            rows={rowsByChannel[active]}
            pendingRow={pendingRow}
            onAdd={handleAdd}
            onPatch={handlePatch}
            onRemove={handleRemove}
            emptyHint={`${active} 데이터 없음 — 위 폼으로 추가하세요`}
            summary={
              active === "콜·지·기·소" ? (
                <div className="rounded-2xl bg-purple-50 p-3">
                  <div className="text-xs font-semibold text-purple-800">
                    📞 영업 기회
                  </div>
                  <div className="mt-1 text-base font-bold text-purple-700">
                    {summary.count}건
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    비용 추적 X — 정보만 수집
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-green-50 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-green-800">
                      💰 {active} 총비용
                    </span>
                    <span className="text-base font-bold text-green-700">
                      {fmtMoney(summary.total)}원
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-xs text-gray-600">
                    <span>평균단가</span>
                    <span className="font-semibold text-gray-800">
                      {summary.avg > 0
                        ? `${fmtMoney(Math.round(summary.avg))}원`
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-400">
                    {summary.count}행 · 시트 합계 행은 별도로 자동 집계
                  </div>
                </div>
              )
            }
          />
        )}
      </main>

      {toast && (
        <div className="fixed bottom-[80px] left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
