"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import LoginScene from "./LoginScene";
import TrainerApplication from "./TrainerApplication";
import { readInvitationToken, INVITATION_STORAGE_KEY } from "@/util/invitation-token";
/** Fragment is never sent to servers/OAuth. Keep it only in this tab through login. */
export default function TrainerInvitationEntry({signedIn}:{signedIn:boolean}) {
  const [token,setToken]=useState<string|null|undefined>(undefined);
  useEffect(()=>{
    const hasFragment=!!window.location.hash;
    const fromLink=readInvitationToken(window.location.hash);
    window.history.replaceState(null,"",window.location.pathname); // remove fragment/query immediately
    try {
      if(hasFragment && !fromLink) {sessionStorage.removeItem(INVITATION_STORAGE_KEY);setToken(null);return;}
      if(fromLink) sessionStorage.setItem(INVITATION_STORAGE_KEY,fromLink);
      setToken(fromLink ?? readInvitationToken(sessionStorage.getItem(INVITATION_STORAGE_KEY)));
    } catch {setToken(fromLink);}
  },[]);
  if(token===undefined)return <p className="p-6" role="status">초대 확인 중…</p>;
  // 잘못된 링크도 막다른 길이 되지 않게 — 처음 화면으로 가는 버튼(2026-11-10 UI 점검).
  if(!token)return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">초대 링크를 열 수 없어요</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">올바르지 않은 초대 링크입니다. 관리자에게 새 링크를 요청해 주세요.</p>
        <Link href="/" className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">처음 화면으로</Link>
      </section>
    </main>
  );
  if(!signedIn)return <LoginScene returnTo="/trainer/invite" />;
  return <TrainerApplication token={token} />;
}
