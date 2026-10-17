import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  STATUS_FILTERS,
  filterDbSheetRows,
  hasStatusRestriction,
  toggleStatusFilter,
  type StatusFilterId,
} from "@/app/(app)/db-sheet/_components/status-filter";

type FixtureRow = {
  id: string;
  company: string;
  result: string;
  owner: string;
  phone: string;
  supplier: string;
  date: string;
};

const fixtureResults = [
  ["1", "가상 미컨택", "미컨택"],
  ["2", "가상 부재", "부재"],
  ["3", "가상 단순거절", "단순거절"],
  ["4", "가상 재통화", "재통화"],
  ["5", "가상 컨택진행", "컨택진행"],
  ["6", "가상 상담거절", "상담 후 거절"],
  ["7", "가상 새결과", "새 결과"],
] as const;
const rows: FixtureRow[] = fixtureResults.map(([id, company, result]) => ({
  id,
  company,
  result,
  owner: "김가상",
  phone: `010-0000-000${id}`,
  supplier: "합성 공급처",
  date: "2026-10-16",
}));

function Fixture() {
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilterId[]>([]);
  const [search, setSearch] = useState("");
  const mode = new URLSearchParams(window.location.search).get("mode") ?? "ready";
  const sourceRows: FixtureRow[] = mode === "empty" || mode === "loading" || mode === "error" ? [] : rows;
  const filtered = useMemo(
    () => filterDbSheetRows(sourceRows, { selectedStatuses, search }),
    [sourceRows, selectedStatuses, search],
  );
  const statusRestricted = hasStatusRestriction(selectedStatuses);

  useEffect(() => {
    document.body.classList.add("db-sheet-route");
    return () => document.body.classList.remove("db-sheet-route");
  }, []);

  return <main className="fixture-shell">
    <section className="sheet-panel db-sheet-panel" aria-labelledby="fixture-title">
      <div className="fixture-head">
        <div><h1 id="fixture-title">DB관리시트</h1><p>합성 데이터 렌더 검증</p></div>
        <input aria-label="DB 검색" className="fixture-search" placeholder="업체·대표자·전화번호" value={search} onChange={event => setSearch(event.target.value)} />
        {(search || selectedStatuses.length > 0) && <button type="button" className="fixture-reset" onClick={() => { setSearch(""); setSelectedStatuses([]); }}>초기화</button>}
      </div>
      <div className="sheet-status-filter-row">
        <span className="sheet-status-filter-label">상태</span>
        <div className="sheet-status-filter-chips" role="group" aria-label="DB 상태 필터">
          {STATUS_FILTERS.map(filter => {
            const pressed = selectedStatuses.includes(filter.id);
            return <button
              key={filter.id}
              type="button"
              className="sheet-status-chip"
              aria-pressed={pressed}
              onClick={() => setSelectedStatuses(current => toggleStatusFilter(current, filter.id))}
            >
              <span className="sheet-status-chip-check" aria-hidden="true">{pressed ? "✓" : ""}</span>
              {filter.label}
            </button>;
          })}
        </div>
        <span className="sheet-status-filter-summary" aria-live="polite">{statusRestricted ? `${filtered.length}건 표시` : "전체 표시"}</span>
      </div>
      {mode === "loading" && <p role="status" className="fixture-state">불러오는 중…</p>}
      {mode === "error" && <p role="alert" className="fixture-state fixture-error">목록을 불러오지 못했습니다.</p>}
      {mode === "empty" && <p className="fixture-state">표시할 DB가 없습니다.</p>}
      {mode === "ready" && filtered.length === 0 && <p className="fixture-state">선택한 조건에 맞는 DB가 없습니다.</p>}
      <ul className="fixture-list" aria-label="필터 결과">
        {filtered.map(row => <li key={row.id} data-result={row.result}><strong>{row.company}</strong><span>{row.result}</span></li>)}
      </ul>
      <footer className="fixture-foot">총 <span data-testid="filtered-count">{filtered.length}</span>건</footer>
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
