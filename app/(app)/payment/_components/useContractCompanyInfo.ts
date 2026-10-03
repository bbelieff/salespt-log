/**
 * useContractCompanyInfo — 계약 카드의 업체정보(04·06) 디바운스 영속화.
 * 계약 PATCH 와 별도 키(계약일|업체명 POST) — 직렬 저장, 실패 시 초안 유지+재시도.
 * ContractRow 500줄 캡 분리.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyInfo } from "@/types";

export type ContractCompanyInfoTarget = Readonly<{
  계약일: string;
  업체명: string;
}>;

type PendingDraft = {
  id: number;
  target: ContractCompanyInfoTarget;
  draft: CompanyInfo;
  request?: Promise<void>;
};

// 상세가 닫힌 직후 요청이 실패해도 같은 계약을 다시 열면 미저장 초안을 복구한다.
// 성공 ACK 또는 명시적 파기 때만 제거한다. 실제 영속화는 각 훅의 단일 직렬 writer가 담당한다.
const pendingByTarget = new Map<string, PendingDraft>();
let nextPendingId = 1;

const targetKey = (target: ContractCompanyInfoTarget) =>
  `${target.계약일}\u0000${target.업체명}`;

export function useContractCompanyInfo(target: ContractCompanyInfoTarget) {
  const targetRef = useRef(target);
  targetRef.current = target;
  const initialPendingRef = useRef(pendingByTarget.get(targetKey(target)));
  const ciRef = useRef<PendingDraft | undefined>(initialPendingRef.current);
  const [ciState, setCiState] = useState({
    saving: Boolean(initialPendingRef.current?.request),
    error: initialPendingRef.current && !initialPendingRef.current.request
      ? "저장되지 않은 업체정보가 있어요. 다시 시도해주세요"
      : null as string | null,
  });
  const ciTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const flushRef = useRef<(throwing: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    mounted.current = true;
    // 직전 인스턴스의 cleanup 요청이 아직 진행 중이면 새 인스턴스도 같은 Promise를
    // 기다려 상태를 수렴시킨다. 별도 POST는 만들지 않는다.
    if (initialPendingRef.current?.request) void flushRef.current(false).catch(() => undefined);
    return () => {
      mounted.current = false;
      if (ciTimer.current) {
        clearTimeout(ciTimer.current);
        ciTimer.current = null;
      }
      // 화면 전환/모바일 상세 닫기에서도 마지막 draft를 즉시 보낸다.
      void flushRef.current(false).catch(() => undefined);
    };
  }, []);

  const flushCi = async (throwing: boolean) => {
    if (ciTimer.current) {
      clearTimeout(ciTimer.current);
      ciTimer.current = null;
    }
    if (inFlight.current) {
      try {
        await inFlight.current;
      } catch (error) {
        if (throwing) throw error;
        return;
      }
      // 저장하고 이동은 앞 요청 실패 뒤 남은 초안을 명시적으로 재시도한다.
      if (throwing && ciRef.current) await flushCi(true);
      return;
    }

    const run = async () => {
      while (true) {
        const attempt = ciRef.current;
        if (!attempt) {
          if (mounted.current) setCiState((state) => ({ ...state, saving: false }));
          return;
        }
        if (mounted.current) setCiState({ saving: true, error: null });
        try {
          if (attempt.request) {
            await attempt.request;
          } else {
            const request = (async () => {
              const res = await fetch("/api/company-info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  계약일: attempt.target.계약일,
                  업체명: attempt.target.업체명,
                  업체정보: attempt.draft,
                }),
              }).catch(() => null);
              if (!res?.ok) throw new Error("업체정보를 저장하지 못했어요");
            })();
            attempt.request = request;
            try {
              await request;
            } finally {
              if (attempt.request === request) attempt.request = undefined;
            }
          }
        } catch (error) {
          if (mounted.current) {
            setCiState({
              saving: false,
              error: error instanceof Error ? error.message : "저장 실패",
            });
          }
          if (throwing) throw error;
          return;
        }

        const cached = pendingByTarget.get(targetKey(attempt.target));
        if (cached?.id === attempt.id) pendingByTarget.delete(targetKey(attempt.target));
        if (ciRef.current?.id === attempt.id) {
          ciRef.current = undefined;
          if (mounted.current) setCiState({ saving: false, error: null });
          return;
        }
        // 입력이 비행 중 바뀌었다. 언마운트 뒤에도 최신 snapshot을 다음에 직렬 전송한다.
      }
    };
    const active = run();
    inFlight.current = active;
    try {
      await active;
    } finally {
      if (inFlight.current === active) inFlight.current = null;
    }
  };
  flushRef.current = flushCi;

  const onCiChange = (draft: CompanyInfo) => {
    const frozenTarget = {
      계약일: targetRef.current.계약일,
      업체명: targetRef.current.업체명,
    };
    const pending = { id: nextPendingId++, target: frozenTarget, draft };
    ciRef.current = pending;
    pendingByTarget.set(targetKey(frozenTarget), pending);
    setCiState({ saving: true, error: null });
    if (ciTimer.current) clearTimeout(ciTimer.current);
    ciTimer.current = setTimeout(() => void flushCi(false), 800);
  };

  const resetCi = () => {
    if (ciTimer.current) {
      clearTimeout(ciTimer.current);
      ciTimer.current = null;
    }
    const pending = ciRef.current;
    if (pending) {
      const cached = pendingByTarget.get(targetKey(pending.target));
      if (cached?.id === pending.id) pendingByTarget.delete(targetKey(pending.target));
    }
    ciRef.current = undefined;
    setCiState({ saving: false, error: null });
  };

  return {
    ciDirty: Boolean(ciRef.current),
    ciDraft: ciRef.current?.draft,
    ciState,
    flushCi,
    onCiChange,
    resetCi,
  };
}
