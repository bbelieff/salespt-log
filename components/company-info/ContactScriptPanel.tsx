/**
 * ContactScriptPanel — 업체정보 팝업 [기본보기 | 확장보기 | 대본] 의 「대본」 (belie 2026-11-05).
 * 통화하며 읽는 컨택 대본 + 통화 뒤 보내는 문자양식(복사). 「수정」으로 둘 다 고치고 저장하면
 * 내 계정에만 남아 다음에 열 때 그 글로 열린다(DB contact_scripts). 고친 적 없으면 기본 대본.
 */
"use client";

import { useState } from "react";
import { useContactScript, useSaveContactScript } from "@/query/contact-script-hooks";

const boxCls = "min-w-0 space-y-1.5 rounded-md border border-gray-100 bg-white p-2.5 shadow-sm";
const btnCls = "rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50";
const areaCls = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm leading-relaxed focus:border-slate-500 focus:outline-none";

function Title({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
        <span className="h-3 w-1 rounded-sm bg-brand-red" aria-hidden />[{text}]
      </span>
      {children}
    </div>
  );
}

export default function ContactScriptPanel() {
  const q = useContactScript(true);
  const save = useSaveContactScript();
  const [edit, setEdit] = useState<{ script: string; sms: string } | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  if (q.isPending) return <p className="py-6 text-center text-xs text-gray-400">대본 불러오는 중…</p>;
  if (q.isError) {
    return (
      <div className="py-6 text-center text-xs text-red-600">
        {q.error.message}{" "}
        <button type="button" onClick={() => q.refetch()} className="font-semibold underline">다시 시도</button>
      </div>
    );
  }
  const data = q.data;

  const copy = () => {
    navigator.clipboard.writeText(data.sms).then(() => setCopied("ok"), () => setCopied("fail"));
    setTimeout(() => setCopied(null), 2000);
  };
  const submit = (value: { script: string; sms: string } | null) =>
    save.mutate(value, { onSuccess: () => setEdit(null) });

  if (edit) {
    return (
      <div className="space-y-2">
        <div className={boxCls}>
          <Title text="컨택 대본" />
          <textarea aria-label="컨택 대본" className={areaCls} rows={18} value={edit.script} onChange={(e) => setEdit({ ...edit, script: e.target.value })} />
        </div>
        <div className={boxCls}>
          <Title text="문자 양식" />
          <textarea aria-label="문자 양식" className={areaCls} rows={14} value={edit.sms} onChange={(e) => setEdit({ ...edit, sms: e.target.value })} />
        </div>
        {save.isError && <p className="text-xs text-red-600" aria-live="polite">{save.error.message}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={save.isPending} onClick={() => submit(edit)} className="rounded-md bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50">
            {save.isPending ? "저장 중…" : "저장"}
          </button>
          <button type="button" disabled={save.isPending} onClick={() => { save.reset(); setEdit(null); }} className={btnCls}>취소</button>
          {data.custom && (
            <button type="button" disabled={save.isPending} onClick={() => submit(null)} className="ml-auto text-xs text-gray-500 underline hover:text-gray-800 disabled:opacity-50">
              기본 대본으로 되돌리기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={boxCls}>
        <Title text="컨택 대본">
          <button type="button" onClick={() => setEdit({ script: data.script, sms: data.sms })} className={btnCls}>수정</button>
        </Title>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{data.script}</p>
      </div>
      <div className={boxCls}>
        <Title text="문자 양식">
          <span className="flex items-center gap-2">
            {copied && <span className={`text-xs ${copied === "ok" ? "text-emerald-700" : "text-red-600"}`} aria-live="polite">{copied === "ok" ? "복사했어요" : "복사 못 했어요 — 직접 선택해 주세요"}</span>}
            <button type="button" onClick={copy} className="rounded-md bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900">복사</button>
          </span>
        </Title>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{data.sms}</p>
      </div>
      {!data.custom && <p className="text-xs text-gray-400">기본 대본이에요. 「수정」으로 고치면 내 계정에 저장돼요.</p>}
    </div>
  );
}
