/**
 * CompanyDocMemoExtras — 「문서로 자동입력」에서 미팅 메모를 읽었을 때만 나오는 두 가지.
 * 1) 계정 보관함으로 보낼 항목(기본 체크) — 값은 가려서 보여 준다.
 * 2) 칸에 안 맞는 나머지 메모를 업체 기타메모에 붙일지(기본 꺼짐 — belie 2026-10-08).
 */
"use client";

import type { VaultItem } from "@/types/company-vault";

const KIND: Record<VaultItem["kind"], string> = { login: "계정", bank: "계좌", rrn: "주민번호", other: "기타" };

const mask = (s: string) => (s ? `${s.slice(0, 2)}${"•".repeat(Math.min(6, Math.max(2, s.length - 2)))}` : "");

interface Props {
  vault: VaultItem[];
  vaultOn: boolean[];
  onVault: (i: number, on: boolean) => void;
  leftover: string;
  leftoverOn: boolean;
  onLeftover: (on: boolean) => void;
}

export default function CompanyDocMemoExtras({ vault, vaultOn, onVault, leftover, leftoverOn, onLeftover }: Props) {
  if (vault.length === 0 && !leftover) return null;
  return (
    <div className="mt-3 space-y-2">
      {vault.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 text-xs">
          <p className="font-bold text-emerald-800">계정 보관함으로 보낼 항목</p>
          <p className="mb-1 text-gray-500">적용하면 업체정보 아래 「계정 보관함」에 들어가요. 잠겨 있으면 PIN을 넣을 때 들어가요.</p>
          <ul className="space-y-1">
            {vault.map((v, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5">
                  <input type="checkbox" checked={vaultOn[i] ?? true} onChange={(e) => onVault(i, e.target.checked)} />
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-emerald-800">{KIND[v.kind]}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{v.label || KIND[v.kind]}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {v.id && `${v.id} · `}
                    {mask(v.secret)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {leftover && (
        <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 text-xs">
          <input type="checkbox" className="mt-0.5" checked={leftoverOn} onChange={(e) => onLeftover(e.target.checked)} />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-gray-800">나머지 메모를 업체 기타메모에 붙이기</span>
            <span className="mt-0.5 line-clamp-3 block whitespace-pre-line text-gray-500">{leftover}</span>
          </span>
        </label>
      )}
    </div>
  );
}
