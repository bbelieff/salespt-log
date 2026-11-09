"use client";
/**
 * 지방세 납세증명용 도로명주소 검색 — 카카오(다음) 우편번호 서비스(키 없음, 무료).
 * CODEF 정부24 상품은 주소를 「도로명 + 건물번호」(예 세종대로 110) + 상세주소로 받는다(상품 문서 2026-11-09).
 * 검색 결과의 roadAddress 에서 도로명 뒤 건물번호까지를 road 로 잘라 쓴다.
 */
import { useState } from "react";
import { MapPin, X } from "lucide-react";
import type { SimpleAuthAddress } from "@/types/simple-auth";

const SCRIPT = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
type DaumResult = { roadAddress: string; roadname: string; buildingName?: string };
type DaumWindow = Window & { daum?: { Postcode: new (o: { oncomplete: (d: DaumResult) => void }) => { open: () => void } } };

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if ((window as DaumWindow).daum?.Postcode) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("주소 검색을 열지 못했어요.")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** 「서울 중구 세종대로 110」 + 도로명 「세종대로」 → 「세종대로 110」. */
export function roadPart(d: DaumResult): string {
  const at = d.roadname ? d.roadAddress.lastIndexOf(d.roadname) : -1;
  return (at >= 0 ? d.roadAddress.slice(at) : d.roadAddress).trim();
}

export default function AddressSearch({ id, value, onChange, invalid }: { id: string; value: SimpleAuthAddress | null; onChange: (v: SimpleAuthAddress | null) => void; invalid?: Record<string, unknown> }) {
  const [error, setError] = useState("");
  async function open() {
    setError("");
    try {
      await loadScript();
      const P = (window as DaumWindow).daum!.Postcode;
      new P({ oncomplete: (d) => onChange({ road: roadPart(d), detail: d.buildingName ?? "", full: d.roadAddress }) }).open();
    } catch (e) { setError(e instanceof Error ? e.message : "주소 검색을 열지 못했어요."); }
  }
  if (!value) return (
    <div className="mt-1">
      <button id={id} type="button" onClick={open} className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-base text-gray-500 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" {...invalid}>
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />도로명주소 검색
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-blue-500 bg-blue-50 px-3 py-2 text-base text-blue-800">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium" title={value.full}>{value.full || value.road}</span>
        <button type="button" onClick={() => onChange(null)} aria-label="주소 지우고 다시 찾기" className="rounded p-0.5 text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <input value={value.detail} onChange={(e) => onChange({ ...value, detail: e.target.value.slice(0, 100) })} placeholder="상세주소 (동·호수)" aria-label="상세주소"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none" />
    </div>
  );
}
