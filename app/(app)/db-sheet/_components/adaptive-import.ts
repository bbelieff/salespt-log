import {normalizeImportText,blankImportText,importTextFormat} from './import-text';
import { domesticPhoneDigits } from "@/util/db-sheet-identity";
import {blank,cleanCell,delimited,formatPhone,headerKey,parse,validDate,normalizeImportDate,normalizeImportArrears,isJunkImportRow,type Row,type Key} from './model';

export type ImportField = Exclude<Key,'inflow'|'stage'|'result'|'first'|'next'>;
export type Rules = Record<number,ImportField|'keep'>;
export type Question = {id:string;value:string;column:number;reason:string;choices:{key:ImportField|'keep';label:string}[]};
export type Item = {lead:Row;raw:string[];questions:Question[];selected:boolean;inflow:boolean;adjusted:boolean};
export type Analysis = {items:Item[];header:boolean;headings:string[];signature:string;format:string;tabular:boolean};
export const importFields: {key:ImportField;label:string}[] = [
 {key:'company',label:'사업자명'},{key:'owner',label:'대표자'},{key:'phone',label:'전화번호'},
 {key:'biz',label:'사업자번호'},{key:'date',label:'유입일'},{key:'supplier',label:'공급처'},
 {key:'channel',label:'공급처 유형'},{key:'funds',label:'필요자금'},{key:'sales',label:'매출'},
 {key:'address',label:'주소'},{key:'industry',label:'업종'},{key:'credit',label:'신용점수'},
 {key:'arrears',label:'체납여부'},{key:'note',label:'상담메모'},{key:'memo',label:'원본 메모'},
];
export function normalizeImportPhone(value:string) {
 const raw=value.replace(/^p:/i,'').trim();
 const digits=/^\+82/.test(raw)?domesticPhoneDigits(raw):raw.replace(/[\s()-]/g,'');
 return formatPhone(/^10\d{8}$/.test(digits)?'0'+digits:/^\d+$/.test(digits)?digits:raw);
}
const normalizedDate=normalizeImportDate;
export function setImportValue(row:Row,key:ImportField|'keep',value:string):Row {
 if(key==='keep'||key==='memo')return {...row,memo:[row.memo,value].filter(Boolean).join('\n')};
 let v=value;
 if(key==='phone')v=normalizeImportPhone(v);
 if(key==='date')v=normalizedDate(v);
 if(key==='arrears')v=normalizeImportArrears(v);
 return {...row,[key]:v};
}
function tokens(line:string):string[] {
 const output:string[]=[];let rest=line;
 for(const re of [/(?:p:)?\+82[ -]?(?:0?10)[ -]?\d{4}[ -]?\d{4}|\b010[ -]?\d{4}[ -]?\d{4}\b|\b10\d{8}\b/g,/\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b/g,/\b\d{3}-\d{2}-\d{5}\b/g,/\d[\d,.]*(?:천|만|억)?(?:만원|억원|원)/g])rest=rest.replace(re,v=>{output.push(v);return ' ';});
 const namePart=rest.replace(/\s+/g,' ').trim();
 const owner=namePart.match(/^(.*?)\s+([김이박최정강조윤장임한오서신권황안송류홍][가-힣]{1,3})$/);
 return [...(owner?[owner[1]!,owner[2]!]:namePart?[namePart]:[]),...output];
}
/** Fingerprint contains only structural categories. It never contains source values. */
function hash(value:string){let h=2166136261;for(const ch of value){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function analyzeImport(text:string,mode:'auto'|'yes'|'no'='auto',rules:Rules={}):Analysis {
 // A tab is a column delimiter: trim() would shift only the first heading row.
 if(text.length>5*1024*1024)throw new Error('5MB 이하 내용을 가져와 주세요.');
 const normalized=normalizeImportText(text);if(blankImportText(normalized))throw new Error('파일을 선택하거나 내용을 붙여넣어 주세요.');
 const {separator,firstRecord,offset,unterminated}=importTextFormat(normalized);
 const raw=normalized.slice(offset);
 const lines=raw.split('\n').filter(s=>!blankImportText(s));
 const labelStart=/^\s*(대표자|이름|사업자명|업체명|전화번호|연락처)\s*[:：]/;
 // Commas inside a free-text amount must not turn a whole message into CSV.
 if(unterminated&&/[\t,;]/.test(firstRecord))throw new Error('닫히지 않은 CSV 따옴표를 확인해 주세요.');
 const parts=firstRecord.split(',');
 const commaTable=separator===','&&(parts.length>=3||parts.length===2&&(!parts[0]!.includes(' ')||!!headerKey(parts[0]!)||/^010-\d{4}-\d{4}$/.test(normalizeImportPhone(parts[1]!))));
 const tableFirst=separator==='\t'||separator===';'||commaTable;
 const labeled=labelStart.test(lines[0]!)||!tableFirst&&lines.some(s=>labelStart.test(s));
 const tabular=!labeled&&(tableFirst||lines.length>1&&lines.every(s=>s.includes(',')));
 let matrix=tabular?delimited(raw):labeled?raw.split(/\n[\s\u200B\u2060]*\n/).map(s=>s.split(/\r?\n/).filter(Boolean)):lines.map(tokens);
 const first=matrix[0]||[];
 const recognized=first.filter(v=>headerKey(v)).length;
 const keysFirst=first.map(h=>headerKey(h));
 // 전화번호 + (이름·업체·사업자번호) 머리글이 함께 있으면 제목행이다 — 모르는 머리글이 섞여도(신청 폼 질문 등).
 const core=keysFirst.includes('phone')&&keysFirst.some(k=>k==='owner'||k==='company'||k==='biz');
 const header=tabular&&(mode==='yes'||mode==='auto'&&recognized>=2&&(core||recognized>=first.filter(Boolean).length/2||first.some(h=>/^(ad_id|form_id|created_time|lead_id)$/i.test(h.trim()))));
 const headings=header?first:[];if(header)matrix=matrix.slice(1).filter(cells=>!isJunkImportRow(cells,headings));
 if(!matrix.length)throw new Error('제목행 아래에 고객 정보를 넣어 주세요.');
 if(matrix.length>500)throw new Error('한 번에 500건 이하로 나눠 가져와 주세요.');
 const shape=(v:string)=>/^\+?\d[\d\s()+.-]*$/.test(v)?'number':validDate(normalizedDate(v))?'date':/[가-힣A-Za-z]/.test(v)?'text':'other';
 const signature='v1-'+hash(header?'h:'+headings.map(h=>headerKey(h)||hash(h)).join('|'):'v:'+Math.max(...matrix.map(r=>r.length))+':'+Array.from({length:Math.max(...matrix.map(r=>r.length))},(_,c)=>[...new Set(matrix.map(r=>shape(r[c]||'')))].sort().join('/')).join('|'));
 const used=Object.values(rules).filter(k=>k!=='keep'&&k!=='memo'&&k!=='note');
 if(new Set(used).size!==used.length)throw new Error('같은 항목에 여러 열이 연결됐습니다. 하나만 선택해 주세요.');
 let parsed:Row[]|null=null;
 if(header){const overrides=Object.fromEntries(Object.entries(rules).map(([k,v])=>[k,v==='keep'?'':v]));parsed=parse(raw,overrides);}
 const items=matrix.map((cells,index)=>{
  const item:Item={lead:parsed?.[index]||blank(),raw:cells,questions:[],selected:true,inflow:true,adjusted:false};
  const put=(key:ImportField|'keep',value:string)=>{
   if(key!=='keep'&&key!=='memo'&&key!=='note'&&item.lead[key]&&!['channel','arrears'].includes(key)){
    item.questions.push({id:`${index}-collision-${item.questions.length}`,value,column:-1,reason:'이미 배치한 값이 있어요. 원문에 보관하거나 아래에서 직접 수정해 주세요.',choices:[{key:'keep',label:'원문에 보관'}]});return;
   }
   item.lead=setImportValue(item.lead,key,value);
  };
  const ask=(value:string,column:number,reason:string,keys:ImportField[])=>item.questions.push({id:`${index}-${column}`,value,column,reason,choices:[...keys.map(key=>({key,label:importFields.find(f=>f.key===key)!.label})),{key:'keep' as const,label:'원문에 보관'}]});
  if(parsed)item.lead.phone=normalizeImportPhone(item.lead.phone);
  cells.forEach((cell,c)=>{
   let v=cleanCell(cell);if(!v)return;
   if(parsed&&(headerKey(headings[c]||'')||rules[c]||/^(id|.*_id|platform|is_organic)$/i.test(headings[c]||'')))return;
   const label=labeled?v.match(/^\s*([^:：]+)[:：]\s*(.*)$/):null;
   const key=label?headerKey(label[1]!):undefined;if(label)v=label[2]!.trim();
   if(rules[c]){put(rules[c]!,v);return;}
   if(key&&importFields.some(f=>f.key===key)){put(key as ImportField,v);return;}
   if(labeled){put('keep',cell);return;}
   const digits=v.replace(/[\s()-]/g,'');
   if(/^(?:p:)?\+82|^010(?:[ -]?\d){8}$/.test(v)&&/^010-\d{4}-\d{4}$/.test(normalizeImportPhone(v))){put('phone',normalizeImportPhone(v));return;}
   if(/^10\d{8}$/.test(digits)){ask(v,c,'앞자리 0이 빠진 휴대폰 또는 사업자번호일 수 있어요.',['phone','biz']);item.adjusted=true;return;}
   if(/^\d{10}$/.test(digits)){ask(v,c,'10자리 번호의 종류를 확인해 주세요.',['biz','phone']);return;}
   const d=normalizedDate(v);if(validDate(d)){put('date',d);return;}
   if(parsed)return;
   if(/(?:주식회사|\(주\)|상사|공방|식품|제작|홀딩스|스튜디오|테크)$/.test(v)){put('company',v);return;}
   if(/^[김이박최정강조윤장임한오서신권황안송류홍][가-힣]{1,3}$/.test(v)){put('owner',v);return;}
   if(/\d.*(?:원|억)$/.test(v)){ask(v,c,'매출인지 필요한 자금인지 확인해 주세요.',['funds','sales']);return;}
   if(/^[가-힣A-Za-z ]{2,60}$/.test(v)){ask(v,c,'대표자 이름인지 업체명인지 확인해 주세요.',['company','owner']);return;}
   put('keep',v);
  });
  // Original content is retained, including values that were normalized or assigned.
  item.lead.memo=[item.lead.memo,'[가져온 원문]',cells.join(tabular?' | ':'\n')].filter(Boolean).join('\n');
  return item;
 }).filter(item=>item.raw.some(cell=>!/^[-—–－−\s\u200B\u2060]*$/.test(cleanCell(cell))));
 if(!items.length)throw new Error('가져올 고객 정보가 없어요. 공란 표시가 아닌 실제 업체 내용을 넣어 주세요.');
 return {items,header,headings:header?headings:Array.from({length:Math.max(...matrix.map(r=>r.length))},(_,i)=>`${i+1}열`),signature,format:labeled?'항목별 텍스트':tabular?'표 형식':'줄별 텍스트',tabular};
}
export function resolveImportQuestion(item:Item,qid:string,key:ImportField|'keep'):Item {
 const q=item.questions.find(v=>v.id===qid);if(!q)return item;
 if(key!=='keep'&&key!=='memo'&&key!=='note'&&item.lead[key]&&item.lead[key]!==q.value)throw new Error('이미 값이 있는 항목입니다. 직접 수정하거나 원문에 보관해 주세요.');
 return {...item,lead:setImportValue(item.lead,key,q.value),adjusted:key==='phone'||key==='biz'||key==='keep'?false:item.adjusted,questions:item.questions.filter(v=>v.id!==qid)};
}
