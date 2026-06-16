/**
 * LoadingProvider — 전역 로딩 오버레이 (loading-overlay). **단일 소스**.
 *
 * React Query 전역 상태를 구독해 자동 표시(페이지별 수동 호출 없이 어디서나 일관):
 *  - 뮤테이션 진행(status==='pending') → 표시(쓰기/저장).
 *  - 쿼리 '초기 로딩'(status==='pending' && fetchStatus==='fetching', 즉 데이터 없음) → 표시.
 *    ※ 백그라운드 refetch(데이터 있음)·창 포커스 refetch 는 제외 → 깜빡임 방지.
 *  - 명령형 show()/hide(): React Query 밖 비동기(클레임 후 풀리로드 등)용 카운터.
 * 플리커 가드: show 150ms 디바운스(그 안에 끝나면 안 띄움) + 일단 뜨면 최소 350ms 유지.
 * 문구: 활성 mutation/query 의 meta.loadingMessage > 명령형 문구 > 기본(뮤테이션 저장/쿼리 불러오기).
 * providers.tsx 의 QueryClientProvider 안쪽에 1회 마운트.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import LoadingOverlay from "./LoadingOverlay";

interface LoadingApi {
  show: (message?: string) => void;
  hide: () => void;
}

const LoadingContext = createContext<LoadingApi | null>(null);

const DEFAULT_LOAD = "불러오고 있어요";
const MUTATING_MSG = "저장하고 있어요";
const SHOW_DELAY = 150; // 이 안에 끝나면 안 띄움(빠른 로드 깜빡임 방지)
const MIN_SHOW = 350; // 일단 뜨면 최소 유지(깜빡임 방지)

/** meta.loadingMessage(string) 추출 — 없으면 undefined. */
function metaMessage(meta: unknown): string | undefined {
  if (meta && typeof meta === "object" && "loadingMessage" in meta) {
    const m = (meta as { loadingMessage?: unknown }).loadingMessage;
    if (typeof m === "string" && m.trim()) return m;
  }
  return undefined;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // 명령형 카운터(+문구) — React Query 밖 비동기용.
  const [imp, setImp] = useState<{ count: number; message: string }>({
    count: 0,
    message: DEFAULT_LOAD,
  });
  // React Query 자동 집계(구독으로 갱신).
  const [rq, setRq] = useState<{ active: boolean; mutating: boolean; message?: string }>({
    active: false,
    mutating: false,
  });

  const show = useCallback(
    (message: string = DEFAULT_LOAD) =>
      setImp((s) => ({ count: s.count + 1, message })),
    [],
  );
  const hide = useCallback(
    () => setImp((s) => ({ ...s, count: Math.max(0, s.count - 1) })),
    [],
  );
  const api = useMemo<LoadingApi>(() => ({ show, hide }), [show, hide]);

  // 캐시 구독 — query/mutation 변경마다 집계 재계산.
  useEffect(() => {
    const qc = queryClient.getQueryCache();
    const mc = queryClient.getMutationCache();
    const recompute = () => {
      const mutations = mc.getAll().filter((m) => m.state.status === "pending");
      // 초기 로딩 쿼리 = 데이터 없음(pending) + 실제 fetching. refetch(success+fetching) 제외.
      const queries = qc
        .getAll()
        .filter(
          (q) =>
            q.state.status === "pending" && q.state.fetchStatus === "fetching",
        );
      const message =
        mutations.map((m) => metaMessage(m.meta)).find(Boolean) ??
        queries.map((q) => metaMessage(q.meta)).find(Boolean);
      setRq({
        active: mutations.length > 0 || queries.length > 0,
        mutating: mutations.length > 0,
        message,
      });
    };
    recompute();
    const unsubQ = qc.subscribe(recompute);
    const unsubM = mc.subscribe(recompute);
    return () => {
      unsubQ();
      unsubM();
    };
  }, [queryClient]);

  const active = imp.count > 0 || rq.active;
  const message =
    imp.count > 0
      ? imp.message
      : (rq.message ?? (rq.mutating ? MUTATING_MSG : DEFAULT_LOAD));

  // ── 디바운스 + 최소표시 플리커 가드 ──
  const [visible, setVisible] = useState(false);
  const [shownMessage, setShownMessage] = useState(DEFAULT_LOAD);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef(0);

  // 표시 중엔 현재 문구를 박제(페이드아웃 동안 기본문구로 안 튐).
  useEffect(() => {
    if (active) setShownMessage(message);
  }, [active, message]);

  useEffect(() => {
    if (active) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (!visible && !showTimer.current) {
        showTimer.current = setTimeout(() => {
          showTimer.current = null;
          shownAt.current = Date.now();
          setVisible(true);
        }, SHOW_DELAY);
      }
    } else {
      if (showTimer.current) {
        clearTimeout(showTimer.current); // 아직 표시 전 → 취소(깜빡임 방지)
        showTimer.current = null;
      }
      if (visible && !hideTimer.current) {
        const wait = Math.max(0, MIN_SHOW - (Date.now() - shownAt.current));
        hideTimer.current = setTimeout(() => {
          hideTimer.current = null;
          setVisible(false);
        }, wait);
      }
    }
  }, [active, visible]);

  // 언마운트 정리.
  useEffect(
    () => () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  return (
    <LoadingContext.Provider value={api}>
      {children}
      {visible && <LoadingOverlay message={shownMessage} />}
    </LoadingContext.Provider>
  );
}

/** 명령형 로딩 제어 — show(문구)/hide(). React Query 밖 비동기(풀리로드 등)용.
 *  Provider 밖에서 부르면 no-op(안전). */
export function useGlobalLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  return ctx ?? { show: () => {}, hide: () => {} };
}
