import { METRIC_LABEL, type MetricKey } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
const KEYS: MetricKey[] = ["production", "inflow", "contactProgress", "meetingReservation"];
export default function MetricComparison({ before, after }: {
  before: ChannelDailyRowMetrics;
  after: ChannelDailyRowMetrics;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-center text-xs tabular-nums">
        <thead className="bg-gray-50 text-gray-500"><tr>
          <th scope="col" className="p-2">채널 숫자</th>
          {KEYS.map((k) => <th scope="col" key={k}>{METRIC_LABEL[k]}</th>)}
        </tr></thead>
        <tbody>
          <tr><th scope="row" className="p-2 font-medium">저장 전</th>
            {KEYS.map((k) => <td key={k}>{before[k]}</td>)}
          </tr>
          <tr className="text-blue-700"><th scope="row" className="p-2 font-medium">이번 변경</th>
            {KEYS.map((k) => { const delta = after[k] - before[k]; return <td key={k}>{delta > 0 ? "+" : ""}{delta}</td>; })}
          </tr>
          <tr className="bg-indigo-50 font-bold text-indigo-900"><th scope="row" className="p-2">저장 후 최종</th>
            {KEYS.map((k) => <td key={k}>{after[k]}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
