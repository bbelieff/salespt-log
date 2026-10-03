/**
 * useContractCompanyInfo — 계약 카드의 업체정보(04·06) 디바운스 영속화.
 * 계약 PATCH 와 별도 키(계약일|업체명 POST) — target별 최신 draft를 직렬 저장한다.
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
};

type OwnerQueue = {
  order: string[];
  drafts: Map<string, PendingDraft>;
  drain?: Promise<void>;
};

// 같은 row 인스턴스에서 계약 target이 바뀌어도 target별 draft와 순서를 보존한다.
// unmount/remount 사이에도 같은 owner queue를 공유해 진행 중 POST를 중복하지 않는다.
const queuesByOwner = new Map<string, OwnerQueue>();
let nextPendingId = 1;

const targetKey = (target: ContractCompanyInfoTarget) =>
  `${target.계약일}\u0000${target.업체명}`;

const emptyQueue = (): OwnerQueue => ({ order: [], drafts: new Map() });

function releaseOwnerQueueIfIdle(ownerKey: string, queue: OwnerQueue) {
  if (
    !queue.drain
    && queue.drafts.size === 0
    && queuesByOwner.get(ownerKey) === queue
  ) {
    queuesByOwner.delete(ownerKey);
  }
}

async function drainQueue(queue: OwnerQueue) {
  while (queue.order.length > 0) {
    const key = queue.order[0]!;
    const attempt = queue.drafts.get(key);
    if (!attempt) {
      queue.order.shift();
      continue;
    }
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

    const current = queue.drafts.get(key);
    if (current?.id === attempt.id) queue.drafts.delete(key);
    if (!queue.drafts.has(key)) queue.order.shift();
    // 같은 target이 비행 중 다시 편집됐으면 order를 유지하고 최신 draft를 다음에 보낸다.
  }
}

export function useContractCompanyInfo(
  ownerKey: string,
  target: ContractCompanyInfoTarget,
) {
  const targetRef = useRef(target);
  targetRef.current = target;
  const queueRef = useRef<OwnerQueue | null>(null);
  if (!queueRef.current) queueRef.current = queuesByOwner.get(ownerKey) ?? emptyQueue();
  const queue = queueRef.current;
  const initialPendingRef = useRef(queue.drafts.size > 0);
  const [ciState, setCiState] = useState({
    saving: Boolean(queue.drain),
    error: initialPendingRef.current && !queue.drain
      ? "저장되지 않은 업체정보가 있어요. 다시 시도해주세요"
      : null as string | null,
  });
  const ciTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const flushRef = useRef<(throwing: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    mounted.current = true;
    // 직전 인스턴스의 cleanup drain이 진행 중이면 같은 Promise를 기다려 UI만 수렴한다.
    if (queue.drain) void flushRef.current(false).catch(() => undefined);
    return () => {
      mounted.current = false;
      if (ciTimer.current) {
        clearTimeout(ciTimer.current);
        ciTimer.current = null;
      }
      void flushRef.current(false).catch(() => undefined);
    };
  }, [queue]);

  const flushCi = async (throwing: boolean) => {
    if (ciTimer.current) {
      clearTimeout(ciTimer.current);
      ciTimer.current = null;
    }
    if (mounted.current && queue.drafts.size > 0) {
      setCiState({ saving: true, error: null });
    }
    while (queue.drafts.size > 0) {
      const active = queue.drain ?? drainQueue(queue);
      queue.drain = active;
      try {
        await active;
      } catch (error) {
        if (queue.drain === active) queue.drain = undefined;
        releaseOwnerQueueIfIdle(ownerKey, queue);
        if (mounted.current) {
          setCiState({
            saving: false,
            error: error instanceof Error ? error.message : "저장 실패",
          });
        }
        if (throwing) throw error;
        return;
      }
      if (queue.drain === active) queue.drain = undefined;
      // drain 종료 직후 새 draft가 들어온 경계도 같은 flush에서 다시 직렬 처리한다.
    }
    releaseOwnerQueueIfIdle(ownerKey, queue);
    if (mounted.current) setCiState({ saving: false, error: null });
  };
  flushRef.current = flushCi;

  const onCiChange = (draft: CompanyInfo) => {
    const frozenTarget = {
      계약일: targetRef.current.계약일,
      업체명: targetRef.current.업체명,
    };
    const key = targetKey(frozenTarget);
    if (!queue.drafts.has(key)) queue.order.push(key);
    queue.drafts.set(key, { id: nextPendingId++, target: frozenTarget, draft });
    queuesByOwner.set(ownerKey, queue);
    setCiState({ saving: true, error: null });
    if (ciTimer.current) clearTimeout(ciTimer.current);
    ciTimer.current = setTimeout(() => void flushCi(false), 800);
  };

  const resetCi = () => {
    if (ciTimer.current) {
      clearTimeout(ciTimer.current);
      ciTimer.current = null;
    }
    queue.order.length = 0;
    queue.drafts.clear();
    releaseOwnerQueueIfIdle(ownerKey, queue);
    setCiState({ saving: false, error: null });
  };

  const current = queue.drafts.get(targetKey(target));
  return {
    ciDirty: queue.drafts.size > 0,
    ciPending: current ? { target: current.target, value: current.draft } : undefined,
    ciState,
    flushCi,
    onCiChange,
    resetCi,
  };
}
