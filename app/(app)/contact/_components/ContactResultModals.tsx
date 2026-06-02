/** 컨택관리 결과 모달 클러스터 (page.tsx 분할): DB불일치 안내 · DB일치 확인 · 미팅 선택삭제. */
import type { Channel, Meeting } from "@/types";
import CrossTabHintModal from "@/components/ui/CrossTabHintModal";
import MeetingPickerModal from "./MeetingPickerModal";
import type { ProductionMismatch } from "../_lib/dbProductionCheck";

interface Props {
  dbMismatch: ProductionMismatch | null;
  onMismatchNavigate: () => void;
  onMismatchClose: () => void;
  dbMatchOk: { channel: Channel; count: number } | null;
  onMatchOkClose: () => void;
  pickerMeetings: Meeting[] | null;
  onPick: (meeting: Meeting) => void;
  onPickerClose: () => void;
}

export default function ContactResultModals({
  dbMismatch,
  onMismatchNavigate,
  onMismatchClose,
  dbMatchOk,
  onMatchOkClose,
  pickerMeetings,
  onPick,
  onPickerClose,
}: Props) {
  return (
    <>
      {/* 2026-05-17 [C-2]: DB ↔ 생산 불일치 안내 */}
      <CrossTabHintModal
        open={dbMismatch !== null}
        title="⚠ DB관리 입력 확인 필요"
        body={
          dbMismatch && (
            <>
              <b>{dbMismatch.channel}</b> 컨택관리 생산값은 <b>{dbMismatch.expected}</b>인데{" "}
              DB관리 시트 합은 <b>{dbMismatch.actual}</b>입니다. 숫자가 안 맞아요.
              <br />
              DB관리에서 구매목록을 추가/수정해 <b>{dbMismatch.expected}</b>에 맞춰 주세요.
            </>
          )
        }
        navLabel="🗂 DB관리로 이동"
        onNavigate={onMismatchNavigate}
        onClose={onMismatchClose}
      />

      {/* 2026-06-03 [교차탭1]: DB합과 일치 시 긍정 확인 (왕복 루프 중단) */}
      {dbMatchOk && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
          onClick={onMatchOkClose}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-black text-gray-900">
              ✅ DB관리와 일치합니다
            </h3>
            <div className="mb-4 text-sm leading-relaxed text-gray-700">
              <b>{dbMatchOk.channel}</b> 생산 <b>{dbMatchOk.count}</b>건이 DB관리 시트와
              정확히 맞아요. 이대로 저장됐으니 더 하실 일은 없습니다.
            </div>
            <button
              type="button"
              onClick={onMatchOkClose}
              className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {pickerMeetings && (
        <MeetingPickerModal
          meetings={pickerMeetings}
          onPick={onPick}
          onClose={onPickerClose}
        />
      )}
    </>
  );
}
