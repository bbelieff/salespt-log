/**
 * 「영업기록 없이 업체추가」(payment-standalone-company) — 실무/수납 업체 모드 목록 맨 위.
 * 점선 1줄 버튼 → 제자리에서 인라인 폼(업체명·계약일·수임비)으로 펼친다.
 * 폼을 열 때마다 requestKey(uuid) 를 한 번 만들고, 실패 후 재시도에도 같은 키를 보낸다
 * (서버가 같은 행을 찾아 갱신 → 중복 업체·매출 이중계상 없음). 성공하면 목록 재조회가
 * 끝난 뒤 onCreated(row) 로 새 업체를 선택하게 한다. 진행기관 모드에서는 그리지 않는다.
 */
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAddStandaloneContract } from "@/query/contract-payment-hooks";
import { formatMoneyInput, parseMoney } from "@/lib/format/money";
import { todayKST } from "@/util/week";

interface Props {
  listMode: "company" | "institution";
  onCreated: (row: number) => void;
  className?: string;
}

/** 서버·네트워크 원문(HTTP 500·unauthenticated·영문 예외) 대신 수강생에게 보이는 고정 문구. */
export const STANDALONE_ADD_ERROR = "업체를 추가하지 못했어요. 잠시 후 다시 눌러 주세요.";

function newRequestKey(): string {
  return crypto.randomUUID();
}

export default function StandaloneCompanyAdd({ listMode, onCreated, className = "" }: Props) {
  const add = useAddStandaloneContract();
  const [open, setOpen] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [업체명, set업체명] = useState("");
  const [계약일, set계약일] = useState("");
  const [수임비, set수임비] = useState("");
  const [error, setError] = useState("");
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [refocus, setRefocus] = useState(false);
  // 취소로 폼이 닫히면 포커스를 점선 버튼으로 돌려준다(폼 subtree 가 사라져 <body> 로 떨어지지 않게).
  useEffect(() => {
    if (open || !refocus) return;
    addBtnRef.current?.focus();
    setRefocus(false);
  }, [open, refocus]);

  if (listMode !== "company") return null;

  const openForm = () => {
    setRequestKey(newRequestKey());
    set업체명("");
    set계약일(todayKST());
    set수임비("");
    setError("");
    setOpen(true);
  };

  const pending = add.isPending;
  const name = 업체명.trim();
  const canSubmit = !pending && name.length > 0 && name.length <= 100 && /^\d{4}-\d{2}-\d{2}$/.test(계약일);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    try {
      const res = await add.mutateAsync({ 계약일, 업체명: name, 수임비: parseMoney(수임비), requestKey });
      setOpen(false);
      onCreated(res.row);
    } catch (err) {
      // 입력값과 requestKey 는 그대로 둔다 — 다시 누르면 같은 행으로 이어진다.
      console.warn("[standalone-company-add] failed", err);
      setError(STANDALONE_ADD_ERROR);
    }
  };

  if (!open) {
    return (
      <div className={className}>
        <button ref={addBtnRef} type="button" onClick={openForm} data-standalone-add
          className="flex h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-blue-300 bg-white px-3 text-sm font-semibold text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          ＋ 영업기록 없이 업체추가
        </button>
      </div>
    );
  }

  const inputCls = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
  return (
    <div className={className}>
      <form onSubmit={submit} data-standalone-form aria-label="영업기록 없이 업체추가"
        className="space-y-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-3">
        <label className="block text-xs font-semibold text-slate-600">
          업체명
          <input className={`mt-1 ${inputCls}`} value={업체명} maxLength={100} autoFocus required
            placeholder="예: 예시상사" onChange={(e) => set업체명(e.target.value)} name="업체명" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-slate-600">
            계약일
            <input className={`mt-1 ${inputCls}`} type="date" value={계약일} required
              onChange={(e) => set계약일(e.target.value)} name="계약일" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            수임비(원)
            <input className={`mt-1 ${inputCls} text-right tabular-nums`} inputMode="numeric" value={formatMoneyInput(parseMoney(수임비))}
              placeholder="0" onChange={(e) => set수임비(e.target.value)} name="수임비" />
          </label>
        </div>
        <p className="text-xs text-slate-500">계약일이 수강 시작일보다 앞이면 이월로, 이후면 이번 과정 매출로 잡혀요.</p>
        {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setOpen(false); setRefocus(true); }} disabled={pending}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            취소
          </button>
          <button type="submit" disabled={!canSubmit}
            className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
