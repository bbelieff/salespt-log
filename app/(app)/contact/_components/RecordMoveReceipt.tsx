import type { ChannelDailyRowMetrics } from "@/service";
export default function RecordMoveReceipt({ receipt, onClose }: {
  receipt: { fromLabel: string; toLabel: string; from: ChannelDailyRowMetrics; to: ChannelDailyRowMetrics };
  onClose: () => void;
}) {
  return <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="이동 저장 결과" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="font-bold text-gray-900">이동을 저장했어요</h3><button type="button" aria-label="이동 결과 닫기" onClick={onClose} className="h-8 w-8 text-xl">×</button></div>
      {([['남은 기록', receipt.fromLabel, receipt.from], ['옮긴 날짜', receipt.toLabel, receipt.to]] as const).map(([label, place, metrics]) => <section key={label} className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm">
        <h4 className="font-bold">{label} · {place}</h4>
        <p className="mt-2">유입 {metrics.inflow} · 컨택 {metrics.contactProgress} · 미팅예약 {metrics.meetingReservation}</p>
      </section>)}
      <p className="mt-3 text-xs text-gray-600">남은 미팅도 원래 날짜에 함께 저장했어요. 다른 채널에 미저장 입력이 있으면 따로 저장해주세요.</p>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg bg-slate-900 p-3 text-sm font-bold text-white">확인</button>
    </div>
  </div>;
}
