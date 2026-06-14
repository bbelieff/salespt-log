/**
 * CohortSummaryBoard — 전광판 메인 종합요약 보드 (arena-scoreboard-v2, 1안).
 *
 * 기수별 5지표 평균을 계약 평균 desc 순위로 정렬, 1위 강조. 캡쳐 친화 고정폭.
 */
const METRICS = ["생산", "유입", "컨택", "미팅", "계약"] as const;
type Metric = (typeof METRICS)[number];

export interface CohortSummaryRow {
  cohort: string; // 정규화 "A1-1"
  paidMembers: number;
  total: Record<Metric, number>;
}

export default function CohortSummaryBoard({
  cohorts,
}: {
  cohorts: CohortSummaryRow[];
}) {
  // 계약 평균 desc → 동점 미팅 desc → 기수 asc.
  const ranked = [...cohorts]
    .filter((c) => c.paidMembers > 0)
    .sort(
      (a, b) =>
        b.total.계약 - a.total.계약 ||
        b.total.미팅 - a.total.미팅 ||
        a.cohort.localeCompare(b.cohort, "en", { numeric: true }),
    );

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-8 text-center text-sm text-gray-400">
        집계할 입금자가 없어요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="px-2 py-2 text-left font-bold">순위 · 기수</th>
            {METRICS.map((m) => (
              <th
                key={m}
                className={`px-2 py-2 font-bold ${
                  m === "계약" ? "text-purple-600" : ""
                }`}
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((c, i) => {
            const top = i === 0;
            return (
              <tr
                key={c.cohort}
                className={`border-t border-gray-50 ${
                  top ? "bg-purple-50" : ""
                }`}
              >
                <td className="px-2 py-2.5 text-left">
                  <span
                    className={`mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                      top
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`font-black ${
                      top ? "text-purple-800" : "text-gray-800"
                    }`}
                  >
                    {c.cohort}기
                  </span>
                  <span className="ml-1 text-[11px] font-bold text-gray-400">
                    {c.paidMembers}명
                  </span>
                </td>
                {METRICS.map((m) => (
                  <td
                    key={m}
                    className={`px-2 py-2.5 tabular-nums ${
                      m === "계약"
                        ? "text-base font-black text-purple-700"
                        : "font-bold text-gray-700"
                    }`}
                  >
                    {c.total[m].toFixed(1)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
