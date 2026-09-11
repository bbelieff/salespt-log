"use client";
import { useEffect, useState } from "react";
import { sendRecruitment } from "./TrainerApplication";
type Invite={id:string;recipient_email:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};
export default function TrainerInvites() {
  const [email,setEmail]=useState("");
  const [invites,setInvites]=useState<Invite[]>([]);
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function refresh() {const body=await sendRecruitment({action:"list"});setInvites(body.invitations);}
  useEffect(()=>{void refresh().catch(()=>setMessage("초대 목록을 불러오지 못했습니다."));},[]);
  async function create(e:React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);setMessage("");setLink("");
    try {const result=await sendRecruitment({action:"invite",email});setLink(`${window.location.origin}/trainer/invite#token=${result.token}`);await refresh();}
    catch(e){setMessage(e instanceof Error ? e.message : "초대 생성에 실패했습니다.");}finally{setBusy(false);}
  }
  async function revoke(id:string) {
    if(busy)return;setBusy(true);setMessage("");
    try{await sendRecruitment({action:"revoke",id});setLink("");await refresh();}
    catch(e){setMessage(e instanceof Error ? e.message : "초대 취소에 실패했습니다.");}finally{setBusy(false);}
  }
  return <section className="mx-auto my-6 max-w-3xl rounded-xl border border-gray-200 bg-white p-5">
    <h2 className="text-lg font-bold">트레이너 초대</h2>
    <p className="mt-2 text-sm text-gray-600">초대받은 계정으로 수락하면 바로 등록됩니다. 링크는 7일 동안 유효합니다.</p>
    <form onSubmit={create} className="mt-4 flex flex-wrap gap-2">
      <label className="min-w-0 flex-1 text-sm font-bold">초대받을 이메일<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3 font-normal" /></label>
      <button disabled={busy} className="mt-auto h-11 rounded-lg bg-brand-red px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? "처리 중…" : "초대 링크 생성"}</button>
    </form>
    {link && <div className="ph-no-capture ph-mask mt-4"><label className="text-sm">생성된 초대 링크<input readOnly value={link} onFocus={e=>e.target.select()} className="mt-1 h-11 w-full rounded-lg border px-3 text-xs" /></label><button type="button" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage("초대 링크를 복사했습니다.")).catch(()=>setMessage("링크를 선택하여 직접 복사해 주세요."))} className="mt-2 h-11 rounded-lg border px-4 text-sm">링크 복사</button></div>}
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    <ul className="mt-4 divide-y divide-gray-100">{invites.map(i=><li key={i.id} className="flex flex-wrap items-center gap-2 py-3 text-sm"><span className="min-w-0 flex-1 break-all">{i.recipient_email}</span><span className="text-gray-500">{i.accepted_at ? "수락 완료" : i.revoked_at ? "초대 취소" : new Date(i.expires_at).getTime()<Date.now() ? "기간 만료" : "수락 대기"}</span>{!i.accepted_at&&!i.revoked_at&&<button disabled={busy} onClick={()=>void revoke(i.id)} className="h-11 rounded-lg border px-3 disabled:opacity-50">초대 취소</button>}</li>)}</ul>
  </section>;
}
