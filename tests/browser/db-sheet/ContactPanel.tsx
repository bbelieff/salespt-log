import React,{useState} from 'react';
import CompanyInfoEditor from '@/components/CompanyInfoEditor';
import {CompanyInfo} from '@/types';
import {DateTimeRow,FieldText,FieldNote} from '@/app/(app)/contact/_components/MeetingSlotForm';
import {Row,outcomes} from './model';

export type ContactDraft={editorRevision?:number;ci:CompanyInfo;note:string;date:string;meetingDate:string;time:string;place:string;reservationNote:string;registered:boolean};
export const contactDraft=(r:Row):ContactDraft=>({ci:CompanyInfo.parse({대표자이름:r.owner,신용점수:r.credit,업종주생산품목:r.industry,소재지:r.address}),note:'',date:'2026-10-10',meetingDate:'',time:'',place:r.address,reservationNote:'',registered:false});
export function ContactPanel({row,draft,onChange,onResult,onRegister,onOpen,onCompany,showContact=true}:{row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onResult:(v:string,date:string)=>void;onRegister:()=>void;onOpen?:()=>void;onCompany:(v:string)=>void;showContact?:boolean}){
 const [booking,setBooking]=useState(!!(draft.registered||draft.meetingDate||draft.reservationNote));
 const patch=(p:Partial<ContactDraft>)=>onChange({...draft,...p});
 return <div className="db-contact-form">
  {showContact&&<ContactFields row={row} draft={draft} onChange={onChange} onResult={onResult}/>}
  <div className="db-company-form"><CompanyInfoEditor key={`${row.id}-${draft.editorRevision||0}`} identityKey={row.id} value={draft.ci} hideSave defaultLayout="basic" onChange={ci=>patch({ci,place:ci.소재지||''})} onSave={ci=>patch({ci,place:ci.소재지||''})}/></div>
  {(draft.ci.업체기타메모||draft.ci.대표기타메모)&&<details className="db-previous-notes"><summary>기존 업체 메모 보기</summary><p>{draft.ci.업체기타메모}</p><p>{draft.ci.대표기타메모}</p></details>}
  <section className="db-meeting-form db-meeting-accordion" aria-label="미팅카드">
   <button type="button" className="db-meeting-heading db-meeting-toggle" aria-label="미팅예약" aria-expanded={booking} aria-controls={`meeting-body-${row.id}`} onClick={()=>setBooking(!booking)}><span>미팅예약</span><span className="db-meeting-heading-end">{draft.registered&&<span className="sheet-badge is-active">예약됨</span>}<span aria-hidden="true">{booking?'▴':'▾'}</span></span></button>
   {booking&&<div className="db-meeting-body" id={`meeting-body-${row.id}`}>
   <div className="db-meeting-inputs"><DateTimeRow 미팅날짜={draft.meetingDate} 미팅시간={draft.time} onDate={meetingDate=>patch({meetingDate})} onTime={time=>patch({time})}/>
   <FieldNote value={draft.reservationNote} onChange={reservationNote=>patch({reservationNote})}/></div>
   <p className="db-meeting-auto" title={draft.ci.소재지||""}>장소 자동 · {draft.ci.소재지||"업체정보의 소재지를 입력해 주세요"}</p>
   {!draft.registered?<button className="sheet-btn primary db-register" disabled={!draft.date||!draft.meetingDate||!draft.time||!draft.ci.소재지?.trim()} onClick={onRegister}>예약 등록</button>:null}
   {onOpen&&draft.registered&&<button className="sheet-text-btn" onClick={onOpen}>컨택관리에서 미팅카드 보기 →</button>}
   </div>}
  </section>
 </div>;
}

export function ContactFields({row,draft,onChange,onResult}:{row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onResult:(v:string,date:string)=>void}){
 const patch=(p:Partial<ContactDraft>)=>onChange({...draft,...p});
 return <div className="db-call-fields">  <div className="db-contact-summary"><strong>{row.company}</strong><span>{row.owner} · {row.phone}</span></div>
  <div className="db-contact-controls"><label>컨택일<input aria-label="컨택일" className="sheet-input" type="date" value={draft.date} onChange={e=>patch({date:e.target.value})}/></label><label>컨택결과<select aria-label="컨택내용 결과" className="sheet-input" value={row.result} onChange={e=>onResult(e.target.value,draft.date)}>{outcomes.map(v=><option key={v}>{v}</option>)}</select></label></div>
  <label className="db-note-label">상담메모<textarea aria-label="상담메모" className="sheet-input" rows={2} placeholder="통화하며 확인한 내용·고객 요청사항" value={draft.note} onChange={e=>patch({note:e.target.value})}/></label>
</div>;
}
