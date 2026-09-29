/**
 * React Query 훅 — 「영업기록 없이 추가」 업체 ↔ 미팅 연결(contract-meeting-link, 2026-09-29).
 * 연결되면 계약일·업체명(=할일·업체정보 키)이 바뀌므로 계약·할일·일정 캐시를 모두 다시 읽는다.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyInfo, Meeting } from "@/types";
import { cpKey } from "./contract-payment-hooks";

export type LinkableMeeting = Pick<Meeting, "id" | "미팅날짜" | "업체명" | "상태" | "수임비" | "channel">;

export interface MeetingLinkPreview {
  contract: { row: number; 계약일: string; 업체명: string; 수임비: number; 업체정보: CompanyInfo | null };
  meeting: { id: string; 미팅날짜: string; 업체명: string; 상태: string; 수임비: number; 업체정보: CompanyInfo | null };
  updatedAt: { contract: string | null; contractInfo: string | null; meeting: string | null };
}

async function fetchJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
  return data as T;
}

export function useLinkableMeetings(enabled: boolean) {
  return useQuery({
    queryKey: ["meetings", "linkable"],
    queryFn: () => fetchJSON<{ meetings: LinkableMeeting[] }>("/api/meetings/linkable"),
    enabled,
    staleTime: 0,
  });
}

export function fetchMeetingLinkPreview(row: number, meetingId: string): Promise<MeetingLinkPreview> {
  return fetchJSON<MeetingLinkPreview>(
    `/api/contract-payment/${row}/link-meeting?meetingId=${encodeURIComponent(meetingId)}`,
  );
}

export interface LinkMeetingArgs {
  row: number;
  meetingId: string;
  업체명: string;
  수임비: number;
  업체정보: Record<string, unknown>;
}

export function useLinkMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ row, ...body }: LinkMeetingArgs) =>
      fetchJSON<{ ok: true; row: number; failures: string[] }>(`/api/contract-payment/${row}/link-meeting`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      for (const key of [cpKey(), ["todos"], ["week"], ["month"], ["payments"], ["meetings"], ["dashboard"]]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
