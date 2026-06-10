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
}

export default function CompanyInfoContractSection({ 계약일, 업체명 }: Props) {
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
  return (
    <CompanyInfoEditor
      key={`${계약일}|${업체명}|${value ? "y" : "n"}`}
      value={value}
      busy={busy}
      onSave={save}
    />
  );
}
