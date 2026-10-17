import {columns,outcomeDisplayLabel,type Key,type Row} from './model';

export const MIN_COLUMN_WIDTH=42,MAX_COLUMN_WIDTH=800;
export const clampColumnWidth=(value:number)=>Math.max(MIN_COLUMN_WIDTH,Math.min(MAX_COLUMN_WIDTH,Math.ceil(value)));
export function columnText(row:Row,key:Key){
 if(key==='inflow')return row.inflowStatus?.state==='recorded'?'반영됨':row.inflowStatus?.state==='excluded'?'미반영':'확인 필요';
 if(key==='result'||key==='stage')return outcomeDisplayLabel(row[key]);
 return (row[key]||'—').replace(/[\t\r\n\f ]+/g,' ').trim();
}
/** Measure displayed values, not character counts (e.g. WWW and iii differ). */
export function fitColumnWidth(key:Key,rows:Row[],headerWidth:number,measure:(text:string)=>number,padding:number){
 return clampColumnWidth(rows.reduce((max,row)=>Math.max(max,measure(columnText(row,key))+padding),headerWidth));
}
const px=(value:string)=>parseFloat(value)||0;
const horizontal=(style:CSSStyleDeclaration)=>px(style.paddingLeft)+px(style.paddingRight)+px(style.marginLeft)+px(style.marginRight);
/** Batch intrinsic DOM measurements preserve the actual font's shaping and kerning. */
export function measureColumnWidths(grid:HTMLElement,rows:Row[]):Record<string,number>{
 const table=grid.querySelector('table')!;if(!table)return {};
 const base=getComputedStyle(table),regular=grid.querySelector('.sheet-cell'),badge=grid.querySelector('.sheet-badge'),inflow=grid.querySelector('.dbs-inflow-badge');
 const bodyStyle=regular?getComputedStyle(regular):base;
 const badgeStyle=badge?getComputedStyle(badge):null,inflowStyle=inflow?getComputedStyle(inflow):null;
 const probe=document.createElement('div');probe.className='sheet-column-measure';probe.setAttribute('aria-hidden','true');
 probe.style.cssText='position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;contain:layout style paint';
 const requests=new Map<string,HTMLElement>(),cache=new Map<string,number>();let reading=false;
 const measure=(style:CSSStyleDeclaration,text:string,size=style.fontSize,weight=style.fontWeight)=>{
  const font=`${weight||'400'} ${size||'12px'} ${style.fontFamily||base.fontFamily}`,key=`${font}|${style.letterSpacing}|${style.fontFeatureSettings}|${style.fontVariationSettings}|${text}`;
  if(cache.has(key))return cache.get(key)!;
  if(!reading){if(!requests.has(key)){const span=document.createElement('span');span.style.cssText='position:absolute;display:block;width:max-content;max-width:none;white-space:nowrap;padding:0;margin:0;border:0';span.style.font=font;span.style.letterSpacing=style.letterSpacing;span.style.fontFeatureSettings=style.fontFeatureSettings;span.style.fontVariationSettings=style.fontVariationSettings;span.textContent=text;requests.set(key,span);probe.append(span);}return 0;}
  const width=requests.get(key)!.getBoundingClientRect().width;cache.set(key,width);return width;
 };
 const calculate=()=>{
 const opener=grid.querySelector('.sheet-row-open'),openerStyle=opener?getComputedStyle(opener):bodyStyle;
 const widths:Record<string,number>={number:clampColumnWidth(measure(openerStyle,String(Math.max(1,rows.length)))+horizontal(openerStyle)+22+1)};
 grid.querySelectorAll<HTMLElement>('th[data-column]').forEach(header=>{
  const key=header.dataset.column as Key;if(!columns.some(c=>c.key===key))return;
  const title=header.querySelector<HTMLElement>('.column-title')!,heading=header.querySelector<HTMLElement>('.column-heading')!;
  const titleStyle=getComputedStyle(title),parts=[...title.children] as HTMLElement[];
  const headerWidth=parts.reduce((n,part)=>{const style=getComputedStyle(part),text=measure(style,part.textContent||'');return n+Math.max(text,part.classList.contains('sort-direction')?px(style.width):0)+horizontal(style);},0)+Math.max(0,parts.length-1)*px(titleStyle.columnGap)+horizontal(titleStyle)+horizontal(getComputedStyle(heading))+1;
  // Separate table borders and fractional font metrics must not trigger an ellipsis by 1px.
  let padding=horizontal(bodyStyle)+3;
  const contentWidth=(text:string)=>{
   if(key==='inflow')return measure(inflowStyle||bodyStyle,text,inflowStyle?.fontSize||'11px',inflowStyle?.fontWeight||'400');
   if(key==='result'||key==='stage')return measure(badgeStyle||bodyStyle,text,badgeStyle?.fontSize||'11px',badgeStyle?.fontWeight||'500');
   return measure(bodyStyle,text,bodyStyle.fontSize,key==='company'?'600':base.fontWeight);
  };
  if(key==='inflow')padding=(inflowStyle?horizontal(inflowStyle):22)+12+4+3;
  if(key==='result'||key==='stage')padding+=badgeStyle?horizontal(badgeStyle):14;
  widths[key]=fitColumnWidth(key,rows,headerWidth,contentWidth,padding);
 });
 return widths;
 };
 calculate();document.body.append(probe);reading=true;
 try{return calculate();}finally{probe.remove();}
}
