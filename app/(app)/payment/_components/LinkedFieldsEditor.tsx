/**
 * LinkedFieldsEditor — 계약 핵심필드(업체명·계약일·수임료) 편집 (payment_edit_linked_fields).
 *
 * 저장 시 연결 미팅 id 로 대상 특정(개명 안전): 업체명→02 D+04 G+06 / 계약일→02 C만 / 수임료→02 E+04 L.
 * 자체 DirtyGuard 등록(미저장 이탈 가드). 일부 시트 실패 시 어느 시트인지 안내 + save throw(반쪽 침묵 금지).
 */
"use client";

import { useState } from "react";
import type { ContractPayment } from "@/types";
import { useEditContractLinkedFields } from "@/query/contract-payment-hooks";
import { useDirtyEntry } from "@/components/DirtyGuard";

const fmtComma = (n: number) => (n ? n.toLocaleString("en-US") : "");

export default function LinkedFieldsEditor({ cp }: { cp: ContractPayment }) {
  const [업체명, set업체명] = useState(cp.업체명);
  const [계약일, set계약일] = useState(cp.계약일);
  const [수임료, set수임료] = useState(cp.수임비);
  const [msg, setMsg] = useState("");
  const edit = useEditContractLinkedFields();

  const dirty = 업체명 !== cp.업체명 || 계약일 !== cp.계약일 || 수임료 !== cp.수임비;

  const save = async () => {
    if (!dirty) return;
    if (!업체명.trim()) {
      setMsg("업체명을 입력해주세요");
      throw new Error("업체명 비어있음");
    }
    const next: { 계약일?: string; 업체명?: string; 수임비?: number } = {};
    if (업체명 !== cp.업체명) next.업체명 = 업체명.trim();
    if (계약일 !== cp.계약일) next.계약일 = 계약일;
    if (수임료 !== cp.수임비) next.수임비 = 수임료;
    const res = await edit.mutateAsync({
      meetingId: cp.linkedMeetingId || undefined,
      old: { 계약일: cp.계약일, 업체명: cp.업체명 },
      next,
    });
    if (res.failures.length > 0) {
      setMsg(`일부 시트 반영 실패: ${res.failures.join(", ")} — 다시 시도해주세요`);
      throw new Error("partial-sync-failure");
    }
    setMsg("✅ 일정·계약·시트에 함께 반영했어요");
  };
  const discard = () => {
    set업체명(cp.업체명);
    set계약일(cp.계약일);
    set수임료(cp.수임비);
    setMsg("");
  };

  useDirtyEntry(`cp-linked-${cp.row}`, dirty, save, discard, `${cp.업체명 || "계약"} 계약정보`);

  const label = "mb-1 block text-xs font-medium text-gray-600";
  const input =
    "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
          🔗 일정·계약·시트 연동
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={label}>업체명</label>
          <input
            type="text"
            value={업체명}
            onChange={(e) => set업체명(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label}>계약일</label>
          <input
            type="date"
            value={계약일}
            onChange={(e) => set계약일(e.target.value)}
            className={`${input} appearance-none`}
          />
        </div>
        <div>
          <label className={label}>수임료 (원)</label>
          <input
            type="text"
            inputMode="numeric"
            value={fmtComma(수임료)}
            onChange={(e) => set수임료(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
            className={`${input} num-mono`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-tight text-gray-500">
        업체명·수임료는 일정·계약 미팅과 시트에 함께 반영돼요. 계약일은 이 계약카드에만 적용돼요
        (미팅 날짜·달력·주차 통계는 그대로).
      </p>
      {msg && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            msg.startsWith("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {msg}
        </p>
      )}
      <button
        type="button"
        onClick={() => void save().catch(() => {})}
        disabled={!dirty || edit.isPending}
        className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
      >
        {edit.isPending ? "저장 중…" : "계약정보 저장 (연동)"}
      </button>
    </div>
  );
}
