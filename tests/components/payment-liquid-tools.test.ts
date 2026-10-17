import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
const read=(p:string)=>readFileSync(p,'utf8');
it('fills the payment tool row with three fixed targets and flexible idle and editing search',()=>{
 const css=read('app/(app)/payment/_components/mobile-tools.css');
 const row=css.match(/\.payment-mobile-tools\s*\{([^}]+)\}/)?.[1];
 expect(row).toContain('justify-content: flex-start');expect(row).toContain('gap: 0');expect(row).not.toContain('space-between');
 expect(css).toContain('flex: 0 0 var(--payment-tool-target)');
 expect(css).toContain('.payment-glass-search { flex: 1 1 0; justify-content: flex-start; gap: 7px; }');
 expect(css).toContain('.payment-glass-search .payment-tool-label { display: block; }');
 expect(css).toContain('.payment-glass-search-editor { flex: 1 1 0; min-width: var(--payment-tool-target); }');
 expect(css).toContain('.payment-glass-tool.is-expanded { flex: 1 1 0;');
});
it('keeps the scoped payment optical layers and safe opaque fallbacks without event interception',()=>{
 const shared=read('components/ui/liquid-glass-tools.css');
 expect(shared).toContain('--liquid-glass-ink:#334155');expect(shared).toContain('blur(18px) saturate(180%)');
 for(const mode of ['@supports not','prefers-reduced-transparency:reduce','forced-colors:active','--liquid-glass-transition:none'])expect(shared).toContain(mode);
 for(const global of [':root','@keyframes','url('])expect(shared).not.toContain(global);
 for(const p of ['app/(app)/payment/_components/mobile-tools.css','app/(app)/payment/payment-company-compact.css']){
  const css=read(p);expect(css).toContain('liquid-glass-tools.css');expect(css).toContain('background:var(--liquid-glass-surface)');
  expect(css).toContain('backdrop-filter:var(--liquid-glass-filter)');expect(css).toContain('pointer-events:none');
 }
});
