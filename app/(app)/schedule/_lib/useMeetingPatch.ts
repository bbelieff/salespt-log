"use client";
/**
 * 미팅 저장(계약·완료·취소·내용 고침) — 일정·계약 탭 page.tsx 에서 그대로 옮김(2026-11-12).
 * 캘린더 한 달 보드도 같은 함수를 쓴다. 계약 저장 시 02 장부 행 보장 규칙 = ./contract-fanout.ts
 * weekStart = 저장 뒤 다시 읽을 주(일정·계약 탭의 보이는 7일 키). findMeeting = patch 전 미팅(장부 중복 방지에 필요).
 */
import type { Meeting } from "@/types";
import { usePatchMeeting } from "@/query/contact-hooks";
import { useAddContractPayment, useSyncContractFee } from "@/query/contract-payment-hooks";
import { decideContractFanout } from "./contract-fanout";
import type { useManualLinkPrompt } from "./use-manual-link-prompt";

export function useMeetingPatch({ weekStart, findMeeting, setPendingId, showToast, manualLink }: {
  weekStart: string;
  findMeeting: (id: string) => Meeting | undefined;
  setPendingId: (id: string | null) => void;
  showToast: (msg: string) => void;
  manualLink: Pick<ReturnType<typeof useManualLinkPrompt>, "ask">;
}) {
  const patchMeeting = usePatchMeeting();
  const addContractPayment = useAddContractPayment();
  const syncContractFee = useSyncContractFee();

  const handlePatch = async (
    id: string,
    partial: Partial<Omit<Meeting, "id">>,
    opts?: { quiet?: boolean },
  ) => {
    // quiet(자동 저장): 루틴 성공 토스트 없음 + 실패는 throw 로 큐에 전달.
    const say = (msg: string) => {
      if (!opts?.quiet) showToast(msg);
    };
    setPendingId(id);
    try {
      // patch 전에 현재 미팅 상태를 lookup — fan-out 중복 방지에 필요.
      // (예약→계약 전환에만 새 row 생성, 계약→계약 수정 시는 skip)
      const prevMeeting = findMeeting(id);
      const wasAlreadyContract = prevMeeting?.상태 === "계약";

      await patchMeeting.mutateAsync({
        date: "", // 일정·계약 탭에선 day-key 무관
        weekStart,
        id,
        partial,
      });

      // Fan-out: 계약 저장 시 02 장부 행 보장. ⚠️ 매출이 사라졌던 자리다
      // (2026-09-01 · 10기 문병규 ₩1,100,000). 규칙·근거 = ./_lib/contract-fanout.ts
      const fanout = decideContractFanout(partial, prevMeeting);
      if (fanout.kind === "blocked") {
        say(
          "⚠ 계약 상태는 저장됐지만 계약 정보를 읽지 못해 장부에 넣지 못했어요. 새로고침 후 이 카드를 다시 계약으로 저장해 주세요.",
        );
        return;
      }
      if (fanout.kind === "run") {
        const payload = fanout.payload;
        if (!wasAlreadyContract && (await manualLink.ask(id, payload.업체명)) === "linked") return say("✓ 계약 확정 + 기존 업체와 연결됨");
        try {
          await addContractPayment.mutateAsync(payload);
          say("✓ 계약 확정 + 계약수납 row 생성됨");
        } catch {
          // 일시적 실패(네트워크·쿼터)로 매출이 사라지지 않게 한 번 더. 멱등이라 안전.
          try {
            await addContractPayment.mutateAsync(payload);
            say("✓ 계약 확정 + 계약수납 row 생성됨 (재시도 성공)");
          } catch (e) {
            say(
              `⚠ 계약 상태는 저장됐지만 장부에 넣지 못했어요: ${(e as Error).message} — 이 카드를 다시 계약으로 저장하면 채워져요.`,
            );
            return;
          }
        }
      } else if (
        wasAlreadyContract &&
        partial.수임비 !== undefined &&
        prevMeeting &&
        partial.수임비 !== prevMeeting.수임비
      ) {
        // 이미 계약 상태인 카드의 수임비가 변경된 경우 →
        // 02 계약수납관리 매칭 row(E열)도 sync update.
        try {
          const result = await syncContractFee.mutateAsync({
            계약일: prevMeeting.미팅날짜,
            업체명: prevMeeting.업체명,
            수임비: partial.수임비,
          });
          say(
            result.synced
              ? "✓ 저장 완료 + 계약수납 수임비 sync"
              : "✓ 저장 완료 (계약수납 매칭 row 없음 — 시트에서 수동 확인)",
          );
        } catch (e) {
          say(
            `⚠ 미팅은 저장됐으나 계약수납 sync 실패: ${(e as Error).message}`,
          );
        }
      } else {
        say("✓ 저장 완료");
      }
    } catch (e) {
      say(`저장 실패: ${(e as Error).message}`);
      if (opts?.quiet) throw e; // 자동 저장 큐가 실패로 인식해 초안 유지+재시도
    } finally {
      setPendingId(null);
    }
  };

  return handlePatch;
}
