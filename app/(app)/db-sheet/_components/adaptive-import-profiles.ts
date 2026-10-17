import {importFields,type Rules} from './adaptive-import';
const prefix='salespt.import-rules.v1.';
function key(account:string,signature:string) {
 // No account identifier, supplier, heading text, or customer values are stored.
 let h=2166136261;for(const c of account){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
 return prefix+(h>>>0).toString(16)+'.'+signature;
}
export function loadImportRules(account:string,signature:string):Rules|null {
 if(!account||typeof localStorage==='undefined')return null;
 try {
  const value:unknown=JSON.parse(localStorage.getItem(key(account,signature))||'null');
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const pairs=Object.entries(value);
  if(pairs.length>100||pairs.some(([c,f])=>!/^\d{1,3}$/.test(c)||typeof f!=='string'||f!=='keep'&&!importFields.some(v=>v.key===f)))return null;
  return Object.fromEntries(pairs) as Rules;
 }catch{return null;}
}
export function saveImportRules(account:string,signature:string,rules:Rules):boolean {
 if(!account||typeof localStorage==='undefined')return false;
 try{localStorage.setItem(key(account,signature),JSON.stringify(rules));return true;}catch{return false;}
}
export function removeImportRules(account:string,signature:string) {
 if(!account||typeof localStorage==='undefined')return;
 try{localStorage.removeItem(key(account,signature));}catch{/* Storage can be unavailable in private mode. */}
}
