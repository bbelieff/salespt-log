/**
 * useManualLinkPrompt — 일정·계약에서 미팅을 계약으로 바꿀 때, 같은 이름의 「영업기록 없이 추가」 업체가
 * 실무/수납에 있으면 "기존 업체와 연결할까요?" 를 묻는다(belie 2026-09-29, contract-meeting-link).
 * 연결 = 새 계약 행을 만들지 않는다(매출 이중계상 방지). [따로 등록] = 지금처럼 새 행.
 * 목록을 못 읽으면 묻지 않고 기존 흐름(새 행)으로 — 장부 누락보다 낫다.
 */
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import MeetingLinkDialog from "@/components/payment/MeetingLinkDialog";
import { cpKey } from "@/query/contract-payment-hooks";
import { isTerminatedContract, type ContractPayment } from "@/types";
import { isManualContractLink } from "@/util/contract-link";
import { sameCompanyName } from "@/util/record-merge";

type Outcome = "linked" | "skip";

export function useManualLinkPrompt() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<{ row: number; meetingId: string; done: (o: Outcome) => void } | null>(null);

  const ask = async (meetingId: string, 업체명: string): Promise<Outcome> => {
    let rows: ContractPayment[];
    try {
      rows = (
        await qc.fetchQuery({
          queryKey: cpKey(),
          queryFn: async () => (await fetch("/api/contract-payment")).json() as Promise<{ rows: ContractPayment[] }>,
          staleTime: 30_000,
        })
      ).rows;
    } catch {
      return "skip";
    }
    const cand = rows.find(
      (r) => r.row && isManualContractLink(r.linkedMeetingId) && !isTerminatedContract(r) && sameCompanyName(r.업체명, 업체명),
    );
    if (!cand?.row) return "skip";
    const row = cand.row;
    return new Promise<Outcome>((resolve) =>
      setOpen({ row, meetingId, done: (o) => { setOpen(null); resolve(o); } }),
    );
  };

  const element = open ? (
    <MeetingLinkDialog
      row={open.row}
      meetingId={open.meetingId}
      onClose={() => open.done("skip")}
      onSkip={() => open.done("skip")}
      onLinked={() => open.done("linked")}
    />
  ) : null;

  return { ask, element };
}
