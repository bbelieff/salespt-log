/**
 * Contact numeric metrics autosave wiring — channels-only POST, meeting
 * drafts and dirty cards untouched (no slot creation, no saveAllDirty).
 */
"use client";

import { useEffect, useRef } from "react";
import type { Channel } from "@/types";
import type { ChannelDailyRowMetrics } from "@/service";
import type { useSaveMetrics } from "@/query/contact-hooks";
import { useAutosave } from "@/components/autosave/useAutosave";
import { EMPTY_BY_CHANNEL } from "./contactDefaults";
import { isMetricsOnlyPayload, metricsSavePayload } from "./metrics-autosave";

interface Deps {
  date: string;
  /** Server snapshot for the visible date (undefined while loading). */
  serverChannels: Record<Channel, ChannelDailyRowMetrics> | undefined;
  saveMetrics: ReturnType<typeof useSaveMetrics>;
  onProductionHold: () => void;
}

export function useContactMetrics(deps: Deps) {
  const latest = useRef(deps);
  latest.current = deps;
  const metrics = useAutosave<Record<Channel, ChannelDailyRowMetrics>>({
    target: { kind: "contact-metrics", date: deps.date },
    initial: EMPTY_BY_CHANNEL(),
    delayMs: 800,
    save: async ({ target, payload }) => {
      const { saveMetrics, onProductionHold } = latest.current;
      const channels = metricsSavePayload(payload);
      if (!isMetricsOnlyPayload(channels)) throw new Error("입력을 확인해 주세요.");
      const res = await saveMetrics.mutateAsync({
        date: target.date as string,
        channels,
      });
      if (res?.directProductionHold) onProductionHold();
    },
  });

  // Server snapshot merge — content-keyed so identical snapshots never reset
  // a scheduled debounce; unsent edits are kept, clean drafts adopt.
  const lastKey = useRef("");
  const serverChannels = deps.serverChannels;
  useEffect(() => {
    if (!serverChannels) return;
    const key = JSON.stringify(serverChannels);
    if (key === lastKey.current) return;
    lastKey.current = key;
    metrics.syncServer(serverChannels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverChannels]);

  return metrics;
}
