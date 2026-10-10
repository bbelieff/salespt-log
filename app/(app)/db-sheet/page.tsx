"use client";
import React,{useState,useEffect} from 'react';
import {useGuardedRouter} from '@/components/DirtyGuard';
import TopHeader from '@/components/TopHeader';
import PageContainer from '@/components/PageContainer';
import {todayKST} from '@/util/week';
import {Row,Key,columns,defaults,blank,validDate} from './_components/model';
import {Grid} from './_components/Grid';
import {ImportDialog} from './_components/ImportDialog';
import {DbDetail} from './_components/DbDetail';
import {useDbSheet} from './_components/use-db-sheet';
import './db-sheet.css';
export default function DbSheetPage(){
 const router=useGuardedRouter(),data=useDbSheet(),rows=data.leads;
 const [mounted,setMounted]=useState(false),[draft,setDraft]=useState<Row|null>(null);
 const [visible,setVisible]=useState<Key[]>(defaults);
 const [filtersOpen,setFiltersOpen]=useState(false),[settings,setSettings]=useState(false),[importing,setImporting]=useState(false),[search,setSearch]=useState(''),[supplier,setSupplier]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[detail,setDetail]=useState('');
 useEffect(()=>{setMounted(true);const requested=new URLSearchParams(window.location.search).get('lead');if(requested)setDetail(requested);document.body.classList.add('db-sheet-route');try{const v=JSON.parse(localStorage.getItem('db-sheet-v3-columns')||'null');if(Array.isArray(v))setVisible(v.filter(k=>columns.some(c=>c.key===k)));}catch{}return()=>document.body.classList.remove('db-sheet-route');},[]);
 useEffect(()=>{if(mounted)localStorage.setItem('db-sheet-v3-columns',JSON.stringify(visible));},[visible,mounted]);
 const filtered=rows.filter(r=>(!search||[r.company,r.owner,r.phone].some(x=>x.includes(search)))&&(!supplier||r.supplier===supplier)&&(!from||r.date>=from)&&(!to||r.date<=to));
 const selected=rows.find(r=>r.id===detail),activeFilters=!!(search||supplier||from||to);
 if(!mounted)return null;
 return <><TopHeader pageEmoji="📋" pageTitle="DB관리시트"/><PageContainer width="fluid" className="sheet-page px-3 py-3 pb-28">
 <div aria-live="polite" className="text-xs mb-2">{data.loading?'불러오는 중…':data.pending?'저장 중…':!data.error?'저장됨':''}</div>
 {data.error&&<div role="alert" className="rounded border border-red-300 bg-red-50 p-3 mb-2 text-sm text-red-700">{data.error} <button onClick={()=>window.location.reload()}>새로고침</button></div>}
 <div className="sheet-subnav"><div><button className={false?'active':''} onClick={()=>router.push('/db')}>DB생산</button><button className={true?'active':''} onClick={()=>router.push('/db-sheet')}>DB관리시트</button></div></div>
 <section className="sheet-panel db-sheet-panel">
 <div className="sheet-panel-head"><div><h2>DB 목록 <span>{rows.length}</span></h2></div><div className={`sheet-filters ${filtersOpen?"filters-open":""}`}><input aria-label="DB 검색" className="sheet-input search" placeholder="사업자명, 대표자, 전화번호 검색" value={search} onChange={e=>setSearch(e.target.value)}/><button className="sheet-btn sheet-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}>필터{(supplier||from||to)?" •":""}</button><select aria-label="공급처 필터" className="sheet-input" value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">전체 공급처</option>{[...new Set(rows.map(r=>r.supplier))].map(v=><option key={v}>{v}</option>)}</select><div className="sheet-dates"><span>유입일</span><input className="sheet-input" type="date" aria-label="유입 시작일" value={from} onInput={e=>setFrom(e.currentTarget.value)} onChange={e=>setFrom(e.target.value)}/><span>~</span><input className="sheet-input" type="date" aria-label="유입 종료일" value={to} onInput={e=>setTo(e.currentTarget.value)} onChange={e=>setTo(e.target.value)}/></div>{activeFilters&&<button className="sheet-text-btn" onClick={()=>{setSearch('');setSupplier('');setFrom('');setTo('');}}>초기화</button>}<div className="sheet-table-tools" title="셀 클릭 수정 · 제목을 끌어 열 이동 · 경계를 끌어 너비/높이 조절">{activeFilters&&<span>{filtered.length}건</span>}<div><button className="sheet-btn" aria-expanded={settings} onClick={()=>setSettings(!settings)}>표시할 열</button></div></div></div><div className="sheet-add-actions"><button className="sheet-btn" onClick={()=>setDraft({...blank(),date:todayKST()})}>＋ 직접 입력</button><button className="sheet-btn primary" onClick={()=>setImporting(true)}>DB 가져오기</button></div></div>
 {draft&&<form className="sheet-direct-form" onSubmit={async e=>{e.preventDefault();if(!draft.company.trim()||!validDate(draft.date))return;try{await data.add([draft],draft.id);setDraft(null);}catch{}}}><strong>새 업체 입력</strong><div>{(["company","owner","phone","supplier","date"] as Key[]).map(k=><label key={k}>{columns.find(c=>c.key===k)?.label}<input autoFocus={k==="company"} className="sheet-input" aria-label={`직접 입력 ${columns.find(c=>c.key===k)?.label}`} type={k==="date"?"date":"text"} required={k==="company"||k==="date"} value={draft[k]} onInput={e=>setDraft({...draft,[k]:e.currentTarget.value})} onChange={e=>setDraft({...draft,[k]:e.target.value})}/></label>)}</div><footer><span>나머지 정보는 추가 후 표에서 입력하세요.</span><button type="button" className="sheet-btn" onClick={()=>setDraft(null)}>취소</button><button type="submit" className="sheet-btn primary" disabled={!draft.company.trim()||!validDate(draft.date)}>추가</button></footer></form>}

 {settings&&<div className="sheet-column-settings"><strong>필요한 정보만 표시하세요</strong><div>{columns.map(c=><label key={c.key}><input type="checkbox" checked={visible.includes(c.key)} onChange={e=>setVisible(e.target.checked?[...visible,c.key]:visible.filter(k=>k!==c.key))}/>{c.label}</label>)}</div><button className="sheet-text-btn" onClick={()=>{setVisible([...defaults]);window.dispatchEvent(new Event('db-sheet-reset-view'));}}>기본 8개 열로 되돌리기</button></div>}
 <Grid rows={filtered.map(r=>({...r,memo:r.contact.note.split(/\r?\n/)[0]||''}))} visible={visible} fail={!!data.error} onDetail={setDetail} onOpen={setDetail} onChange={data.edit}/><div className="sheet-panel-foot"><span>최초상담일과 현재상태는 영업 기록에서 자동 반영됩니다.</span><span>총 {filtered.length}건</span></div>
 </section></PageContainer>
 {selected&&<DbDetail key={selected.id} row={selected} draft={selected.contact} onChange={v=>data.contact(selected.id,v)} onEdit={(k,v)=>data.edit(selected.id,k,v)} onResult={(v,date)=>{void data.record(selected.id,v,date).catch(()=>{});}} onRegister={()=>{void data.register(selected.id).catch(()=>{});}} onOpen={()=>{void data.flush(selected.id).then(()=>router.push(`/contact?date=${selected.contact.date}&channel=${encodeURIComponent(selected.channel)}`)).catch(()=>{});}} onClose={()=>{void data.flush(selected.id).catch(()=>{});setDetail('');}}/>}
 {importing&&<ImportDialog rows={rows} onClose={()=>setImporting(false)} onApply={async added=>{await data.add(added,added[0]!.id);setImporting(false);}}/>}
 </>;
}
