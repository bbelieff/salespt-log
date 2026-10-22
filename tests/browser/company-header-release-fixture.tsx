/** Actual released components with synthetic persistence only; no account, DB or external service. */
import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import CompanyInfoEditor from '@/components/CompanyInfoEditor';
import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {CompanyInfo} from '@/types';
import '@/app/(app)/payment/payment-company-compact.css';

function App() {
  const [width,setWidth]=useState(320),[failed,setFailed]=useState(false),[count,setCount]=useState(0),[controlled,setControlled]=useState(false);
  const failure=useRef(false);failure.current=failed;
  const initial=useRef(CompanyInfo.parse({대표자이름:'샘플 대표',사업자구분:'개인',과세유형:'일반과세'}));
  return <main className="mx-auto max-w-5xl p-3 text-slate-800">
    <p className="text-xs text-slate-500">실제 제품 컴포넌트 · 합성 저장/로컬 TXT · 고객/외부 연결 없음</p>
    <h1 className="my-3 text-lg font-bold">출시 A 헤더·펼침 아이콘 검증</h1>
    <div className="mb-3 flex flex-wrap gap-2">{[280,320,385,600].map(value=><button key={value} type="button" className="rounded border bg-white px-3 text-xs" style={{minHeight:44}} onClick={()=>setWidth(value)}>{value}px 칸</button>)}<label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={failed} onChange={event=>setFailed(event.target.checked)}/>저장 실패 시험</label><span className="text-xs" role="status">합성 저장 ACK {count}회</span></div>
    <section style={{width,maxWidth:'100%'}} data-release-ci>
      <CompanyInfoEditor value={initial.current} identityKey="synthetic-header-release" txtCompanyName="샘플업체" defaultOpen compactMobile desktopHeading defaultLayout="basic"
        onSave={async()=>{await new Promise(resolve=>setTimeout(resolve,600));if(failure.current)throw new Error('합성 저장 실패');setCount(value=>value+1);}} />
    </section>
    <section className="my-4 rounded-lg border bg-white p-3" aria-label="native 펼침 경계">
      <details open data-release-outer><summary className="disclosure-summary flex items-center justify-between p-2">바깥 native <DisclosureChevron/></summary>
        <details data-release-inner><summary className="disclosure-summary flex items-center justify-between p-2">안쪽 native <DisclosureChevron/></summary><p className="p-2 text-xs">안쪽 내용</p></details>
        <button type="button" data-release-controlled aria-expanded={controlled} className="flex items-center gap-2 p-2" style={{minHeight:44}} onClick={()=>setControlled(value=>!value)}>독립 controlled <DisclosureChevron open={controlled}/></button>
      </details>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
