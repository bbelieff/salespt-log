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
    const cur = ciRef.current;
    if (!cur.touched || !cur.draft) {
      setCiState((s) => ({ ...s, saving: false }));
      return;
    }
    const seq = cur.seq;
    const attempt = cur.draft;
    setCiState({ saving: true, error: null });
    try {
      const key = keyRef.current();
      const res = await fetch("/api/company-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 계약일: key.계약일, 업체명: key.업체명, 업체정보: attempt }),
      }).catch(() => null);
      if (!res?.ok) throw new Error("업체정보를 저장하지 못했어요");
      if (!mounted.current) return;
      if (ciRef.current.seq === seq) {
        ciRef.current.touched = false;
        setCiState({ saving: false, error: null });
      } else {
        setCiState((s) => ({ ...s, saving: false }));
      }
    } catch (e) {
      if (mounted.current) {
        setCiState({ saving: false, error: e instanceof Error ? e.message : "저장 실패" });
      }
      if (throwing) throw e;
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
