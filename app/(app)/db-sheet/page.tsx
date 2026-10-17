"use client";
import {DirectInputDialog} from './_components/DirectInputDialog';
import {RecordingDialog} from './_components/RecordingDialog';
import SupplierFilter from './_components/SupplierFilter';
import {SupplierOptions} from './_components/SupplierInput';
import ImportResultNotice from './_components/ImportResultNotice';
import React,{useState,useEffect,useRef} from 'react';
import {useGuardedRouter} from '@/components/DirtyGuard';
import TopHeader from '@/components/TopHeader';
import PageContainer from '@/components/PageContainer';
import {useMe} from '@/query/me-hook';
import {InflowPeriod} from './_components/InflowPeriod';
import {inflowPeriodBounds,type InflowPeriodId} from './_components/inflow-period';
import {todayKST} from '@/util/week';
import {Row,Key,columns,defaults,blank} from './_components/model';
import {Grid} from './_components/Grid';
import {ImportDialog} from './_components/ImportDialog';
import {DbDetail} from './_components/DbDetail';
import {useDbSheet} from './_components/use-db-sheet';
import {SupplierSummary} from './_components/SupplierSummary';
import {STATUS_FILTERS,filterDbSheetRows,hasStatusRestriction,toggleStatusFilter,type StatusFilterId} from './_components/status-filter';
import './db-sheet.css';
import './recording.css';
import './compact.css';
/** DB 목록이 먼저 보이도록 기본은 접힘. 공급처 바로가기 진입에서만 펼친다. */
export default function DbSheetPage(){
 const router=useGuardedRouter(),data=useDbSheet(),rows=data.leads,me=useMe();
 const accountKey=me.isSuccess&&me.data.email?JSON.stringify([me.data.email,me.data.cohort,me.data.spreadsheetId]):'';
 const [period,setPeriod]=useState<InflowPeriodId>('all');
 const [mounted,setMounted]=useState(false),[draft,setDraft]=useState<Row|null>(null);
 const [visible,setVisible]=useState<Key[]>(defaults);
 const [filtersOpen,setFiltersOpen]=useState(false),[settings,setSettings]=useState(false),[importing,setImporting]=useState(false),[search,setSearch]=useState(''),[selectedSuppliers,setSelectedSuppliers]=useState<string[]>([]),[from,setFrom]=useState(''),[to,setTo]=useState(''),[selectedStatuses,setSelectedStatuses]=useState<StatusFilterId[]>([]),[detail,setDetail]=useState('');
 const [recording,setRecording]=useState<{id:string;deleting:boolean}|null>(null);
 const [summaryOpen,setSummaryOpen]=useState(false),listTop=useRef<HTMLSpanElement>(null);
 useEffect(()=>{setMounted(true);const params=new URLSearchParams(window.location.search),requested=params.get('lead');if(requested)setDetail(requested);if(params.get('view')==='suppliers')setSummaryOpen(true);document.body.classList.add('db-sheet-route');try{const saved=localStorage.getItem('db-sheet-v5-columns');const v=JSON.parse(saved||localStorage.getItem('db-sheet-v4-columns')||localStorage.getItem('db-sheet-v3-columns')||'null');if(Array.isArray(v)){const keys=v.filter(k=>columns.some(c=>c.key===k));if(!saved&&!keys.includes('inflow'))keys.splice(Math.max(0,keys.indexOf('date')+1),0,'inflow');if(!saved&&!keys.includes('channel'))keys.splice(Math.max(0,keys.indexOf('supplier')),0,'channel');setVisible(keys);}}catch{}return()=>document.body.classList.remove('db-sheet-route');},[]);
 useEffect(()=>{if(mounted)localStorage.setItem('db-sheet-v5-columns',JSON.stringify(visible));},[visible,mounted]);
 const range=inflowPeriodBounds(period,from,to),rangeFrom=range?.[0]??'',rangeTo=range?.[1]??'';
 const filtered=filterDbSheetRows(rows,{search,selectedSuppliers,from:rangeFrom,to:rangeTo,selectedStatuses});
 const selected=rows.find(r=>r.id===detail),statusRestricted=hasStatusRestriction(selectedStatuses),activeFilters=!!(search||selectedSuppliers.length||period!=='all'||selectedStatuses.length);
 const suppliers=[...new Set(rows.map(r=>r.supplier))];
 const restricted=!!(search||rangeFrom||rangeTo||statusRestricted||(selectedSuppliers.length&&suppliers.some(value=>!selectedSuppliers.includes(value))));
 async function changeInflow(id:string,value:boolean){const impact=await data.inflowPreview(id,value);if(impact.blockedReason)throw new Error(impact.blockedReason);await data.configureInflow(id,value);}
 function toggleSummary(open:boolean){setSummaryOpen(open);}
 // 공급처 줄은 같은 다중선택에 더하거나 뺀다. 합계는 전체 선택을 해제한다. 모바일은 요약 아래로 밀려난 목록 첫 줄로 내려 준다.
 function pickSupplier(value:string){setSelectedSuppliers(current=>value?(current.includes(value)?current.filter(item=>item!==value):[...current,value]):[]);if(value&&window.matchMedia?.('(max-width: 1023px)').matches)listTop.current?.scrollIntoView({block:'start'});}
 if(!mounted)return null;
 return <SupplierOptions.Provider value={data.suppliers}><div className="db-sheet-frame" data-db-sheet-frame><TopHeader pageEmoji="📋" pageTitle="DB관리시트" pageNavigation={<nav className="sheet-banner-tabs" aria-label="DB 메뉴"><button type="button" onClick={()=>router.push('/db')}>DB생산</button><button type="button" aria-current="page" onClick={()=>router.push('/db-sheet')}>DB관리시트</button></nav>}/><PageContainer width="fluid" className="sheet-page px-3 py-3">
 {data.error&&<div role="alert" className="rounded border border-red-300 bg-red-50 p-3 mb-2 text-sm text-red-700">{data.error} <button onClick={()=>window.location.reload()}>새로고침</button></div>}
 <section className="sheet-panel db-sheet-panel">
 <div className="sheet-panel-head">
  <div className="sheet-list-title"><h2>DB 목록 <span>{rows.length}</span></h2><span aria-live="polite" className="sheet-save-status">{data.loading?'불러오는 중…':data.pending?'저장 중…':!data.error?'저장됨':''}</span></div>
  <div className={`sheet-filters ${filtersOpen?"filters-open":""}`}>
   <input aria-label="DB 검색" className="sheet-input search" placeholder="업체·대표자·전화번호" value={search} onChange={e=>setSearch(e.target.value)}/>
   <button className="sheet-btn sheet-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><span className="app-header-pill sheet-toolbar-pill">필터{(selectedSuppliers.length||period!=='all')?" •":""}</span></button>

   {activeFilters&&<button className="sheet-text-btn" onClick={()=>{setSearch('');setSelectedSuppliers([]);setFrom('');setTo('');setPeriod('all');setSelectedStatuses([]);}}>초기화</button>}
  </div>
  <div className="sheet-table-tools">
   <button className={`sheet-btn${summaryOpen?' is-on':''}`} aria-expanded={summaryOpen} aria-controls="db-supplier-summary" onClick={()=>toggleSummary(!summaryOpen)}><span className="app-header-pill sheet-toolbar-pill">공급처별 성과 <svg className="sheet-disclosure-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span></button>
   <button className={`sheet-btn${settings?' is-on':''}`} aria-expanded={settings} aria-controls="db-visible-fields" onClick={()=>setSettings(!settings)}><span className="app-header-pill sheet-toolbar-pill">보여줄 항목 <svg className="sheet-disclosure-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span></button>
  </div>
  <div className="sheet-add-actions"><button className="sheet-btn" onClick={()=>setDraft({...blank(),date:todayKST()})}><span className="app-header-pill sheet-toolbar-pill">＋ 직접 입력</span></button><button className="sheet-btn primary" onClick={()=>setImporting(true)}><span className="app-header-pill sheet-toolbar-pill">DB 가져오기</span></button></div>
 </div>
 {summaryOpen&&<SupplierSummary leads={rows} from={rangeFrom} to={rangeTo} selected="" selectedSuppliers={selectedSuppliers} loading={data.loading} error={data.error} onSelect={pickSupplier} onImport={()=>setImporting(true)} onResetRange={()=>{setFrom('');setTo('');setPeriod('all');}} onClose={()=>toggleSummary(false)}/>}
 <div className="sheet-quick-filters">
 <div className="sheet-filter-group sheet-date-group rounded-xl border border-slate-200/80 bg-slate-200/65 p-2 shadow-inner shadow-white/70">
 <InflowPeriod period={period} from={from} to={to} onPeriod={setPeriod} onFrom={setFrom} onTo={setTo}/></div>
 <div className="sheet-filter-group sheet-status-group rounded-xl border border-slate-200/80 bg-slate-200/65 p-2 shadow-inner shadow-white/70"><div className="sheet-status-filter-row">
  <span className="sheet-status-filter-label">상태</span>
  <div className="sheet-status-filter-chips" role="group" aria-label="DB 상태 필터">
   {STATUS_FILTERS.map(filter=>{const pressed=selectedStatuses.includes(filter.id);return <button key={filter.id} type="button" className="sheet-status-chip" aria-pressed={pressed} onClick={()=>setSelectedStatuses(current=>toggleStatusFilter(current,filter.id))}>{filter.label}</button>;})}
   <SupplierFilter options={suppliers} selected={selectedSuppliers} onChange={setSelectedSuppliers}/>
  </div>
  {restricted&&<span className="sheet-status-filter-summary" aria-live="polite">{filtered.length}건 표시</span>}
 </div></div>
 </div>

 {settings&&<div id="db-visible-fields" className="sheet-column-settings"><strong>목록에서 보고 싶은 항목</strong><div>{columns.map(c=><label key={c.key}><input type="checkbox" checked={visible.includes(c.key)} onChange={e=>setVisible(e.target.checked?[...visible,c.key]:visible.filter(k=>k!==c.key))}/>{c.label}</label>)}</div><button className="sheet-text-btn" onClick={()=>{setVisible([...defaults]);window.dispatchEvent(new Event('db-sheet-reset-view'));}}>기본 항목으로 되돌리기</button></div>}

 <span ref={listTop} aria-hidden="true" className="block scroll-mt-app-content"/>
 {data.addition&&<ImportResultNotice key={JSON.stringify(data.addition)} result={data.addition} onClose={data.clearAddition}/>}
 <Grid rows={filtered.map(r=>({...r,memo:r.contact.note.split(/\r?\n/)[0]||''}))} visible={visible} fail={!!data.error} onDetail={setDetail} onOpen={setDetail} onChange={data.edit}/><div className="sheet-panel-foot"><span>최초상담일은 수정할 수 있어요. 현재상태는 영업 기록에서 반영됩니다.</span><span>총 {filtered.length}건</span></div>
 </section></PageContainer></div>
 {selected&&<DbDetail key={selected.id} row={selected} draft={selected.contact} onRestored={data.reload} onAsInfo={v=>data.asInfo(selected.id,v)} onRecording={()=>setRecording({id:selected.id,deleting:false})} onInflowChange={value=>changeInflow(selected.id,value)} onDelete={()=>setRecording({id:selected.id,deleting:true})} onChange={v=>data.contact(selected.id,v)} onEdit={(k,v)=>data.edit(selected.id,k,v)} onResult={(v,date)=>{void data.record(selected.id,v,date).catch(()=>{});}} onRegister={()=>{void data.register(selected.id).catch(()=>{});}} onOpen={()=>{void data.flush(selected.id).then(()=>router.push(`/contact?date=${selected.contact.date}&channel=${encodeURIComponent(selected.channel)}`)).catch(()=>{});}} onClose={()=>{void data.flush(selected.id).catch(()=>{});setDetail('');}}/>}
 {draft&&<DirectInputDialog initial={draft} rows={rows} onClose={()=>setDraft(null)} onExisting={id=>{setDraft(null);setDetail(id);}} onSave={async(row,allow)=>{await data.add([row],row.id,allow?[row.id]:[]);setDraft(null);}}/>}
 {importing&&<ImportDialog accountKey={accountKey} rows={rows} onExisting={id=>{setImporting(false);setDetail(id);}} onClose={()=>setImporting(false)} onApply={async(added,allow)=>{await data.add(added,added[0]!.id,allow);setImporting(false);}}/>}
 {recording&&rows.find(r=>r.id===recording.id)&&<RecordingDialog row={rows.find(r=>r.id===recording.id)!} deleting={recording.deleting} onClose={()=>setRecording(null)} onPreview={v=>data.recordingPreview(recording.id,v,recording.deleting)} onConfirm={async v=>{await data.configure(recording.id,v,recording.deleting);if(recording.deleting)setDetail('');}}/>}
 </SupplierOptions.Provider>;
}
