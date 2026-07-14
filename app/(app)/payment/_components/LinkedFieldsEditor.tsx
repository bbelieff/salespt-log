/**
 * LinkedFieldsEditor — 계약 핵심필드(업체명·계약일·수임비) 수정(payment_contract_edit_toggle).
 *
 * 평소: **수정 진입 버튼만** (값 표시 X — 업체명·계약일·수임비는 카드 헤더가 이미 보여줌.
 * 중복 박스 제거 2026-07-14). 클릭 → 이 카드만 편집 모드(input + [저장]/[취소] + 연동 배지).
 * 저장 시 연결 미팅 id 로 대상 특정(개명 안전): 업체명→02 D+04 G+06 / 계약일→02 C만 / 수임비→02 E+04 L.
 * 편집 중 변경 있으면 DirtyGuard 등록. 변경 없으면 시트 쓰기 0. 일부 시트 실패 시 안내+save throw.
 */
"use client";

import { useState } from "react";
import type { ContractPayment } from "@/types";
import MoneyInput from "@/components/ui/MoneyInput";
import { useEditContractLinkedFields } from "@/query/contract-payment-hooks";
import { useDirtyEntry } from "@/components/DirtyGuard";


export default function LinkedFieldsEditor({ cp }: { cp: ContractPayment }) {
  const [editing, setEditing] = useState(false);
  const [업체명, set업체명] = useState(cp.업체명);
  const [계약일, set계약일] = useState(cp.계약일);
  const [수임비, set수임비] = useState(cp.수임비);
  const [msg, setMsg] = useState("");
  const edit = useEditContractLinkedFields();

  const dirty =
    editing &&
    (업체명 !== cp.업체명 || 계약일 !== cp.계약일 || 수임비 !== cp.수임비);

  const enterEdit = () => {
    set업체명(cp.업체명);
    set계약일(cp.계약일);
    set수임비(cp.수임비);
    setMsg("");
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setMsg("");
  };
  const save = async () => {
    if (!dirty) {
      setEditing(false); // 변경 없음 → 시트 쓰기 0, 읽기 모드 복귀
      return;
    }
    if (!업체명.trim()) {
      setMsg("업체명을 입력해주세요");
      throw new Error("업체명 비어있음");
    }
    const next: { 계약일?: string; 업체명?: string; 수임비?: number } = {};
    if (업체명 !== cp.업체명) next.업체명 = 업체명.trim();
    if (계약일 !== cp.계약일) next.계약일 = 계약일;
    if (수임비 !== cp.수임비) next.수임비 = 수임비;
    const res = await edit.mutateAsync({
      meetingId: cp.linkedMeetingId || undefined,
      old: { 계약일: cp.계약일, 업체명: cp.업체명 },
      next,
    });
    if (res.failures.length > 0) {
      setMsg(`일부 시트 반영 실패: ${res.failures.join(", ")} — 다시 시도해주세요`);
      throw new Error("partial-sync-failure");
    }
    setEditing(false); // 저장 성공 → 읽기 모드 복귀
  };

  useDirtyEntry(`cp-linked-${cp.row}`, dirty, save, cancel, `${cp.업체명 || "계약"} 계약정보`);

  // ── 읽기 모드 — 값은 카드 헤더(업체명·계약일·수임비)가 이미 표시. 중복 박스 제거하고
  //    수정 진입만 노출(카드 펼침 시). 헤더는 <button> 이라 그 안에 버튼 중첩 불가 → 본문 최상단.
  if (!editing) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={enterEdit}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          ✎ 계약정보 수정
        </button>
      </div>
    );
  }

  // ── 편집 모드 ──
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
          <label className={label}>고객사(업체명)</label>
          <input type="text" value={업체명} onChange={(e) => set업체명(e.target.value)} className={input} />
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
          <label className={label}>수임비 (원)</label>
          <MoneyInput
            value={수임비}
            onChange={set수임비}
            placeholder="5,000,000" /* 0 이면 빈칸이라 힌트 필수(기존 "0" 표시 대체) */
            className={`${input} num-mono`}
            aria-label="수임비"
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-tight text-gray-500">
        업체명·수임비는 일정·계약 미팅과 시트에 함께 반영돼요. 계약일은 이 계약카드에만 적용돼요
        (미팅 날짜·달력·주차 통계는 그대로).
      </p>
      {msg && <p className="mt-1.5 text-xs font-medium text-red-600">{msg}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={edit.isPending}
          className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void save().catch(() => {})}
          disabled={edit.isPending}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
        >
          {edit.isPending ? "저장 중…" : "저장 (연동 반영)"}
        </button>
      </div>
    </div>
  );
}
