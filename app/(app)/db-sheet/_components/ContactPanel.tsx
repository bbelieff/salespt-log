import DisclosureChevron from '@/components/ui/DisclosureChevron';
import DeletedMeetings from "@/components/meeting-safety/DeletedMeetings";
import {todayKST} from '@/util/week';
import React,{useEffect,useRef,useState} from 'react';
import CompanyInfoEditor from '@/components/CompanyInfoEditor';
import {CompanyInfo} from '@/types';
import {DateTimeRow,FieldNote} from '@/app/(app)/contact/_components/MeetingSlotForm';
import {Row,meetingUnregistered} from './model';
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
/**
 * book = 이번에 「미팅예약」을 골랐다(2026-11-08 belie 「미팅예약을 잡았는데 STEP 3 누락 0건」). 미팅예약 칸을 열고,
 * 날짜·시간·소재지가 다 차면 1.2초 뒤 스스로 [예약 등록] — 결과(미팅예약)는 등록이 함께 저장한다(서버가 미팅 없는 미팅예약을 막음).
 * 이번에 날짜·시간·소재지를 직접 고쳐도 같다. 예전에 채워 두기만 한 칸은 자동 등록하지 않고 안내만 — 일별 기록에 따로 잡은 미팅과 겹칠 수 있다.
 */
export function ContactPanel({row,draft,onChange,onResult,onRegister,onOpen,onCompany,onRestored,onMeetingSaved,showContact=true,book=false}:{row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onResult:(v:string,date:string)=>void;onRegister:()=>void;onOpen?:()=>void;onCompany:(v:string)=>void;onRestored?:()=>void|Promise<void>;onMeetingSaved?:()=>void;showContact?:boolean;book?:boolean}){
 const pending=!draft.registered&&!row.meetingId&&(book||meetingUnregistered(row));
 const [booking,setBooking]=useState(!!(draft.registered||draft.meetingDate||draft.reservationNote||pending));
 useEffect(()=>{if(pending)setBooking(true);},[pending]);
 const armed=useRef(false);
 const patch=(p:Partial<ContactDraft>)=>{if('meetingDate' in p||'time' in p||'ci' in p)armed.current=true;onChange({...draft,...p});};
 const missing=[!draft.meetingDate&&'미팅 일정',!draft.time&&'시간',!draft.ci.소재지?.trim()&&'소재지'].filter(Boolean) as string[];
 const complete=!!draft.date&&missing.length===0;
 const auto=!draft.registered&&!row.meetingId&&complete&&(book||armed.current);
 // 다 채워지면 스스로 예약 등록. 실패하면 값이 바뀔 때까지 다시 시도하지 않는다(버튼으로 재시도).
 useEffect(()=>{if(!auto)return;const t=setTimeout(onRegister,1200);return()=>clearTimeout(t);// eslint-disable-next-line react-hooks/exhaustive-deps
 },[auto,draft.meetingDate,draft.time,draft.ci.소재지]);
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
   {!draft.registered&&(pending||draft.meetingDate||draft.time)&&<p role="status" className="db-meeting-pending">{auto?'곧 예약돼요 · STEP 3 일정으로 넘어가요':missing.length?`아직 일정에 안 들어갔어요 · ${missing.join('·')} 칸을 채우면 바로 예약돼요`:'아직 일정에 안 들어갔어요 · [예약 등록]을 눌러 주세요'}</p>}
   {!draft.registered?<button className="sheet-btn primary db-register" disabled={!complete} onClick={onRegister}>예약 등록</button>:null}

   </div>}
  </section></fieldset>
  {row.meetingId&&draft.registered&&<a className="sheet-btn primary" href={`/schedule?date=${encodeURIComponent(draft.meetingDate)}&focus=${encodeURIComponent(row.effectiveMeetingId??row.meetingId)}&edit=schedule`}>STEP 3 · 일정 변경 →</a>}
  {onOpen&&draft.registered&&<button className="sheet-btn" onClick={onOpen}>업체정보 수정 →</button>}
  {row.meetingId&&row.stage==='미팅 삭제됨'&&<DeletedMeetings meetingId={row.meetingId} onRestored={onRestored}/>}
 </div>;
}

