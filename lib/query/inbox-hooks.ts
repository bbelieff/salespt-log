/** 비서 사서함 (belie 2026-10-26) — list and one report. Opening a report marks it read on the server. */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InboxEntry, InboxReport } from "@/types/push-report";

export interface InboxView { available: boolean; viewingOther: boolean; entries: InboxEntry[]; unread: number }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `inbox ${res.status}`), { status: res.status });
  return body as T;
}

export function useInbox(enabled = true) {
  return useQuery({
    queryKey: ["inbox"],
    queryFn: () => fetch("/api/inbox", { cache: "no-store" }).then(r => json<InboxView>(r)),
    enabled, staleTime: 60_000, refetchOnWindowFocus: true, retry: 1,
  });
}

export function useInboxReport(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["inbox", id],
    queryFn: async () => {
      const body = await fetch(`/api/inbox/${encodeURIComponent(id)}`, { cache: "no-store" }).then(r => json<{ report: InboxReport }>(r));
      // The server marked it read — refresh the list and the menu dot.
      if (!body.report.readAt) void qc.invalidateQueries({ queryKey: ["inbox"], exact: true });
      return body;
    },
    retry: 1,
  });
}
