/**
 * useContractCompanyInfo — 계약 카드의 업체정보(04·06) 디바운스 영속화.
 * 계약 PATCH 와 별도 키(계약일|업체명 POST) — 각 1회씩, 실패 시 초안 유지+재시도.
 * ContractRow 500줄 캡 분리.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyInfo } from "@/types";

export function useContractCompanyInfo(getKey: () => {
  계약일: string;
  업체명: string;
}) {
  const keyRef = useRef(getKey);
  keyRef.current = getKey;
  const ciRef = useRef<{ draft?: CompanyInfo; touched: boolean; seq: number }>({
    touched: false,
    seq: 0,
  });
  const [ciState, setCiState] = useState({
    saving: false,
    error: null as string | null,
  });
  const ciTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 동일 계약 키에는 POST 를 한 번에 하나만 보낸다. 늦은 이전 응답이 최신
  // payload 뒤에 서버값을 되돌릴 수 있으므로, 성공한 뒤 새 draft 가 있으면
  // 같은 실행 안에서 최신 snapshot 을 직렬 전송한다.
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (ciTimer.current) clearTimeout(ciTimer.current);
    };
  }, []);

  const flushCi = async (throwing: boolean) => {
    if (ciTimer.current) {
      clearTimeout(ciTimer.current);
      ciTimer.current = null;
    }
    if (inFlight.current) {
      await inFlight.current;
      // 저장하고 이동은 기존 비동기 실패를 그냥 통과하면 안 된다. 앞 요청이 실패해
      // 최신 draft 가 남아 있으면 여기서 명시적으로 다시 시도한다.
      if (throwing && ciRef.current.touched) await flushCi(true);
      return;
    }

    const run = async () => {
      while (true) {
        const cur = ciRef.current;
        if (!cur.touched || !cur.draft) {
          if (mounted.current) setCiState((s) => ({ ...s, saving: false }));
          return;
        }
        const seq = cur.seq;
        const attempt = cur.draft;
        if (mounted.current) setCiState({ saving: true, error: null });
        try {
          const key = keyRef.current();
          const res = await fetch("/api/company-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 계약일: key.계약일, 업체명: key.업체명, 업체정보: attempt }),
          }).catch(() => null);
          if (!res?.ok) throw new Error("업체정보를 저장하지 못했어요");
        } catch (e) {
          if (mounted.current) {
            setCiState({ saving: false, error: e instanceof Error ? e.message : "저장 실패" });
          }
          if (throwing) throw e;
          return;
        }

        if (!mounted.current) return;
        if (ciRef.current.seq === seq) {
          ciRef.current.touched = false;
          setCiState({ saving: false, error: null });
          return;
        }
        // 입력이 비행 중 바뀌었다. 이전 요청의 ACK 뒤에 최신값만 다음으로 보낸다.
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

  const onCiChange = (ci: CompanyInfo) => {
    ciRef.current = { draft: ci, touched: true, seq: ciRef.current.seq + 1 };
    setCiState((s) => ({ ...s, saving: true, error: null }));
    if (ciTimer.current) clearTimeout(ciTimer.current);
    ciTimer.current = setTimeout(() => void flushCi(false), 800);
  };

  const resetCi = () => {
    if (ciTimer.current) {
      clearTimeout(ciTimer.current);
      ciTimer.current = null;
    }
    ciRef.current = { draft: undefined, touched: false, seq: ciRef.current.seq + 1 };
    setCiState({ saving: false, error: null });
  };

  return {
    ciDirty: ciRef.current.touched,
    ciState,
    flushCi,
    onCiChange,
    resetCi,
  };
}
