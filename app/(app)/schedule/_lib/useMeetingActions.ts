/**
 * 일정·계약 탭 미팅 동작(변경·되돌리기·추가 미팅·삭제·케이스 되살리기) — page.tsx 에서 옮김(주간 보드 추가로 500줄 넘김, 2026-11-11).
 * weekStart = 지금 보이는 7일 조회 키(금~목이면 금, 월~일이면 월) — 저장 뒤 그 주 목록을 다시 읽는다.
 */
import type { Meeting } from "@/types";
import { useAppendMeeting, usePatchMeeting, useRemoveMeeting, useRevertMeeting, useReviveCaseClosure } from "@/query/contact-hooks";
import type { useMeetingDeleteConfirm } from "@/components/meeting-safety/use-meeting-delete-confirm";
import { fmtISO } from "./week";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useMeetingActions({ weekStart, setPendingId, showToast, deleteConfirm }: {
  weekStart: string;
  setPendingId: (id: string | null) => void;
  showToast: (msg: string) => void;
  deleteConfirm: ReturnType<typeof useMeetingDeleteConfirm>;
}) {
  const patchMeeting = usePatchMeeting();
  const appendMeeting = useAppendMeeting();
  const removeMeeting = useRemoveMeeting();
  const revertMeeting = useRevertMeeting();
  const reviveCaseClosure = useReviveCaseClosure();

  /**
   * 일정 변경 트랜잭션:
   *  1) 새 미팅 row append (id=uuid, 모든 필드 복사 + 새 미팅날짜/시간
   *     + 상태="예약" + previousMeetingId=원본 id)
   *  2) 원본 미팅 patch (상태="변경" + 미팅사유=변경사유)
   *
   * append 성공 후에만 patch 시도. patch 실패 시 안내(시트에 두 row 모두 "예약"
   * 상태로 남아있어 사용자 manual fix 필요).
   */
  const handleReschedule = async (
    original: Meeting,
    newDate: string,
    newTime: string,
    reason: string,
  ) => {
    setPendingId(original.id);
    const newId = uuid();
    // 변경 미팅은 업체명 앞에 "(변경) " prefix를 붙여 한눈에 식별 가능하게 함.
    // 이미 한 번 변경된 카드(이미 prefix 있음)는 중복 추가 방지.
    const prefixedName = original.업체명.startsWith("(변경)")
      ? original.업체명
      : `(변경) ${original.업체명}`;
    const newMeeting: Meeting = {
      ...original,
      id: newId,
      업체명: prefixedName,
      미팅날짜: newDate,
      미팅시간: newTime,
      상태: "예약",
      계약여부: false,
      수임비: 0,
      미팅사유: "",
      계약조건: "",
      previousMeetingId: original.id,
      // 시트 수식 컬럼은 자동 — 보내지 않음
      표시상세: undefined,
      표시요약: undefined,
      계약합성라인: undefined,
      주차: undefined,
    };
    try {
      await appendMeeting.mutateAsync({
        date: original.예약일, // 컨택탭 day-key invalidate
        meeting: newMeeting,
      });
      try {
        // 미팅사유 누적: 기존이 있으면 회차 prefix 추가
        const prev = (original.미팅사유 ?? "").trim();
        const trimmed = reason.trim();
        const accumulated =
          !trimmed
            ? prev
            : !prev
              ? trimmed
              : `${prev}\n${prev.split("\n").length + 1}회차: ${trimmed}`;
        await patchMeeting.mutateAsync({
          date: "",
          weekStart,
          id: original.id,
          partial: { 상태: "변경", 미팅사유: accumulated },
        });
        showToast("✓ 일정 변경 완료");
      } catch (e) {
        showToast(
          `⚠ 새 미팅은 추가됐으나 원본 표시 실패: ${(e as Error).message} — 시트에서 직접 원본 행 J열 "변경"으로 수정 필요`,
        );
      }
    } catch (e) {
      showToast(`변경 실패 (새 미팅 추가 안 됨): ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /**
   * 미팅 결과 되돌리기 (2026-05-17 [2a]).
   * 서버에서 상태별 cascade 처리 후 응답에서 cascade 요약 받아 토스트.
   */
  const handleRevert = async (id: string) => {
    setPendingId(id);
    try {
      const result = await revertMeeting.mutateAsync({ id, weekStart });
      showToast(`✓ 되돌림 (${result.status}) — ${result.cascade}`);
    } catch (e) {
      showToast(`되돌리기 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /**
   * 추가 미팅 (2026-05-17 [2b], 2026-05-19 갱신).
   * 완료/취소/계약 카드에서 같은 업체로 새 미팅 row append.
   * 채널/장소/예약비고 동일, 새 id, 상태=예약, **previousMeetingId=원본 id**.
   * → 원본 카드는 "케이스 종료" 표시 + 추가미팅 버튼 hide (자식 1건만 허용).
   */
  const handleAddMeeting = async (
    base: Meeting,
    newDate: string,
    newTime: string,
  ) => {
    setPendingId(base.id);
    const newId = uuid();
    // 업체명에서 "(변경)" prefix 가 있으면 제거 (추가 미팅은 변경 흐름 아님).
    const cleanVendor = base.업체명.replace(/^\(변경\)\s*/, "");
    const todayISO = fmtISO(new Date());
    const newMeeting: Meeting = {
      ...base,
      id: newId,
      예약일: todayISO,
      예약시각: new Date().toTimeString().slice(0, 5),
      업체명: cleanVendor,
      미팅날짜: newDate,
      미팅시간: newTime,
      상태: "예약",
      계약여부: false,
      수임비: 0,
      미팅사유: "",
      계약조건: "",
      previousMeetingId: base.id, // 2026-05-19: 원본 → 새 미팅 체인 (케이스 종료 표시)
      표시상세: undefined,
      표시요약: undefined,
      계약합성라인: undefined,
      주차: undefined,
    };
    try {
      await appendMeeting.mutateAsync({
        date: newMeeting.예약일,
        meeting: newMeeting,
      });
      showToast(`✓ 추가 미팅 생성: ${cleanVendor} ${newDate} ${newTime}`);
    } catch (e) {
      showToast(`추가 미팅 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /**
   * 일정 삭제 (2026-05-19) — 컨택탭 cascade 와 동일.
   * confirm: "함께 사라지는 것" 명시. cascade: 계약카드 (있으면) + 미팅카드.
   */
  const handleDelete = async (meeting: Meeting) => {
    const hasContract = meeting.상태 === "계약";
    if (!await deleteConfirm.request(meeting)) return;
    setPendingId(meeting.id);
    try {
      // DELETE 라우트가 cascade 처리 (PR #241). UI 측은 invalidate 만 의존.
      await removeMeeting.mutateAsync({
        date: meeting.예약일 || meeting.미팅날짜,
        id: meeting.id,
      });
      showToast(
        hasContract
          ? `✕ ${meeting.업체명} 미팅 + 계약카드 삭제`
          : `✕ ${meeting.업체명} 미팅 삭제`,
      );
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /** 케이스 종료 되살리기 (2026-05-19) — 자식 추가미팅 삭제. */
  const handleReviveCase = async (meeting: Meeting) => {
    if (
      !confirm(
        `'${meeting.업체명}' 케이스를 되살릴까요?\n\n자식 추가미팅 카드가 삭제됩니다 (계약 있었으면 계약카드도 함께 삭제).`,
      )
    )
      return;
    setPendingId(meeting.id);
    try {
      const result = await reviveCaseClosure.mutateAsync({
        id: meeting.id,
        weekStart,
      });
      showToast(`✓ 되살림 — ${result.cascade}`);
    } catch (e) {
      showToast(`되살리기 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  return { handleReschedule, handleRevert, handleAddMeeting, handleDelete, handleReviveCase };
}
