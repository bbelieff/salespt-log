// @vitest-environment jsdom
import React,{act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import SupplierFilter from '@/app/(app)/db-sheet/_components/SupplierFilter';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});

it('uses the shared 16px decorative disclosure without changing supplier selection',()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 try{
  act(()=>root.render(createElement(SupplierFilter,{options:['합성 공급처'],selected:[],onChange:change})));
  const trigger=host.querySelector('button')!,icon=trigger.querySelector('svg')!;
  expect(trigger.textContent).toBe('전체 공급처');expect(icon.getAttribute('width')).toBe('16');expect(icon.getAttribute('height')).toBe('16');
  expect(icon.hasAttribute('data-disclosure-chevron')).toBe(true);expect(icon.getAttribute('stroke-width')).toBe('1.75');expect(icon.style.transform).toBe('rotate(0deg)');
  expect(icon.getAttribute('aria-hidden')).toBe('true');expect(icon.classList.contains('shrink-0')).toBe(true);expect(trigger.getAttribute('aria-expanded')).toBe('false');
  act(()=>trigger.click());expect(trigger.getAttribute('aria-expanded')).toBe('true');expect(icon.style.transform).toBe('rotate(180deg)');expect(change).not.toHaveBeenCalled();
  act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(icon.style.transform).toBe('rotate(0deg)');
 }finally{act(()=>root.unmount());host.remove();}
});

it('uses the same neutral group as status, scopes teal to date, and preserves purple status/shared picker defaults',()=>{
 const page=readFileSync('app/(app)/db-sheet/page.tsx','utf8'),css=readFileSync('app/(app)/db-sheet/compact.css','utf8');
 expect(page).toContain('sheet-date-group rounded-xl border border-slate-200/80 bg-slate-200/65');
 expect(page).toContain('sheet-status-group rounded-xl border border-slate-200/80 bg-slate-200/65');
 expect(css).toContain('.sheet-date-group .sheet-inflow-period button[aria-pressed=true]{background:#0f766e;border-color:#0f766e;color:#fff}');
 expect(css).toContain('.sheet-status-chip[aria-pressed=true]{background:#7c3aed');
 expect(css).toContain('.sheet-supplier-filter[aria-expanded=true]>.sheet-supplier-chevron{transform:rotate(180deg)}');
 expect(css).toContain('.db-sheet-frame>.sheet-page{display:flex;flex-direction:column;');
 expect(css).toContain('.db-sheet-frame>.sheet-page>[role=alert]{flex:0 0 auto}');
});

it('uses a low-opacity horizontal freeze-edge fade without occupying the drag-insertion pseudo element',()=>{
 const css=readFileSync('app/(app)/db-sheet/db-sheet.css','utf8');
 const freeze=css.match(/\.has-frozen-company \.sheet-resizable \.sheet-company-column \{([^}]+)\}/)![1]!;
 expect(freeze).toContain('position:sticky;left:var(--sheet-number-width);z-index:2');
 expect(freeze).not.toContain('box-shadow');expect(freeze).toContain('border-right-color:rgba(148,163,184,.35)');
 const fade=css.match(/\.sheet-company-column::before \{([^}]+)\}/)![1]!;
 expect(fade).toContain('bottom:-1px;right:-7px;width:6px');expect(fade).toContain('linear-gradient(to right,rgba(100,116,139,.08),rgba(100,116,139,0))');expect(fade).toContain('pointer-events:none');
 expect(css).toContain('th.drop-before:after');expect(css).toContain('th.drop-after:after');expect(css).toContain('box-shadow:inset 0 0 0 1px #cbd5e1');
});
it('keeps compact parallel filters and save signals without shipping synthetic labels',()=>{
 const page=readFileSync('app/(app)/db-sheet/page.tsx','utf8'),css=readFileSync('app/(app)/db-sheet/compact.css','utf8'),options=readFileSync('app/(app)/db-sheet/_components/MobileViewOptions.tsx','utf8');
 expect(page).toContain('sheet-mobile-date-trigger');expect(page).toContain('sheet-mobile-status-trigger');expect(css).toContain('height:48px;min-height:48px');
 expect(page).toContain("data.error?'오류':'저장됨'");expect(page).toContain("data.loading?'불러오는 중…':data.pending?'저장 중…'");expect(page).not.toContain('(합성)');
 expect(options).not.toContain('sheet-options-note');expect(page).not.toContain('최초상담일은 수정할 수 있어요.');
 expect(page).toContain('onReset={resetFilters}><div ref={setMobileToolsTarget}/>');
});
it('keeps three neutral circular actions above one 34px filter row without changing existing actions or 48px rows',()=>{
 const page=readFileSync('app/(app)/db-sheet/page.tsx','utf8'),css=readFileSync('app/(app)/db-sheet/compact.css','utf8');
 expect(page).toContain("import {Plus,ClipboardPaste,SlidersHorizontal} from 'lucide-react'");expect(page).not.toContain('<Upload');
 expect(page).toContain('<ClipboardPaste className="sheet-mobile-action-icon" size={18} strokeWidth={1.75}');
 expect(page.match(/size=\{18\} strokeWidth=\{1\.75\}/g)).toHaveLength(3);
 expect(page).toContain("유입일<DisclosureChevron open={mobileFilter==='date'} />");expect(page).toContain("상태<DisclosureChevron open={mobileFilter==='status'} />");
 expect(css).toContain('border-radius:10px;background:white;padding:0 10px');
 expect(css).toContain('.sheet-panel-head :is(.sheet-btn,.sheet-btn.is-on){display:inline-flex');
 expect(css).toContain('.sheet-add-actions .sheet-btn{width:44px;min-width:44px;padding:0;border-radius:50%');
 expect(css).toContain('@import "../../../components/ui/liquid-glass-tools.css"');expect(css).toContain('background:var(--liquid-glass-surface)');expect(css).toContain('backdrop-filter:var(--liquid-glass-filter)');
 expect(css).not.toContain('.sheet-add-actions .sheet-btn.primary{background:#eff6ff');
 expect(css).toContain('.sheet-filters :is(.search,.sheet-mobile-date-trigger,.sheet-mobile-status-trigger){height:34px;min-height:34px');
 expect(css).toContain('.sheet-panel-head>div.sheet-list-title:first-child{flex-wrap:nowrap;gap:4px}');
 const filters=page.slice(page.indexOf('<div className="sheet-filters">'),page.indexOf('{!mobile&&tableTools}'));
 const actions=page.slice(page.indexOf('<div className="sheet-add-actions">'),page.indexOf('{!mobile&&<>{summary}'));
 expect(filters).not.toContain('sheet-view-options-trigger');
 expect(actions.indexOf('sheet-view-options-trigger')).toBeLessThan(actions.indexOf('<Plus'));
 expect(actions.indexOf('<Plus')).toBeLessThan(actions.indexOf('<ClipboardPaste'));
 expect(page.match(/className="sheet-btn sheet-view-options-trigger"/g)).toHaveLength(1);
 expect(actions).toContain('setMobileFilter(null);setOptionsOpen(true);');
 expect(actions).toContain('setDraft({...blank(),date:todayKST()})');expect(actions).toContain('onClick={()=>setImporting(true)}');
 expect(actions).toContain("mobile?'DB 붙여넣기/가져오기':'DB 가져오기'");
 expect(page).not.toContain('onPointerEnter');expect(page).not.toContain('navigator.clipboard');
 expect(css).toContain('background:rgba(226,232,240,.65);border-color:rgba(226,232,240,.8);box-shadow:none');
 expect(css).toContain('.sheet-btn:focus-visible{outline:2px solid #1d4ed8;outline-offset:2px}');expect(css).toContain('button:disabled{opacity:.45;cursor:not-allowed}');
 expect(css).toContain('height:48px;min-height:48px');expect(css).toContain('height:44px;min-height:44px;min-width:44px');
});
