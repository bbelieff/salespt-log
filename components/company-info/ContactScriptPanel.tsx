/**
 * ContactScriptPanel — 업체정보 팝업 [기본보기 | 확장보기 | 대본] 의 「대본」 (belie 2026-11-05).
 * 통화하며 읽는 컨택 대본 + 통화 뒤 보내는 문자양식(복사). 칸마다 「수정」으로 고치고 저장하면
 * 내 계정에만 남아 다음에 열 때 그 글로 열린다(DB contact_scripts). 고친 적 없으면 기본 대본.
 * 「문자 앱」은 폰 문자 앱을 문자 양식이 채워진 채로 연다(sms:). `phone` 이 있으면 받는 사람도 채운다.
 */
"use client";

import { useState } from "react";
import { useContactScript, useSaveContactScript } from "@/query/contact-script-hooks";
import { smsHref } from "@/util/sms-link";

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

type Field = "script" | "sms";
const LABEL: Record<Field, string> = { script: "컨택 대본", sms: "문자 양식" };

/** 칸마다 「수정」 — 문자 양식도 대본처럼 바로 고쳐 저장한다(2026-11-06 belie: 대본 칸에만 수정이 있어 문자는 못 고치는 줄 알았다).
 *  고치는 칸만 입력창이 되고, 저장은 다른 칸의 지금 글과 함께 보낸다(PUT 은 둘을 한 벌로 받는다). */
export default function ContactScriptPanel({ phone = "" }: { phone?: string }) {
  const q = useContactScript(true);
  const save = useSaveContactScript();
  const [edit, setEdit] = useState<{ field: Field; value: string } | null>(null);
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
  const openSms = () => {
    window.location.href = smsHref(phone, data.sms, /iPhone|iPad|iPod/i.test(navigator.userAgent));
  };
  const submit = (value: { script: string; sms: string } | null) =>
    save.mutate(value, { onSuccess: () => setEdit(null) });
  const startEdit = (field: Field) => { save.reset(); setEdit({ field, value: data[field] }); };

  const card = (field: Field, rows: number, extra?: React.ReactNode) => {
    const editing = edit?.field === field;
    return (
      <div className={boxCls}>
        <Title text={LABEL[field]}>
          {!editing && (
            <span className="flex items-center gap-2">
              {extra}
              <button type="button" aria-label={`${LABEL[field]} 수정`} disabled={!!edit} onClick={() => startEdit(field)} className={btnCls}>수정</button>
            </span>
          )}
        </Title>
        {editing ? (
          <>
            <textarea aria-label={LABEL[field]} autoFocus className={areaCls} rows={rows} value={edit.value} onChange={(e) => setEdit({ field, value: e.target.value })} />
            {save.isError && <p className="text-xs text-red-600" aria-live="polite">{save.error.message}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={save.isPending} onClick={() => submit({ script: data.script, sms: data.sms, [field]: edit.value })} className="rounded-md bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50">
                {save.isPending ? "저장중.." : "저장"}
              </button>
              <button type="button" disabled={save.isPending} onClick={() => { save.reset(); setEdit(null); }} className={btnCls}>취소</button>
              {data.custom && (
                <button type="button" disabled={save.isPending} onClick={() => submit(null)} className="ml-auto text-xs text-gray-500 underline hover:text-gray-800 disabled:opacity-50">
                  대본·문자 모두 기본으로 되돌리기
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{data[field]}</p>
        )}
      </div>
    );
  };

  const copyButton = (
    <>
      {copied && <span className={`text-xs ${copied === "ok" ? "text-emerald-700" : "text-red-600"}`} aria-live="polite">{copied === "ok" ? "복사했어요" : "복사 못 했어요 — 직접 선택해 주세요"}</span>}
      <button type="button" onClick={openSms} aria-label={phone ? "문자 앱 열기 (받는 사람·내용 채움)" : "문자 앱 열기 (내용 채움)"} className={btnCls}>문자 앱</button>
      <button type="button" onClick={copy} className="rounded-md bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-900">복사</button>
    </>
  );

  return (
    <div className="space-y-2">
      {card("script", 18)}
      {card("sms", 14, copyButton)}
      {!data.custom && !edit && <p className="text-xs text-gray-400">기본 대본이에요. 칸마다 「수정」으로 고치면 내 계정에 저장돼요.</p>}
    </div>
  );
}
