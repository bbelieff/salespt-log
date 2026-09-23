/**
 * LinkedFieldsEditor — 계약 핵심필드(업체명·계약일·수임비) 자동 저장.
 *
 * 평소: 수정 진입 버튼만 (값 표시는 카드 헤더가 담당 — 중복 박스 제거).
 * 편집 중: 루틴 변경은 유효한 coherent 그룹 단위로 자동 영속화 —
 * 일반 저장/취소 버튼 없음. 저장 시 연결 미팅 id 로 대상 특정(개명 안전).
 * 편집 중 변경 있으면 DirtyGuard 등록. 일부 시트 실패 시 에러+재시도.
 *
 * 저장 코어: components/autosave (Scope A 공유) — 본 파일은 배선만.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { ContractPayment } from "@/types";
import MoneyInput from "@/components/ui/MoneyInput";
import { useEditContractLinkedFields } from "@/query/contract-payment-hooks";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { linkedNext } from "../_lib/payment-progress";

interface LinkedDraft {
  업체명: string;
  계약일: string;
  수임비: number;
}

const isValidDraft = (d: LinkedDraft): boolean =>
  d.업체명.trim() !== "" &&
  /^\d{4}-\d{2}-\d{2}$/.test(d.계약일) &&
  Number.isFinite(d.수임비) &&
  d.수임비 >= 0;

export default function LinkedFieldsEditor({ cp }: { cp: ContractPayment }) {
  const [editing, setEditing] = useState(false);
  const edit = useEditContractLinkedFields();
  const mutateRef = useRef(edit.mutateAsync);
  mutateRef.current = edit.mutateAsync;
  const meetingIdRef = useRef(cp.linkedMeetingId || undefined);
  meetingIdRef.current = cp.linkedMeetingId || undefined;
  const savedMirror = useRef<LinkedDraft>({ 업체명: cp.업체명, 계약일: cp.계약일, 수임비: cp.수임비 });

  const {
    draft,
    saved,
    status,
    error,
    dirty,
    savedAt,
    canUndo,
    update,
    stage,
    commit,
    syncServer,
    // C3: 공유 useAutosave.discard() — 큐 예약 취소 + draft=saved 강제(공유 코어 소유).
    discard,
    retry,
    flush,
    undo,
  } = useAutosave<LinkedDraft>({
    target: { kind: "contract-linked", row: cp.row },
    initial: { 업체명: cp.업체명, 계약일: cp.계약일, 수임비: cp.수임비 },
    delayMs: 600,
    save: async ({ payload }) => {
      const next = linkedNext(savedMirror.current, payload);
      if (Object.keys(next).length === 0) return;
      const base = savedMirror.current;
      const res = await mutateRef.current({
        meetingId: meetingIdRef.current,
        old: { 계약일: base.계약일, 업체명: base.업체명 },
        next,
      });
      if (res.failures.length > 0) {
        throw new Error(`일부 시트 반영 실패: ${res.failures.join(", ")}`);
      }
    },
  });
  savedMirror.current = saved;

  // 서버 정본 변경 — clean 일 때만 재기준, 편집 중 입력은 유지.
  // dirty 중 refetch 호출은 큐 예약분을 취소해 미전송분이 고착된다(공유 이슈, REPORT-C2).
  const cpKey = JSON.stringify({ a: cp.업체명, b: cp.계약일, c: cp.수임비 });
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    const p = JSON.parse(cpKey) as { a: string; b: string; c: number };
    syncServer({ 업체명: p.a, 계약일: p.b, 수임비: p.c });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpKey]);

  const setText = (next: LinkedDraft) =>
    update(next, { valid: isValidDraft(next), error: "업체명·계약일·수임비를 확인해주세요" });
  const commitGroup = () => commit(isValidDraft(draft), "업체명·계약일·수임비를 확인해주세요");
  const saving = edit.isPending || status === "pending";

  useDirtyEntry(
    `cp-linked-${cp.row}`,
    editing && dirty,
    async () => {
      if (!isValidDraft(draft)) throw new Error("업체명·계약일·수임비를 확인해주세요");
      commit(true);
      await flush();
    },
    // 파기는 큐 예약 취소 + draft=saved 강제인 discard() — syncServer(saved) 는
    // dirty draft 를 유지해 파기가 화면 초안을 되돌리지 못한다.
    () => discard(),
    `${cp.업체명 || "계약"} 계약정보`,
  );

  if (!editing) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          ✎ 계약정보 수정
        </button>
      </div>
    );
  }

  const label = "mb-1 block text-xs font-medium text-gray-600";
  const input =
    "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-3"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          commitGroup();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
          🔗 일정·계약·시트 연동
        </span>
        <span className="flex items-center gap-1.5">
          <AutosaveStatus
            status={saving && status !== "error" ? "pending" : status}
            error={error}
            savedAt={savedAt}
            onRetry={retry}
            canUndo={canUndo}
            onUndo={undo}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={dirty}
            title={dirty ? "저장되지 않은 변경이 있어요" : "접기"}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-400 hover:bg-white hover:text-gray-600 disabled:opacity-40"
          >
            접기
          </button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={label}>고객사(업체명)</label>
          <input
            type="text"
            value={draft.업체명}
            onChange={(e) => setText({ ...draft, 업체명: e.target.value })}
            className={input}
          />
        </div>
        <div>
          <label className={label}>계약일</label>
          <input
            type="date"
            value={draft.계약일}
            onChange={(e) => stage({ ...draft, 계약일: e.target.value })}
            className={`${input} appearance-none`}
          />
        </div>
        <div>
          <label className={label}>수임비 (원)</label>
          <MoneyInput
            value={draft.수임비}
            onChange={(v) => stage({ ...draft, 수임비: v })}
            placeholder="5,000,000"
            className={`${input} num-mono`}
            aria-label="수임비"
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-tight text-gray-500">
        업체명·수임비는 일정·계약 미팅과 시트에 함께 반영돼요. 계약일은 이 계약카드에만 적용돼요
        (미팅 날짜·달력·주차 통계는 그대로).
      </p>
    </div>
  );
}
