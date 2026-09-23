/**
 * CompanyInfoContractSection — payment 계약 카드의 업체정보 섹션.
 * 06 에서 read(GET /api/company-info) → CompanyInfoEditor → 저장 시 POST
 * (04 원본 + 06 동기화, consultation-log §3-1). 키 = (계약일, 업체명).
 */
"use client";

import { useEffect, useState } from "react";
import type { CompanyInfo } from "@/types";
import CompanyInfoEditor from "./CompanyInfoEditor";

interface Props {
  계약일: string;
  업체명: string;
  /** true 면 자체 저장 버튼 숨김 — 영속화는 부모(계약 카드 파란 저장)가 담당(#411 통합저장). */
  hideSave?: boolean;
  /** 편집 시 부모에 라이브 드래프트 전달. */
  onChange?: (ci: CompanyInfo) => void;
  /** 자동 저장 라우팅용 안정 레코드 신원(예: 계약 행키). 필수 — 개명 시 바뀌는
   * 업체명(가변 표시명)을 신원으로 쓰면 빠른 전환·개명 때 다른 레코드로 필드가
   * 전송되므로, 기존 행은 업체명 폴백을 쓰지 않는다. */
  identityKey: string;
}

export default function CompanyInfoContractSection({
  계약일,
  업체명,
  hideSave,
  onChange,
  identityKey,
}: Props) {
  const [value, setValue] = useState<CompanyInfo | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/company-info?계약일=${encodeURIComponent(계약일)}&업체명=${encodeURIComponent(업체명)}`,
        );
        const d = await res.json().catch(() => ({}));
        if (alive && res.ok) setValue(d.업체정보 ?? undefined);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [계약일, 업체명]);

  async function save(ci: CompanyInfo) {
    setBusy(true);
    try {
      const res = await fetch("/api/company-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 계약일, 업체명, 업체정보: ci }),
      });
      if (res.ok) setValue(ci);
    } finally {
      setBusy(false);
    }
  }

  if (!계약일 || !업체명) return null;
  if (!loaded)
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-400">
        🏢 업체정보 불러오는 중…
      </div>
    );
  // key 로 value 변경 시 에디터 draft 재초기화 (CompanyInfoEditor 는 mount 시 초기화).
  // identityKey 가 바뀌면 리마운트 — 이전 대상 진행분 전송 차단.
  // 업체명·계약일은 key·target 에 쓰지 않는다(가변 표시명 — 개명 시 신원 유지).
  return (
    <CompanyInfoEditor
      key={`${identityKey}|${value ? "y" : "n"}`}
      value={value}
      busy={busy}
      txtCompanyName={업체명}
      identityKey={identityKey}
      hideSave={hideSave}
      onChange={onChange}
      onSave={save}
    />
  );
}
