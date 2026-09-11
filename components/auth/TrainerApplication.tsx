"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { INVITATION_STORAGE_KEY } from "@/util/invitation-token";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTrainerState } from "./RoleViewSwitch";
export async function sendRecruitment(input:Record<string,unknown>) {
  const res=await fetch("/api/trainer/recruitment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const body=await res.json();
  if (!res.ok) throw new Error(body.error || "요청을 처리하지 못했습니다.");
  return body;
}
export default function TrainerApplication({token}:{token?:string}) {
  const state=useTrainerState();
  const query=useQueryClient();
  const [name,setName]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [confirm,setConfirm]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const run=async (action:"apply"|"accept"|"cancel")=>{
    if (busy || !state.data) return;
    setBusy(true);setError("");
    try {
      await sendRecruitment({action,...(action!=="cancel" ? {name:(name??state.data.name).trim()} : {}),...(action==="accept" ? {token} : {})});
      setConfirm(false);if(action==="accept") {setAccepted(true);try {sessionStorage.removeItem(INVITATION_STORAGE_KEY);} catch { /* tab storage is optional */ }}
      await query.invalidateQueries({queryKey:["trainer-state"]});
      await query.invalidateQueries({queryKey:["me"]});
    } catch(e) {setError(e instanceof Error ? e.message : "요청을 처리하지 못했습니다.");}
    finally {setBusy(false);}
  };
  if (state.isPending) return <p className="p-6" role="status">신청 정보 확인 중…</p>;
  if (!state.data) return <div className="p-6"><p role="alert">신청 정보를 불러오지 못했습니다.</p><button onClick={()=>void state.refetch()} className="mt-4 h-11 rounded border px-4">다시 시도</button></div>;
  const data=state.data;
  const active=data.status==="active" && (!token || accepted);
  const pending=data.status==="pending" && !token;
  return <main className="min-h-dvh bg-slate-50 px-4 py-8">
    <section className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="mb-2 text-xs font-bold text-brand-red">세일즈PT 트레이너</p>
      <h1 className="text-2xl font-bold text-gray-900">{active ? "트레이너 등록 완료" : token ? "트레이너 초대" : pending ? "신청 완료 · 승인 대기" : "트레이너 신청"}</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">{active ? "트레이너 페이지에서 활동을 시작할 수 있습니다." : token ? "아래 계정으로 초대를 수락하면 트레이너로 등록됩니다. 초대받은 이메일과 같은 계정인지 확인해 주세요." : pending ? "관리자가 신청을 확인하고 있습니다. 승인 전에는 신청을 취소할 수 있습니다." : "수강 여부와 관계없이 신청할 수 있습니다. 관리자 승인 후 트레이너로 활동할 수 있습니다."}</p>
      {data.status==="cancelled" && !token && <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm" role="status">신청이 취소되었습니다. 언제든 다시 신청할 수 있습니다.</p>}
      <form onSubmit={e=>{e.preventDefault();void run(token ? "accept" : "apply");}}>
        <label className="mt-6 block text-sm font-bold">이름
          <input required maxLength={100} disabled={busy||pending||active} value={name??data.name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 font-normal disabled:bg-gray-50" />
        </label>
        <div className="mt-4 text-sm"><p className="font-bold">로그인 계정</p><p className="mt-2 break-all text-gray-600">{data.email}</p></div>
        <p className="my-6 rounded-lg bg-slate-50 p-3 text-sm text-gray-600">기존 수강 기록과 내 일지는 그대로 유지됩니다.</p>
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {active ? <Link href="/trainer" className="flex h-11 items-center justify-center rounded-lg bg-brand-red font-bold text-white">트레이너 페이지 →</Link>
          : pending ? <button type="button" disabled={busy} onClick={()=>setConfirm(true)} className="h-11 w-full rounded-lg border border-gray-300 font-bold disabled:opacity-50">신청 취소</button>
          : <button type="submit" disabled={busy} className="h-11 w-full rounded-lg bg-brand-red font-bold text-white disabled:opacity-50">{busy ? "처리 중…" : token ? "초대 수락하기" : "트레이너 신청하기"}</button>}
      </form>
      {data.canStudent && <Link href="/dashboard" className="mt-4 flex h-11 items-center justify-center text-sm font-bold text-gray-600">내 일지로 돌아가기</Link>}
      {token && !accepted && <button type="button" onClick={()=>void signOut({callbackUrl:"/trainer/invite"})} className="mt-3 h-11 w-full text-sm text-gray-600">다른 계정으로 로그인</button>}
    </section>
    {confirm && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="cancel-title" className="text-lg font-bold">트레이너 신청을 취소할까요?</h2>
        <p className="my-4 text-sm text-gray-600">기존 수강 기록은 유지되며, 나중에 다시 신청할 수 있습니다.</p>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2"><button autoFocus disabled={busy} onClick={()=>setConfirm(false)} className="h-11 flex-1 rounded-lg border border-gray-300">계속 대기</button><button disabled={busy} onClick={()=>void run("cancel")} className="h-11 flex-1 rounded-lg bg-brand-red font-bold text-white">{busy ? "처리 중…" : "신청 취소"}</button></div>
      </section>
    </div>}
  </main>;
}
