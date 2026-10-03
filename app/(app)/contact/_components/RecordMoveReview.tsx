import type { ChannelDailyRowMetrics } from "@/service";
import MetricComparison from "./MetricComparison";
export default function RecordMoveReview({ fromLabel, toLabel, company, source, target, deltas, movedMeetings, remainingNames }: {
  fromLabel: string; toLabel: string; company: string;
  source: ChannelDailyRowMetrics; target: ChannelDailyRowMetrics;
  deltas: { inflow?: number; contactProgress?: number }; movedMeetings: number; remainingNames: string[];
}) {
  const from = { ...source, inflow: source.inflow - (deltas.inflow ?? 0), contactProgress: source.contactProgress - (deltas.contactProgress ?? 0), meetingReservation: Math.max(0, source.meetingReservation - movedMeetings) };
  const to = { ...target, inflow: target.inflow + (deltas.inflow ?? 0), contactProgress: target.contactProgress + (deltas.contactProgress ?? 0), meetingReservation: target.meetingReservation + movedMeetings };
  return <div className="space-y-4 text-sm">
    <p className="rounded-lg bg-amber-50 p-3 text-amber-900"><b>아직 저장되지 않았어요.</b><br />저장하기를 누르기 전에는 뒤로 돌아가거나 X로 이동 선택을 취소할 수 있어요.</p>
    <p><b>{company}</b>{movedMeetings > 1 ? ` 등 ${movedMeetings}건` : " 미팅 1건"}의 기록을 옮겨요. 미팅 예정일시는 바뀌지 않아요.</p>
    <section><h4 className="font-bold">{fromLabel} · 남는 수치</h4><MetricComparison before={source} after={from} /></section>
    <section><h4 className="font-bold">{toLabel} · 옮긴 뒤 수치</h4><MetricComparison before={target} after={to} /></section>
    <p className="text-xs text-gray-600">남은 미팅{remainingNames.length ? ` (${remainingNames.join(", ")})` : ""}은 원래 날짜에 함께 저장해요. 다른 채널의 신규 입력은 변경하지 않아요.</p>
  </div>;
}
