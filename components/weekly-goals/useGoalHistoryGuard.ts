"use client";
import { useEffect } from "react";

/** The shared DirtyGuard covers links/reload; native SPA back/forward also needs confirmation. */
export function useGoalHistoryGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const url = window.location.href;
    const state = window.history.state;
    const onPop = (event: PopStateEvent) => {
      if (window.confirm("저장하지 않은 입력이 있어요. 버리고 이동할까요?")) return;
      // Restore before the router's bubbling listener can unmount the editor.
      event.stopImmediatePropagation();
      window.history.pushState(state, "", url);
    };
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, [dirty]);
}
