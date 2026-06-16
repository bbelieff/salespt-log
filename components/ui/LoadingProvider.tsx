/**
 * LoadingProvider — 전역 로딩 오버레이 상태 (loading-overlay).
 *
 * 노출 트리거 2가지 결합:
 *  (a) 명령형: useGlobalLoading().show("저장하고 있어요") / hide() — busy/loading 코드에서.
 *      show/hide 는 카운터(중첩 안전). 마지막 show 의 문구 사용.
 *  (b) react-query 자동: useIsMutating()>0 이면 자동 표시(문구 "저장하고 있어요").
 *      ※ useIsFetching 은 안 검(백그라운드 refetch 과노출 방지) — 페이지 최초 로딩은
 *        각 페이지가 명령형으로.
 * providers.tsx 에서 QueryClientProvider 안쪽에 1회 마운트(useIsMutating 필요).
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useIsMutating } from "@tanstack/react-query";
import LoadingOverlay from "./LoadingOverlay";

interface LoadingApi {
  show: (message?: string) => void;
  hide: () => void;
}

const LoadingContext = createContext<LoadingApi | null>(null);

const DEFAULT_LOAD = "불러오고 있어요";
const MUTATING_MSG = "저장하고 있어요";

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState(DEFAULT_LOAD);
  const isMutating = useIsMutating();

  const show = useCallback((msg: string = DEFAULT_LOAD) => {
    setMessage(msg);
    setCount((c) => c + 1);
  }, []);
  const hide = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  const api = useMemo<LoadingApi>(() => ({ show, hide }), [show, hide]);

  // 명령형(show) 우선 문구, 그 외 mutation 자동이면 "저장하고 있어요".
  const visible = count > 0 || isMutating > 0;
  const display = count > 0 ? message : MUTATING_MSG;

  return (
    <LoadingContext.Provider value={api}>
      {children}
      {visible && <LoadingOverlay message={display} />}
    </LoadingContext.Provider>
  );
}

/** 명령형 로딩 제어 — show(문구)/hide(). Provider 밖에서 부르면 no-op(안전). */
export function useGlobalLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  return ctx ?? { show: () => {}, hide: () => {} };
}
