"use client";
/**
 * 첫걸음 기억과 「수강생 본인 화면인지」.
 * 2차(2026-11-11): 계정별 저장(/api/first-steps, DB first_steps) — 폰·PC 공통. 표가 아직 없거나 서버가 실패하면
 * 1차처럼 이 브라우저(localStorage, 계정별 키)만 쓴다. 서버에 줄이 없고 브라우저 기억이 있으면 한 번 올린다.
 * 끝났는지 판정은 실제 기록(@/util/first-steps)이라 저장이 비어도 이미 한 단계는 다시 안 뜬다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/query/me-hook";
import type { FirstStepsState } from "@/types";
import {
  EMPTY_FIRST_STEPS_MEMORY,
  firstStepsStorageKey,
  parseFirstStepsMemory,
  type FirstStepKey,
  type FirstStepsMemory,
} from "@/util/first-steps";

const CHANGE_EVENT = "salespt-first-steps-change";
const QUERY_KEY = ["first-steps"] as const;
type ServerView = { ok: true; state: FirstStepsState | null } | { ok: false };

async function fetchServer(): Promise<ServerView> {
  try {
    const res = await fetch("/api/first-steps");
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { state?: FirstStepsState | null };
    return { ok: true, state: body.state ?? null };
  } catch {
    return { ok: false };
  }
}

function putServer(state: FirstStepsState) {
  void fetch("/api/first-steps", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) }).catch(() => {});
}

const isEmpty = (m: FirstStepsMemory) => !m.hidden && !m.reviewSeen && !m.never.length && !m.finished.length;

export function useFirstSteps() {
  const me = useMe();
  const qc = useQueryClient();
  const email = me.data?.sessionEmail || me.data?.email || "";
  // 관리자·트레이너가 수강생 화면을 대신 볼 때, 트레이너 본인 화면에서는 띄우지 않는다.
  const isTraineeSelf = !!me.data && me.data.sessionRole === "trainee" && !me.data.impersonating && !!email;
  const key = email ? firstStepsStorageKey(email) : "";
  const [local, setLocal] = useState<FirstStepsMemory>(EMPTY_FIRST_STEPS_MEMORY);
  const server = useQuery({ queryKey: QUERY_KEY, queryFn: fetchServer, enabled: isTraineeSelf, staleTime: 5 * 60_000, meta: { background: true } });
  const uploaded = useRef(false);

  useEffect(() => {
    if (!key) return;
    const load = () => {
      try {
        setLocal(parseFirstStepsMemory(localStorage.getItem(key)));
      } catch {
        setLocal(EMPTY_FIRST_STEPS_MEMORY);
      }
    };
    load();
    window.addEventListener(CHANGE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CHANGE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [key]);

  const serverState = server.data?.ok ? server.data.state : null;
  const memory: FirstStepsMemory = serverState ? (serverState.memory as FirstStepsMemory) : local;
  // 같은 순간 두 번 고쳐도(예: 첫 판정 + 끝낸 안내 기록) 앞 수정을 덮지 않게 가장 최근 값을 따로 들고 있는다.
  const latest = useRef(memory);
  latest.current = memory;
  const done = useMemo(() => (serverState?.done ?? []) as FirstStepKey[], [serverState]);

  // 서버에 줄이 없는데 이 브라우저에 1차 기억이 있으면 한 번 올린다.
  useEffect(() => {
    if (uploaded.current || !server.data?.ok || server.data.state || isEmpty(local)) return;
    uploaded.current = true;
    const state: FirstStepsState = { memory: local, done: [] };
    qc.setQueryData<ServerView>(QUERY_KEY, { ok: true, state });
    putServer(state);
  }, [server.data, local, qc]);

  const save = useCallback(
    (nextMemory: FirstStepsMemory, nextDone: FirstStepKey[]) => {
      latest.current = nextMemory;
      setLocal(nextMemory);
      try {
        if (key) {
          localStorage.setItem(key, JSON.stringify(nextMemory));
          window.dispatchEvent(new Event(CHANGE_EVENT));
        }
      } catch {
        /* 사생활 보호 창 등 — 화면 상태만 바뀐다 */
      }
      const view = qc.getQueryData<ServerView>(QUERY_KEY);
      if (view?.ok) {
        const state: FirstStepsState = { memory: nextMemory, done: nextDone };
        qc.setQueryData<ServerView>(QUERY_KEY, { ok: true, state });
        putServer(state);
      }
    },
    [key, qc],
  );

  const update = useCallback(
    (fn: (m: FirstStepsMemory) => FirstStepsMemory) => save(fn(latest.current), done),
    [save, done],
  );

  /** 대시보드 카드가 계산한 끝낸 단계를 올린다(관리 화면 진행 표시용). 바뀌었을 때만. */
  const reportDone = useCallback(
    (keys: FirstStepKey[]) => {
      const view = qc.getQueryData<ServerView>(QUERY_KEY);
      if (!view?.ok) return;
      const before = [...(view.state?.done ?? [])].sort().join();
      if (before === [...keys].sort().join()) return;
      save(latest.current, keys);
    },
    [qc, save],
  );

  // 서버 기억을 받기 전에 제안 줄이 깜빡 떴다 사라지지 않게 기다린다.
  return { ready: !!me.data && (!isTraineeSelf || !server.isLoading), isTraineeSelf, memory, update, reportDone };
}
