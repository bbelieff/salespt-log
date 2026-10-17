import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('applies the approved scoped liquid surface only to DB mobile toolbar geometry',()=>{
 const css=readFileSync('app/(app)/db-sheet/compact.css','utf8');
 for(const token of ['@import "../../../components/ui/liquid-glass-tools.css"','background:var(--liquid-glass-surface)','backdrop-filter:var(--liquid-glass-filter)','pointer-events:none','width:44px;min-width:44px;padding:0;border-radius:50%','height:34px;min-height:34px','height:48px;min-height:48px'])expect(css).toContain(token);
 expect(css).toContain('@media(max-width:1023px)');
});
