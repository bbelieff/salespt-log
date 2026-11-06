import DisclosureChevron from '@/components/ui/DisclosureChevron';
import DeletedMeetings from "@/components/meeting-safety/DeletedMeetings";
import {todayKST} from '@/util/week';
import React,{useEffect,useState} from 'react';
import CompanyInfoEditor from '@/components/CompanyInfoEditor';
import {CompanyInfo} from '@/types';
import {DateTimeRow,FieldNote} from '@/app/(app)/contact/_components/MeetingSlotForm';
import {Row} from './model';
import {useDirtyEntry} from '@/components/DirtyGuard';
import {useAutosave} from '@/components/autosave/useAutosave';
import AutosaveStatus from '@/components/autosave/AutosaveStatus';
import {discardUnsaved} from '@/components/weekly-goals/weeklyGoalAutosave';
import {usePatchMeeting} from '@/query/contact-hooks';

/**
 * 미팅을 잡은 업체의 업체정보(2026-11-07 belie 「윈디 팝업 2번 — 미팅 뒤에도 고치기」).
 * 미팅을 잡으면 DB 줄의 업체정보는 그 미팅의 업체정보를 보여 주는 읽기 전용(서버 DbSheetLinkedMeetingReadOnly)이라,
 * 여기서 고친 값은 컨택관리와 같은 미팅 저장(PATCH /api/meeting/:id, 1초 자동 저장)으로 미팅에 바로 넣는다.
 * 저장 뒤 onSaved 로 DB관리시트를 다시 읽어 줄에도 반영. 미팅날짜·시간·업체명은 그대로 잠금(일정·계약에서).
 */
function MeetingCompanyInfo({row,draft,onSaved}:{row:Row;draft:ContactDraft;onSaved?:()=>void}){
 const meetingId=row.effectiveMeetingId??row.meetingId!;
 const patch=usePatchMeeting();
 const auto=useAutosave<{업체정보:CompanyInfo}>({target:{kind:'db-sheet-meeting-ci',id:meetingId},initial:{업체정보:draft.ci},delayMs:1000,
  save:async({payload})=>{await patch.mutateAsync({id:meetingId,partial:{업체정보:payload.업체정보},date:draft.date});onSaved?.();}});
 const serverKey=JSON.stringify(draft.ci);
 // 다시 읽은 서버 값 — 아직 안 보낸 편집은 그대로 두고, 깨끗할 때만 기준을 옮긴다.
 useEffect(()=>{auto.syncServer({업체정보:draft.ci});// eslint-disable-next-line react-hooks/exhaustive-deps
 },[serverKey]);
 useDirtyEntry(`db-meeting-ci-${meetingId}`,auto.dirty,()=>auto.flush(),()=>discardUnsaved(auto),`업체정보 ${row.company||'(미입력)'}`);
 return <div className="db-company-form"><div className="flex min-h-5 justify-end text-xs text-slate-500"><AutosaveStatus status={auto.status} error={auto.error} savedAt={auto.savedAt} onRetry={auto.retry}/></div>
  <CompanyInfoEditor key={`${row.id}-meeting`} identityKey={row.id} value={auto.draft.업체정보} hideSave defaultLayout="basic" onChange={ci=>auto.update({업체정보:ci})} onSave={ci=>{auto.update({업체정보:ci});void auto.flush();}}/></div>;
}

export type ContactDraft={editorRevision?:number;ci:CompanyInfo;note:string;date:string;meetingDate:string;time:string;place:string;reservationNote:string;registered:boolean;companyName?:string};
export const contactDraft=(r:Row):ContactDraft=>({ci:CompanyInfo.parse({대표자이름:r.owner,신용점수:r.credit,업종주생산품목:r.industry,소재지:r.address}),note:r.note??'',date:todayKST(),meetingDate:'',time:'',place:r.address,reservationNote:'',registered:false});
export function ContactPanel({row,draft,onChange,onResult,onRegister,onOpen,onCompany,onRestored,onMeetingSaved,showContact=true}:{row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onResult:(v:string,date:string)=>void;onRegister:()=>void;onOpen?:()=>void;onCompany:(v:string)=>void;onRestored?:()=>void|Promise<void>;onMeetingSaved?:()=>void;showContact?:boolean}){
 const [booking,setBooking]=useState(!!(draft.registered||draft.meetingDate||draft.reservationNote));
 const patch=(p:Partial<ContactDraft>)=>onChange({...draft,...p});
 return <div className="db-contact-form">
  <fieldset disabled={draft.registered}><label className="db-note-label">확인한 업체명<input className="sheet-input" aria-label="확인한 업체명" value={draft.companyName??row.company} onChange={e=>patch({companyName:e.target.value})}/></label></fieldset>
  {draft.registered&&row.meetingId?<MeetingCompanyInfo row={row} draft={draft} onSaved={onMeetingSaved}/>:<div className="db-company-form"><CompanyInfoEditor key={`${row.id}-${draft.editorRevision||0}`} identityKey={row.id} value={draft.ci} hideSave defaultLayout="basic" onChange={ci=>patch({ci,place:ci.소재지||''})} onSave={ci=>patch({ci,place:ci.소재지||''})}/></div>}
  <fieldset disabled={draft.registered}>
  {(draft.ci.업체기타메모||draft.ci.대표기타메모)&&<details className="db-previous-notes"><summary>기존 업체 메모 보기</summary><p>{draft.ci.업체기타메모}</p><p>{draft.ci.대표기타메모}</p></details>}
  <section className="db-meeting-form db-meeting-accordion" aria-label="미팅카드">
   <button type="button" className="db-meeting-heading db-meeting-toggle" aria-label="미팅예약" aria-expanded={booking} aria-controls={`meeting-body-${row.id}`} onClick={()=>setBooking(!booking)}><span>미팅예약</span><span className="db-meeting-heading-end">{draft.registered&&<span className="sheet-badge is-active">예약됨</span>}<span aria-hidden="true"><DisclosureChevron open={booking} /></span></span></button>
   {booking&&<div className="db-meeting-body" id={`meeting-body-${row.id}`}>
   <div className="db-meeting-inputs"><DateTimeRow 미팅날짜={draft.meetingDate} 미팅시간={draft.time} onDate={meetingDate=>patch({meetingDate})} onTime={time=>patch({time})}/>
   <FieldNote value={draft.reservationNote} onChange={reservationNote=>patch({reservationNote})}/></div>
   <p className="db-meeting-auto" title={draft.ci.소재지||""}>장소 자동 · {draft.ci.소재지||"업체정보의 소재지를 입력해 주세요"}</p>
   {!draft.registered?<button className="sheet-btn primary db-register" disabled={!draft.date||!draft.meetingDate||!draft.time||!draft.ci.소재지?.trim()} onClick={onRegister}>예약 등록</button>:null}

   </div>}
  </section></fieldset>
  {row.meetingId&&draft.registered&&<a className="sheet-btn primary" href={`/schedule?date=${encodeURIComponent(draft.meetingDate)}&focus=${encodeURIComponent(row.effectiveMeetingId??row.meetingId)}&edit=schedule`}>STEP 3 · 일정 변경 →</a>}
  {onOpen&&draft.registered&&<button className="sheet-btn" onClick={onOpen}>업체정보 수정 →</button>}
  {row.meetingId&&row.stage==='미팅 삭제됨'&&<DeletedMeetings meetingId={row.meetingId} onRestored={onRestored}/>}
 </div>;
}

