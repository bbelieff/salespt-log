"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContactScript, ContactScriptView } from "@/types";

export const contactScriptKey = () => ["contact-script"] as const;

async function call(method: "GET" | "PUT" | "DELETE", body?: ContactScript): Promise<ContactScriptView> {
  const response = await fetch("/api/contact-script", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || "대본을 불러오지 못했어요.");
  return json;
}

/** 내 컨택 대본 — 업체정보 팝업 「대본」이 연다. 한 번 읽으면 팝업을 다시 열 때 캐시를 쓴다. */
export function useContactScript(enabled: boolean) {
  return useQuery({ queryKey: contactScriptKey(), queryFn: () => call("GET"), enabled, staleTime: 30 * 60_000, retry: false });
}

/** 저장(value) 또는 기본 대본으로(null). 성공하면 캐시를 서버 값으로 바꾼다. */
export function useSaveContactScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: ContactScript | null) => (value ? call("PUT", value) : call("DELETE")),
    onSuccess: (view) => qc.setQueryData(contactScriptKey(), view),
  });
}
