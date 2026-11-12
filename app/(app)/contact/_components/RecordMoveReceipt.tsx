import type { ChannelDailyRowMetrics } from "@/service";
import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";
/** 이동 저장 결과 안내 — 2026-11-12 AppDialog(결정 4 2차): Esc·×·확인·바깥 누르기로 닫힘, 닫히면 연 곳으로 초점. */
export default function RecordMoveReceipt({ receipt, onClose }: {
  receipt: { fromLabel: string; toLabel: string; from: ChannelDailyRowMetrics; to: ChannelDailyRowMetrics };
  onClose: () => void;
}) {
  return <AppDialog title="이동 저장 결과" size="sm" dismissOnBackdrop onClose={onClose} className="rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">이동을 저장했어요</h3><AppDialogClose aria-label="이동 결과 닫기" className="h-8 w-8 text-xl">×</AppDialogClose></div>
      {([['남은 기록', receipt.fromLabel, receipt.from], ['옮긴 날짜', receipt.toLabel, receipt.to]] as const).map(([label, place, metrics]) => <section key={label} className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm">
        <h4 className="font-bold">{label} · {place}</h4>
        <p className="mt-2">유입 {metrics.inflow} · 컨택 {metrics.contactProgress} · 미팅예약 {metrics.meetingReservation}</p>
      </section>)}
      <p className="mt-3 text-xs text-slate-600">남은 미팅도 원래 날짜에 함께 저장했어요. 다른 채널에 미저장 입력이 있으면 따로 저장해주세요.</p>
      <AppDialogClose data-autofocus className="mt-4 w-full rounded-lg bg-slate-900 p-3 text-sm font-bold text-white">확인</AppDialogClose>
  </AppDialog>;
}
