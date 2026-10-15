import {useState} from 'react';
import {CheckCircle2,ChevronDown,X} from 'lucide-react';
import type {RecordingImpact} from './recording-client';
export type ImportResult={total:number;impact:RecordingImpact};
export default function ImportResultNotice({result,onClose}:{result:ImportResult;onClose:()=>void}){
 const [expanded,setExpanded]=useState(false),groups=result.impact.rows.filter(r=>r.inflow>0),visible=expanded?groups:groups.slice(0,3);
 return <section className="dbs-import-result" aria-label="DB 추가 결과"><div className="dbs-result-head"><CheckCircle2 size={18}/><strong role="status">목록 {result.total}건 추가 · STEP 2 유입 {result.impact.inflow}건 반영</strong><button type="button" aria-label="추가 결과 닫기" onClick={onClose}><X size={16}/></button></div>{visible.length>0&&<div className="dbs-result-rows">{visible.map(g=><div className="dbs-result-row" key={g.date+g.channel}><time>{g.date}</time><span className="dbs-result-channel">{g.channel}</span><span>STEP 2 · 컨택관리 <b>유입 +{g.inflow}</b></span></div>)}</div>}{result.total>result.impact.inflow&&<p className="dbs-result-skipped">{result.total-result.impact.inflow}건은 유입 추가 집계 없음</p>}{groups.length>3&&<button className="dbs-result-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'접기':`날짜·채널 ${groups.length-3}개 더 보기`}<ChevronDown size={14}/></button>}</section>;
}
