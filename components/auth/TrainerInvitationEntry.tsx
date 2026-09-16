"use client";
import { useEffect, useState } from "react";
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
  if(!token)return <p className="p-6">올바르지 않은 초대 링크입니다. 관리자에게 새 링크를 요청해 주세요.</p>;
  if(!signedIn)return <LoginScene returnTo="/trainer/invite" />;
  return <TrainerApplication token={token} />;
}
