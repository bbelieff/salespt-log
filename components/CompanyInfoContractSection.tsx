/**
 * CompanyInfoContractSection — payment 계약 카드의 업체정보 섹션.
 * 06 에서 read(GET /api/company-info) → CompanyInfoEditor → 저장 시 POST
 * (04 원본 + 06 동기화, consultation-log §3-1). 키 = (계약일, 업체명).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyInfo } from "@/types";
import CompanyInfoEditor from "./CompanyInfoEditor";

interface Props {
  계약일: string;
  업체명: string;
  /** true 면 자체 저장 버튼 숨김 — 영속화는 부모(계약 카드 파란 저장)가 담당(#411 통합저장). */
  hideSave?: boolean;
  desktopHeading?: boolean;
  /** PC 상세의 업체정보 열이 55% 이상일 때 업체·대표자 그룹을 병렬로 표시. */
  splitInline?: boolean;
  /** 편집 시 부모에 라이브 드래프트 전달. */
  onChange?: (ci: CompanyInfo) => void;
  /** 전환 중 저장 실패 뒤 복구할 미저장 초안. 현재 요청 target과 일치할 때만 표시한다. */
  pendingValue?: {
    target: { 계약일: string; 업체명: string };
    value: CompanyInfo;
  };
  /** 자동 저장 라우팅용 안정 레코드 신원(예: 계약 행키). 필수 — 개명 시 바뀌는
   * 업체명(가변 표시명)을 신원으로 쓰면 빠른 전환·개명 때 다른 레코드로 필드가
   * 전송되므로, 기존 행은 업체명 폴백을 쓰지 않는다. */
  identityKey: string;
}

export default function CompanyInfoContractSection({
  계약일,
  업체명,
  hideSave,
  desktopHeading,
  splitInline,
  onChange,
  pendingValue,
  identityKey,
}: Props) {
  const requestKey = `${계약일}\u0000${업체명}`;
  const pendingValueRef = useRef(pendingValue);
  pendingValueRef.current = pendingValue;
  const [load, setLoad] = useState<{
    key: string;
    status: "loading" | "ready" | "error";
    value?: CompanyInfo;
  }>({ key: "", status: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoad({ key: requestKey, status: "loading" });
    (async () => {
      try {
        const res = await fetch(
          `/api/company-info?계약일=${encodeURIComponent(계약일)}&업체명=${encodeURIComponent(업체명)}`,
        );
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("업체정보를 불러오지 못했어요");
        if (alive) {
          const pending = pendingValueRef.current;
          const pendingKey = pending
            ? `${pending.target.계약일}\u0000${pending.target.업체명}`
            : null;
          setLoad({
            key: requestKey,
            status: "ready",
            value: pendingKey === requestKey ? pending?.value : d.업체정보 ?? undefined,
          });
        }
      } catch {
        if (alive) setLoad({ key: requestKey, status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [계약일, 업체명, requestKey, retryToken]);

  async function save(ci: CompanyInfo) {
    setBusy(true);
    try {
      const res = await fetch("/api/company-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 계약일, 업체명, 업체정보: ci }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : "업체정보를 저장하지 못했어요");
      }
      setLoad({ key: requestKey, status: "ready", value: ci });
    } finally {
      setBusy(false);
    }
  }

  if (!계약일 || !업체명) return null;
  if (load.key !== requestKey || load.status === "loading")
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-400">
        🏢 업체정보 불러오는 중…
      </div>
    );
  if (load.status === "error")
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700" role="alert">
        <span>업체정보를 불러오지 못했어요</span>
        <button
          type="button"
          onClick={() => setRetryToken((value) => value + 1)}
          className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-1 font-semibold hover:bg-red-100"
        >
          다시 시도
        </button>
      </div>
    );
  // 요청 target이 바뀌면 에디터를 리마운트해 이전 target draft를 화면에서도 격리한다.
  // 저장 라우팅 신원은 계속 안정 identityKey이며, 실제 POST target은 부모 큐가 편집 시점에 고정한다.
  return (
    <CompanyInfoEditor
      key={`${identityKey}|${requestKey}|${load.value ? "y" : "n"}`}
      value={load.value}
      busy={busy}
      txtCompanyName={업체명}
      identityKey={identityKey}
      vaultTarget={{ 계약일, 업체명 }}
      defaultLayout="extended"
      hideSave={hideSave}
      desktopHeading={desktopHeading}
      splitInline={splitInline}
      onChange={onChange}
      onSave={save}
    />
  );
}
