/**
 * React Query 훅 — 계약수납 (PR 11).
 *
 * 캐시: ['contract-payment']
 * mutation은 stateless (date/row를 args로) — race condition 방지.
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ContractPayment } from "@/types";
import { track, EVENTS } from "@/analytics";

export const cpKey = () => ["contract-payment"] as const;

async function fetchJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
    );
  }
  return data as T;
}

interface ListResponse {
  rows: ContractPayment[];
}

export function useContractPayments(): UseQueryResult<ListResponse> {
  return useQuery({
    queryKey: cpKey(),
    queryFn: () => fetchJSON<ListResponse>(`/api/contract-payment`),
    // BBE-242 처방4(2026-08-27) — lib/query/contact-hooks.ts useDay 주석 참고.
    gcTime: 10 * 60_000,
  });
}

export interface AddFromContractArgs {
  계약일: string;
  업체명: string;
  수임비: number;
}

/** 계약 액션 시 자동 호출 — row append (자동 연동 3필드만). */
export function useAddContractPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddFromContractArgs) =>
      fetchJSON<{ ok: true; row: number }>(`/api/contract-payment`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      track(EVENTS.CONTRACT_PAYMENT_ADDED);
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}

/** 이전(아레나 시작 전) 계약업체 직접 등록 — 02 직접 append + 구분=이월 (§A). */
export function useAddPriorContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cp: ContractPayment) =>
      fetchJSON<{ ok: true; row: number }>(`/api/contract-payment/prior`, {
        method: "POST",
        body: JSON.stringify(cp),
      }),
    onSuccess: () => {
      track(EVENTS.CONTRACT_PAYMENT_ADDED);
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}

/**
 * 이미 계약 상태인 미팅 카드의 수임비를 수정한 경우 호출.
 * (계약일+업체명) 매칭 row의 E열만 sync 업데이트. 매칭 없으면 synced: false.
 */
export function useSyncContractFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddFromContractArgs) =>
      fetchJSON<{ ok: true; synced: boolean; row?: number }>(
        `/api/contract-payment`,
        { method: "PATCH", body: JSON.stringify(data) },
      ),
    onSuccess: (res) => {
      track(EVENTS.CONTRACT_FEE_SYNCED, { synced: Boolean(res.synced) });
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}

export interface EditLinkedArgs {
  meetingId?: string;
  old: { 계약일: string; 업체명: string };
  next: { 계약일?: string; 업체명?: string; 수임비?: number };
}
/** 계약 핵심필드(업체명·계약일·수임료) 편집 — id 기반 02↔04↔06 양방향. failures=실패 시트명. */
export function useEditContractLinkedFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: EditLinkedArgs) =>
      fetchJSON<{ ok: boolean; failures: string[] }>(
        `/api/contract-payment/edit-linked`,
        { method: "POST", body: JSON.stringify(args) },
      ),
    onSuccess: () => {
      track(EVENTS.CONTRACT_PAYMENT_UPDATED);
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}

export interface PatchArgs {
  row: number;
  data: ContractPayment;
}

/** 사용자 입력 영역(F~AA) patch. */
export function usePatchContractPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ row, data }: PatchArgs) =>
      fetchJSON<{ ok: true }>(`/api/contract-payment/${row}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      track(EVENTS.CONTRACT_PAYMENT_UPDATED);
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}

/**
 * 수납 row 삭제. cascade=true 면 매칭 미팅 계약→예약 revert (2026-05-17 [3]).
 * 응답에 cascade 결과 + 매칭 미팅 식별자 포함.
 */
export interface RemoveArgs {
  row: number;
  cascade?: boolean;
}
export interface RemoveResponse {
  ok: true;
  cascade?: string;
  meetingId?: string | null;
  미팅날짜?: string | null;
}
/** 계약해지 (contract-termination) — 사유·반환액·숨김. 성공 시 목록 무효화. */
export interface TerminateArgs {
  row: number;
  사유: string;
  반환액: number;
  숨김: boolean;
}
export function useTerminateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ row, ...body }: TerminateArgs) =>
      fetchJSON<{ ok: true }>(`/api/contract-payment/${row}/terminate`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_res, { 숨김 }) => {
      track(EVENTS.CONTRACT_TERMINATED, { hidden: 숨김 });
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}

export function useRemoveContractPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ row, cascade }: RemoveArgs) => {
      const qs = cascade ? "?cascade=meeting" : "";
      return fetchJSON<RemoveResponse>(
        `/api/contract-payment/${row}${qs}`,
        { method: "DELETE" },
      );
    },
    onSuccess: (_res, { cascade }) => {
      track(EVENTS.CONTRACT_PAYMENT_REMOVED, { cascade: Boolean(cascade) });
      qc.invalidateQueries({ queryKey: cpKey() });
    },
  });
}
