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
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKey() }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKey() }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKey() }),
  });
}

export function useRemoveContractPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: number) =>
      fetchJSON<{ ok: true }>(`/api/contract-payment/${row}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cpKey() }),
  });
}
