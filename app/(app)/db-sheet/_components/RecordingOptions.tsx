import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {useState} from 'react';
import {Layers} from 'lucide-react';
import type {Recording} from './recording-client';
export function RecordingOptions({value,onChange}:{value:Recording;onChange:(value:Recording)=>void}){
 const [expanded,setExpanded]=useState(false),enabled=value.inflow||value.activities;
 return <div className={`dbs-sync ${enabled?'is-on':''}`}><label className="dbs-check"><input type="checkbox" checked={enabled} onChange={e=>onChange(e.target.checked?{inflow:true,activities:true}:{inflow:false,activities:false})}/><span><strong>STEP 2에 기록</strong><small>컨택관리 숫자에 반영해요</small></span></label>{enabled?<><button type="button" className="dbs-scope-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><span><Layers size={15}/>{value.inflow?(value.activities?'유입 · 상담 · 미팅':'유입만'):'상담 · 미팅만'}</span><span>변경 <DisclosureChevron open={expanded} /></span></button>{expanded&&<fieldset className="dbs-scopes"><legend className="sr-only">STEP 2 반영 범위</legend>{[{inflow:true,title:'처음 입력하는 DB',text:'유입부터 모두 기록'},{inflow:false,title:'유입은 이미 입력함',text:'상담·미팅만 기록'}].map(item=><label key={item.title} className={value.activities&&value.inflow===item.inflow?'selected':''}><input type="radio" name="recording-scope" checked={value.activities&&value.inflow===item.inflow} onChange={()=>onChange({inflow:item.inflow,activities:true})}/><span><strong>{item.title}</strong><small>{item.text}</small></span></label>)}</fieldset>}</>:<p className="dbs-muted">시트에만 저장해요. 나중에 켤 수 있어요.</p>}</div>;
}
