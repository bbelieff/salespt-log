"use client";
import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {DirectInputDialog} from './_components/DirectInputDialog';
import {RecordingDialog} from './_components/RecordingDialog';
import SupplierFilter from './_components/SupplierFilter';
import {SupplierOptions} from './_components/SupplierInput';
import ImportResultNotice from './_components/ImportResultNotice';
import React,{useState,useEffect,useRef,useMemo} from 'react';
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
import {BulkBar,DeleteUndoBar,bulkOutcomeText} from './_components/BulkBar';
import {restoreVisibleColumns} from './_components/visible-columns';
import MobileViewOptions from './_components/MobileViewOptions';
import MobileFilterMenu from './_components/MobileFilterMenu';
import {Plus,ClipboardPaste,SlidersHorizontal} from 'lucide-react';
import {STATUS_FILTERS,filterDbSheetRows,hasStatusRestriction,toggleStatusFilter,type StatusFilterId} from './_components/status-filter';
import './db-sheet.css';
import './recording.css';
import './compact.css';
import './bulk.css';
import './absence-link.css';
/** DB 목록이 먼저 보이도록 기본은 접힘. 공급처 바로가기 진입에서만 펼친다. */
export default function DbSheetPage(){
 const router=useGuardedRouter(),data=useDbSheet(),rows=data.leads,me=useMe();
 const sizingRows=useMemo(()=>rows.map(r=>({...r,memo:r.contact.note.split(/\r?\n/)[0]||''})),[rows]);
 const accountKey=me.isSuccess&&me.data.email?JSON.stringify([me.data.email,me.data.cohort,me.data.spreadsheetId]):'';
 const [period,setPeriod]=useState<InflowPeriodId>('all');
 const [mounted,setMounted]=useState(false),[draft,setDraft]=useState<Row|null>(null);
 const [visible,setVisible]=useState<Key[]>(defaults);
 const [settings,setSettings]=useState(false),[importing,setImporting]=useState(false),[search,setSearch]=useState(''),[selectedSuppliers,setSelectedSuppliers]=useState<string[]>([]),[from,setFrom]=useState(''),[to,setTo]=useState(''),[selectedStatuses,setSelectedStatuses]=useState<StatusFilterId[]>([]),[detail,setDetail]=useState('');
 const [mobile,setMobile]=useState(false),[optionsOpen,setOptionsOpen]=useState(false),[mobileToolsTarget,setMobileToolsTarget]=useState<HTMLDivElement|null>(null);
 const [mobileFilter,setMobileFilter]=useState<'date'|'status'|null>(null),dateTrigger=useRef<HTMLButtonElement>(null),statusTrigger=useRef<HTMLButtonElement>(null);
 const [recording,setRecording]=useState<{id:string;deleting:boolean}|null>(null);
 const [picked,setPicked]=useState<ReadonlySet<string>>(()=>new Set()),[bulkBusy,setBulkBusy]=useState(false),[bulkMessage,setBulkMessage]=useState('');
 const [summaryOpen,setSummaryOpen]=useState(false),listTop=useRef<HTMLSpanElement>(null);
 useEffect(()=>{setMounted(true);const params=new URLSearchParams(window.location.search),requested=params.get('lead');if(requested)setDetail(requested);if(params.get('view')==='suppliers')setSummaryOpen(true);document.body.classList.add('db-sheet-route');try{const keys=restoreVisibleColumns(key=>localStorage.getItem(key));if(keys)setVisible(keys);}catch{}return()=>document.body.classList.remove('db-sheet-route');},[]);
 useEffect(()=>{if(mounted)localStorage.setItem('db-sheet-v6-columns',JSON.stringify(visible));},[visible,mounted]);
 useEffect(()=>{const mq=window.matchMedia('(max-width:1023px)');const change=()=>{setMobile(mq.matches);if(!mq.matches){setOptionsOpen(false);setMobileFilter(null);}};change();if(mq.matches&&new URLSearchParams(window.location.search).get('view')==='suppliers')setOptionsOpen(true);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
 const range=inflowPeriodBounds(period,from,to),rangeFrom=range?.[0]??'',rangeTo=range?.[1]??'';
 const filtered=filterDbSheetRows(rows,{search,selectedSuppliers,from:rangeFrom,to:rangeTo,selectedStatuses});
 const shownIds=new Set(filtered.map(r=>r.id)),chosen=new Set([...picked].filter(id=>shownIds.has(id)));
 const selected=rows.find(r=>r.id===detail),statusRestricted=hasStatusRestriction(selectedStatuses),activeFilters=!!(search||selectedSuppliers.length||period!=='all'||selectedStatuses.length);
 const suppliers=[...new Set(rows.map(r=>r.supplier))];
 const restricted=!!(search||rangeFrom||rangeTo||statusRestricted||(selectedSuppliers.length&&suppliers.some(value=>!selectedSuppliers.includes(value))));
 async function changeInflow(id:string,value:boolean){const impact=await data.inflowPreview(id,value);if(impact.blockedReason)throw new Error(impact.blockedReason);await data.configureInflow(id,value);}
 function toggleSummary(open:boolean){setSummaryOpen(open);}
 function pick(ids:string[],checked:boolean){setBulkMessage('');setPicked(current=>{const next=new Set(current);for(const id of ids){if(checked)next.add(id);else next.delete(id);}return next;});}
 // 보이는(필터에 걸린) 줄 중 체크한 것만 바꾼다 — 숨은 줄이 몰래 바뀌지 않게.
 async function bulkInflow(value:boolean){setBulkBusy(true);setBulkMessage('');try{const out=await data.bulkInflow([...chosen],value);setBulkMessage(bulkOutcomeText(value?'유입 반영':'유입 미반영',out));}finally{setBulkBusy(false);}}
 async function bulkDelete(){setBulkBusy(true);setBulkMessage('');try{const ids=[...chosen];const out=await data.scheduleDelete(ids);setPicked(current=>new Set([...current].filter(id=>!ids.includes(id)||out.blocked.some(b=>b.id===id))));if(out.blocked.length)setBulkMessage(bulkOutcomeText('삭제',out));}finally{setBulkBusy(false);}}
 function resetFilters(){setSearch('');setSelectedSuppliers([]);setFrom('');setTo('');setPeriod('all');setSelectedStatuses([]);}
 // 공급처 줄은 같은 다중선택에 더하거나 뺀다. 합계는 전체 선택을 해제한다. 모바일은 요약 아래로 밀려난 목록 첫 줄로 내려 준다.
 function pickSupplier(value:string){setSelectedSuppliers(current=>value?(current.includes(value)?current.filter(item=>item!==value):[...current,value]):[]);if(value&&window.matchMedia?.('(max-width: 1023px)').matches)listTop.current?.scrollIntoView({block:'start'});}
 if(!mounted)return null;
 const tableTools=<div className="sheet-table-tools">
   <button className={`sheet-btn${summaryOpen?' is-on':''}`} aria-expanded={summaryOpen} aria-controls="db-supplier-summary" onClick={()=>toggleSummary(!summaryOpen)}><span className="app-header-pill sheet-toolbar-pill">공급처별 성과 <DisclosureChevron open={summaryOpen} /></span></button>
   <button className={`sheet-btn${settings?' is-on':''}`} aria-expanded={settings} aria-controls="db-visible-fields" onClick={()=>setSettings(!settings)}><span className="app-header-pill sheet-toolbar-pill">보여줄 항목 <DisclosureChevron open={settings} /></span></button>
  </div>;
 const summary=summaryOpen&&<SupplierSummary leads={rows} from={rangeFrom} to={rangeTo} selected="" selectedSuppliers={selectedSuppliers} loading={data.loading} error={data.error} onSelect={pickSupplier} onImport={()=>{setOptionsOpen(false);setImporting(true);}} onResetRange={()=>{setFrom('');setTo('');setPeriod('all');}} onClose={()=>toggleSummary(false)}/>;
 const dateFilter=<div className="sheet-filter-group sheet-date-group rounded-xl border border-slate-200/80 bg-slate-200/65 p-2 shadow-inner shadow-white/70">
 <InflowPeriod period={period} from={from} to={to} onPeriod={setPeriod} onFrom={setFrom} onTo={setTo}/></div>;
 const statusFilter=<div className="sheet-filter-group sheet-status-group rounded-xl border border-slate-200/80 bg-slate-200/65 p-2 shadow-inner shadow-white/70"><div className="sheet-status-filter-row">
  <span className="sheet-status-filter-label">상태</span>
  <div className="sheet-status-filter-chips" role="group" aria-label="DB 상태 필터">
   {STATUS_FILTERS.map(filter=>{const pressed=selectedStatuses.includes(filter.id);return <button key={filter.id} type="button" className="sheet-status-chip" aria-pressed={pressed} onClick={()=>setSelectedStatuses(current=>toggleStatusFilter(current,filter.id))}>{filter.label}</button>;})}
   <SupplierFilter options={suppliers} selected={selectedSuppliers} onChange={setSelectedSuppliers}/>
  </div>
  {restricted&&<span className="sheet-status-filter-summary" aria-live="polite">{filtered.length}건 표시</span>}
 </div></div>;
 const quickFilters=<div className="sheet-quick-filters">{dateFilter}{statusFilter}</div>;
 const columnSettings=settings&&<div id="db-visible-fields" className="sheet-column-settings"><strong>목록에서 보고 싶은 항목</strong><div>{columns.map(c=><label key={c.key}><input type="checkbox" checked={visible.includes(c.key)} onChange={e=>setVisible(e.target.checked?[...visible,c.key]:visible.filter(k=>k!==c.key))}/>{c.label}</label>)}</div><button className="sheet-text-btn" onClick={()=>{setVisible([...defaults]);window.dispatchEvent(new Event('db-sheet-reset-view'));}}>기본 항목으로 되돌리기</button></div>;
 return <SupplierOptions.Provider value={data.suppliers}><div className="db-sheet-frame" data-db-sheet-frame><TopHeader pageEmoji="📋" pageTitle="DB관리시트" pageNavigation={<nav className="sheet-banner-tabs" aria-label="DB 메뉴"><button type="button" onClick={()=>router.push('/db')}>DB생산</button><button type="button" aria-current="page" onClick={()=>router.push('/db-sheet')}>DB관리시트</button></nav>}/><PageContainer width="fluid" className="sheet-page px-3 py-3">
 {data.error&&<div role="alert" className="rounded border border-red-300 bg-red-50 p-3 mb-2 text-sm text-red-700">{data.error} <button onClick={()=>window.location.reload()}>새로고침</button></div>}
 <section className="sheet-panel db-sheet-panel">
 <div className="sheet-panel-head">
  <div className="sheet-list-title"><h2>DB 목록 <span>{rows.length}</span></h2><span aria-live="polite" className={`sheet-save-status${data.error?' is-error':''}`}>{data.loading?'불러오는 중…':data.pending?'저장 중…':data.error?'오류':'저장됨'}</span></div>
  <div className="sheet-filters">
   <input aria-label="DB 검색" className="sheet-input search" placeholder={mobile?'검색':'업체·대표자·전화번호'} value={search} onChange={e=>setSearch(e.target.value)}/>
   {mobile&&<><button ref={dateTrigger} type="button" className={`sheet-btn sheet-mobile-date-trigger${period!=='all'?' is-on':''}`} aria-label={`유입일 필터${period!=='all'?' 선택됨':''}`} aria-haspopup="dialog" aria-expanded={mobileFilter==='date'} onClick={()=>setMobileFilter(mobileFilter==='date'?null:'date')}>유입일<DisclosureChevron open={mobileFilter==='date'} /></button><button ref={statusTrigger} type="button" className={`sheet-btn sheet-mobile-status-trigger${selectedStatuses.length||selectedSuppliers.length?' is-on':''}`} aria-label={`상태 필터${selectedStatuses.length||selectedSuppliers.length?' 선택됨':''}`} aria-haspopup="dialog" aria-expanded={mobileFilter==='status'} onClick={()=>setMobileFilter(mobileFilter==='status'?null:'status')}>상태<DisclosureChevron open={mobileFilter==='status'} /></button></>}

   {!mobile&&activeFilters&&<button className="sheet-text-btn" onClick={resetFilters}>초기화</button>}
  </div>
  {!mobile&&tableTools}
  <div className="sheet-add-actions">{mobile&&<button type="button" className="sheet-btn sheet-view-options-trigger" aria-label={`설정(보기 옵션)${activeFilters?' 선택됨':''}`} title="설정(보기 옵션)" aria-haspopup="dialog" aria-expanded={optionsOpen} onClick={()=>{setMobileFilter(null);setOptionsOpen(true);}}><SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true"/></button>}<button className="sheet-btn" aria-label="직접 입력" title="직접 입력" onClick={()=>setDraft({...blank(),date:todayKST()})}><Plus className="sheet-mobile-action-icon" size={18} strokeWidth={1.75} aria-hidden="true"/><span className="app-header-pill sheet-toolbar-pill">＋ 직접 입력</span></button><button className="sheet-btn primary" aria-label={mobile?'DB 붙여넣기/가져오기':'DB 가져오기'} title={mobile?'DB 붙여넣기/가져오기':'DB 가져오기'} onClick={()=>setImporting(true)}><ClipboardPaste className="sheet-mobile-action-icon" size={18} strokeWidth={1.75} aria-hidden="true"/><span className="app-header-pill sheet-toolbar-pill">DB 가져오기</span></button></div>
 </div>
 {!mobile&&<>{summary}{quickFilters}{columnSettings}</>}
 {mobile&&<MobileViewOptions open={optionsOpen} count={filtered.length} onClose={()=>setOptionsOpen(false)} onReset={resetFilters}><div ref={setMobileToolsTarget}/>{tableTools}{summary}{columnSettings}</MobileViewOptions>}
 {mobile&&mobileFilter&&(mobileFilter==='date'?dateTrigger.current:statusTrigger.current)&&<MobileFilterMenu key={mobileFilter} title={mobileFilter==='date'?'유입일':'상태'} anchor={(mobileFilter==='date'?dateTrigger.current:statusTrigger.current)!} onClose={()=>setMobileFilter(null)}>{mobileFilter==='date'?dateFilter:statusFilter}</MobileFilterMenu>}

 <span ref={listTop} aria-hidden="true" className="block scroll-mt-app-content"/>
 {data.deleting&&<DeleteUndoBar key={JSON.stringify(data.deleting)} deleting={data.deleting} onUndo={data.undoDelete}/>}
 {data.notice&&<p role="alert" className="sheet-error">{data.notice} <button type="button" className="sheet-text-btn" onClick={data.clearNotice}>닫기</button></p>}
 {data.addition&&<ImportResultNotice key={JSON.stringify(data.addition)} result={data.addition} onClose={data.clearAddition}/>}
 <Grid sizingRows={sizingRows} mobileToolsTarget={mobile?mobileToolsTarget:undefined} rows={filtered.map(r=>({...r,memo:r.contact.note.split(/\r?\n/)[0]||''}))} visible={visible} fail={!!data.error} onDetail={setDetail} onChange={data.edit} selected={chosen} onSelect={pick} bulkBar={<BulkBar count={chosen.size} busy={bulkBusy} message={bulkMessage} onInflow={v=>void bulkInflow(v)} onDelete={()=>void bulkDelete()} onClear={()=>{setPicked(new Set());setBulkMessage('');}}/>}/>
 </section></PageContainer></div>
 {selected&&<DbDetail key={selected.id} row={selected} onStage={v=>data.stage(selected.id,v)} onAbsence={(entry,remove)=>data.absence(selected.id,entry,remove)} onLink={id=>data.linkMeeting(selected.id,id)} draft={selected.contact} onRestored={data.reload} onAsInfo={v=>data.asInfo(selected.id,v)} onInflowChange={value=>changeInflow(selected.id,value)} onDelete={()=>setRecording({id:selected.id,deleting:true})} onChange={v=>data.contact(selected.id,v)} onEdit={(k,v)=>data.edit(selected.id,k,v)} onResult={(v,date)=>{void data.record(selected.id,v,date).catch(()=>{});}} onRegister={()=>{void data.register(selected.id).catch(()=>{});}} onOpen={()=>{void data.flush(selected.id).then(()=>router.push(`/contact?date=${selected.contact.date}&channel=${encodeURIComponent(selected.channel)}`)).catch(()=>{});}} onClose={()=>{void data.flush(selected.id).catch(()=>{});setDetail('');}}/>}
 {draft&&<DirectInputDialog initial={draft} rows={rows} onClose={()=>setDraft(null)} onExisting={id=>{setDraft(null);setDetail(id);}} onSave={async(row,allow)=>{await data.add([row],row.id,allow?[row.id]:[]);setDraft(null);}}/>}
 {importing&&<ImportDialog accountKey={accountKey} rows={rows} onExisting={id=>{setImporting(false);setDetail(id);}} onClose={()=>setImporting(false)} onApply={async(added,allow)=>{await data.add(added,added[0]!.id,allow);setImporting(false);}}/>}
 {recording&&rows.find(r=>r.id===recording.id)&&<RecordingDialog row={rows.find(r=>r.id===recording.id)!} deleting={recording.deleting} onClose={()=>setRecording(null)} onPreview={v=>data.recordingPreview(recording.id,v,recording.deleting)} onConfirm={async v=>{await data.configure(recording.id,v,recording.deleting);if(recording.deleting)setDetail('');}}/>}
 </SupplierOptions.Provider>;
}
