import {normalizeImportText,blankImportText,importTextFormat} from './import-text';
import { DB_SHEET_RESULTS, type DbSheetManualStage, type DbSheetAbsence, dbSheetContactStage, dbSheetResultLabel, isDbSheetFollowUpResult, isQualifiedDbSheetContact, nextDbSheetFirstContact } from "@/types/db-sheet";
import {CHANNEL_ORDER} from '@/types/channel';
import { isValidISODate } from "@/util/week";
import { domesticPhoneDigits, isSameLead } from "@/util/db-sheet-identity";
export type Row = { manualStage?:DbSheetManualStage; absences?:DbSheetAbsence[]; linkedExisting?:boolean; asReceived?:boolean; asNote?:string; firstManual?:boolean; recording?:{inflow:boolean;activities:boolean}; inflowStatus?:{state:"recorded"|"excluded";date?:string;channel?:string;count:0|1}; inflow?:string; effectiveMeetingId?:string; meetingId?:string|null; id:string; supplier:string; date:string; channel:string; company:string; owner:string; phone:string; biz:string; address:string; industry:string; credit:string; sales:string; arrears:string; funds:string; result:string; first:string; hasQualifiedContact?:boolean; stage:string; next:string; memo:string; /** 화면 전용 칸 키(진행 단계) — 값은 stepShortcut 이 계산. */ step?:string; contact?:{meetingDate?:string}; contractRow?:number };
export type Key = Exclude<keyof Row,'contact'|'contractRow'|'manualStage'|'absences'|'linkedExisting'|'id'|'meetingId'|'recording'|'inflowStatus'|'effectiveMeetingId'|'hasQualifiedContact'|'asReceived'|'asNote'|'firstManual'>;
export const columns: {key:Key;label:string;auto?:boolean;width:number}[] = [
{key:'channel',label:'공급처 유형',width:110},{key:'supplier',label:'공급처',width:118},{key:'date',label:'유입일',width:115},{key:'inflow',label:'유입 반영',auto:true,width:90},{key:'company',label:'사업자명',width:154},{key:'owner',label:'대표자',width:100},{key:'phone',label:'전화번호',width:143},{key:'result',label:'컨택결과',width:110},{key:'step',label:'진행 단계',auto:true,width:150},{key:'next',label:'다음 연락일',width:120},{key:'funds',label:'필요자금',width:125},{key:'first',label:'최초상담일',width:122},{key:'biz',label:'사업자등록번호',width:145},{key:'address',label:'주소',width:210},{key:'industry',label:'업종',width:115},{key:'credit',label:'신용점수·기관',width:135},{key:'sales',label:'매출·기준',width:150},{key:'arrears',label:'체납여부',width:105},{key:'memo',label:'상담메모',auto:true,width:220}];
export const defaults:Key[]=['channel','supplier','date','inflow','company','owner','phone','result','step','next','first'];
/** 표에서 바로 고치는 칸(2026-10-23 belie 「keep-quick」) — 나머지 칸은 누르면 DB정보가 열린다. */
export const QUICK_EDIT_KEYS:readonly Key[]=['result','next'];
/** 컨택결과·현재상태 배지 색: 진행 중(파랑) · 기다림(재통화·장기관리, 주황) · 그 외 회색. */
export function stageBadgeClass(value:string):string{return ['컨택진행','상담 중','미팅예약','실무진행'].includes(value)?'is-active':['재통화','장기관리'].includes(value)?'is-wait':'';}
export const supplierPlaceholder=(channel:string)=>({'매입DB':'DB업체명','직접생산':'광고매체 · 예: 메타, 네이버','현수막':'현수막 제작업체','콜·지·기·소':'콜·지·기·소의 출처'}[channel]??'공급처 이름');
export const blank = ():Row => ({id:crypto.randomUUID(),supplier:'',date:'',channel:'매입DB',company:'',owner:'',phone:'',biz:'',address:'',industry:'',credit:'',sales:'',arrears:'미확인',funds:'',result:'미컨택',first:'',stage:'미컨택',next:'',memo:''});
const aliases:Record<string,Key>={'디비업체':'supplier','공급처':'supplier','DB공급처':'supplier','유입일':'date','날짜':'date','업체명':'company','사업자명':'company','상호':'company','대표자':'owner','이름':'owner','전화':'phone','연락처':'phone','전화번호':'phone','사업자등록번호':'biz','주소':'address','업종':'industry','신용점수':'credit','신용점수·기관':'credit','매출':'sales','매출·기준':'sales','체납':'arrears','체납여부':'arrears','필요자금':'funds','메모':'memo','한줄메모':'memo','채널':'channel','channel':'channel','유입채널':'channel','공급처유형':'channel','DB유형':'channel',
// 공급업체 엑셀 머리글(belie 2026-10-15): 대표자명·DB배정 일시·연 매출·연체/체납·지역 등.
'대표자명':'owner','대표명':'owner','대표자성명':'owner','배정일시':'date','배정일':'date','DB배정일시':'date','DB배정일':'date','접수일시':'date','신청일시':'date','등록일':'date','연매출':'sales','매출액':'sales','연체체납':'arrears','연체':'arrears','체납유무':'arrears','지역':'address','소재지':'address','사업장주소':'address','신용등급':'credit',
// 상담 신청 엑셀·구글시트 머리글(belie 2026-10-24): 접수시간·사업자번호·연매출액·국세체납·비고.
'접수시간':'date','접수일':'date','접수일자':'date','신청시간':'date','사업자번호':'biz','연매출액':'sales','국세체납':'arrears','세금체납':'arrears','비고':'memo'};
export function delimited(text:string):string[][] {text=normalizeImportText(text);const out:string[][]=[];let row:string[]=[];let cell='';let quoted=false;const format=importTextFormat(text);const sep=format.separator||';';text=text.slice(format.offset);for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else if(!cell.trim())quoted=true;else cell+='"';}else if(!quoted&&(c===sep||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){if(row.some(value=>!blankImportText(value)))out.push(row);row=[];}}else if(c!=='\r')cell+=c;}row.push(cell.trim());if(row.some(value=>!blankImportText(value)))out.push(row);if(quoted)throw new Error('닫히지 않은 CSV 따옴표를 확인해 주세요.');return out;}
export const headerKey=(s:string):Key|undefined=>{const name=s.replace(/^\uFEFF/,'').toLowerCase().replace(/[\s_?？:：\-/·()[\]]/g,'');if(/^신용(점수)?\d*$/.test(name))return 'credit';return ({fullname:'owner',name:'owner',phonenumber:'phone',phone:'phone',mobilephone:'phone',companyname:'company',company:'company',createdtime:'date',createdat:'date',streetaddress:'address',businessregistrationnumber:'biz',성함:'owner',성명:'owner',휴대폰번호:'phone',휴대전화번호:'phone',회사명:'company',신청일:'date',생성시간:'date',사업자명은:'company',대표자성함:'owner'} as Record<string,Key>)[name]||Object.entries(aliases).find(([k])=>k.toLowerCase().replace(/\s/g,'')===name)?.[1];};
/** 칸 값 다듬기 — 신청 폼이 남긴 목록 글(["정책자금"])은 「정책자금」으로. */
/** 날짜 앞부분만 YYYY-MM-DD 로 — 「2026. 9. 8 오후 4:55:43」·「2026-09-08T…」·「2026/9/8」. 못 읽으면 그대로. */
export function normalizeImportDate(value:string){const m=value.trim().match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?(?:T|\s|$)/);return m?`${m[1]}-${m[2]!.padStart(2,'0')}-${m[3]!.padStart(2,'0')}`:value;}
const YES=/^(예|네|y|yes|o|있음|유)$/i,NO=/^(아니오|아니요|아니|n|no|x|없음|무)$/i;
/** 체납 칸 — 예/아니오·O/X 도 있음/없음으로. */
export function normalizeImportArrears(value:string){return NO.test(value.trim())?'없음':YES.test(value.trim())?'있음':value;}
/** 「신용700」 같은 머리글의 예/아니오 → 700점 이상/미만(이상·미만 글자도 그대로 받음). */
export function normalizeImportCredit(header:string,value:string){const n=header.match(/\d{3,4}/);const v=value.trim();if(!n)return v;if(/^(이상|미만|초과|이하)$/.test(v))return `${n[0]}점 ${v}`;if(YES.test(v))return `${n[0]}점 이상`;if(NO.test(v))return `${n[0]}점 미만`;return v;}
/** 구글시트·엑셀에 섞인 반복 제목행·오류 줄(#REF! 등) — 고객 정보가 아니라 건너뛴다. */
const IMPORT_ERROR=/^#(REF!|N\/A|VALUE!|NAME\?|DIV\/0!|NULL!|NUM!|ERROR!)$/i;
export function isJunkImportRow(cells:readonly string[],headers:readonly string[]){const filled=cells.map(c=>cleanCell(c)).filter(Boolean);if(!filled.length)return true;return filled.every(v=>IMPORT_ERROR.test(v)||!!headerKey(v)||headers.some(h=>h.trim()===v));}
export function cleanCell(v:string){const t=v.trim();const list=t.match(/^\[(.*)\]$/);if(list){try{const a=JSON.parse(t);if(Array.isArray(a))return a.map(String).join(', ');}catch{return list[1]!.replace(/"/g,'').trim();}}return t;}
export function importHeaders(text:string){try{const raw=normalizeImportText(text);return importTextFormat(raw).separator?delimited(raw)[0]||[]:[];}catch{return [];}}
export function decodeImport(bytes:ArrayBuffer){const b=new Uint8Array(bytes);const encoding=b[0]===255&&b[1]===254?'utf-16le':b[0]===254&&b[1]===255?'utf-16be':'utf-8';try{return new TextDecoder(encoding,{fatal:true}).decode(b).replace(/^\uFEFF/,'');}catch{throw new Error('파일 인코딩을 읽지 못했습니다. UTF-8 CSV로 저장해 주세요.');}}
export function parse(text:string,overrides:Record<number,string>={}):Row[]{if(!text.trim())return [];const headers=importHeaders(text);if(headers.length){const rows=delimited(text);const keys=headers.map((h,i)=>Object.prototype.hasOwnProperty.call(overrides,i)?overrides[i] as Key||undefined:headerKey(h));const meta=headers.some(h=>/^(ad_id|form_id|campaign_id|created_time|lead_id)$/i.test(h.trim()));if(!keys.some(Boolean))throw new Error('열 연결에서 이름·사업자명·전화번호 등 항목을 선택해 주세요.');const used=keys.filter((k,i)=>k&&k!=='memo'&&Object.prototype.hasOwnProperty.call(overrides,i));if(new Set(used).size!==used.length)throw new Error('같은 항목에 여러 열이 연결됐습니다. 하나만 선택해 주세요.');return rows.slice(1).filter(values=>!isJunkImportRow(values,headers)).map(values=>{if(values.length>headers.length)throw new Error('열 개수가 다른 행이 있습니다. CSV 원문을 확인해 주세요.');while(values.length<headers.length)values.push('');const r=blank();const notes:string[]=[];if(meta){r.supplier='메타 광고';r.channel='직접생산';}const base=blank();keys.forEach((k,i)=>{const v=cleanCell(values[i]||'');if(!v||IMPORT_ERROR.test(v))return;if(!k||k==='memo'){notes.push(`${headers[i]}: ${v}`);return;}let x=v;if(k==='phone'){const cleaned=v.replace(/^p:/i,'').trim();x=formatPhone(/^\+82/.test(cleaned)?domesticPhoneDigits(cleaned):cleaned);}if(k==='date')x=normalizeImportDate(v);if(k==='arrears')x=normalizeImportArrears(v);if(k==='credit')x=normalizeImportCredit(headers[i]!,v);if(k==='biz')x=v.replace(/[\s]/g,'');
   // 같은 항목 열이 둘 이상(구글시트 「전화번호」 두 칸 등): 처음 값을 쓰고, 다른 값이면 원본 메모로 남긴다.
   if(r[k]&&r[k]!==base[k]){if(r[k]!==x)notes.push(`${headers[i]}: ${v}`);return;}r[k]=x;});r.memo=notes.join('\n');r.phone=formatPhone(r.phone);return r;});}return text.trim().split(/\n\s*\n/).map(block=>{const r=blank();for(const line of block.split('\n')){const match=line.match(/^\s*([^:：]+)[:：]\s*(.*)$/);if(match){const key=headerKey(match[1]!);if(key)r[key]=match[2]!.trim();}}if(!r.company&&!r.owner&&!r.phone)r.memo=block;r.phone=formatPhone(r.phone);return r;});}
export const metaSample='id,created_time,ad_id,form_id,platform,full_name,phone_number,company_name,필요자금,상담_희망시간\nlead_sample_1,2026-10-11T09:30:00+09:00,ad_sample,form_sample,fb,김가상,p:+821000004001,샘플 메타상사,5000만원,오후\nlead_sample_2,2026-10-11T10:00:00+09:00,ad_sample,form_sample,ig,이가상,+821000004002,샘플 메타공방,3000만원,오전';
export const norm=(s:string)=>s.replace(/[^0-9]/g,'');
/** 같은 업체가 이미 있나 — 판정은 서버 저장 차단과 같은 lib/util/db-sheet-identity. */
export function duplicate(r:Row,existing:Row[]){return existing.some(e=>isSameLead(r,e));}
/** 앞뒤 공백 없이 실제 달력에 있는 YYYY-MM-DD 인가 — 판정 정본은 lib/util/week.ts. */
export function validDate(value:string){return value===value.trim()&&isValidISODate(value);}
export const validChannel=(value:string)=>CHANNEL_ORDER.some(channel=>channel===value);
export function issues(r:Row){return [!validChannel(r.channel)?'공급처 유형':null,!r.company&&!r.owner?'이름/사업자명':null,!/^0[0-9-]{8,14}$/.test(r.phone)?'전화번호':null,!validDate(r.date)?'유입일':null,!r.supplier?'공급처':null].filter(Boolean).join(' · ');}
export const csvSample='사업자명,대표자,전화번호,필요자금,체납여부\n샘플 달빛공방,한가상,010-0000-2001,"5,000만원",\n샘플 온유상사,김가상,010-0000-1001,3천만원,없음\n샘플 푸른제작,윤가상,확인 필요,,미확인';
export const kakaoSample='사업자명: 샘플 은하상사\n대표자: 조가상\n연락처: 010-0000-3001\n필요자금: 7천만원\n체납: 미확인\n\n사업자명: 샘플 별빛식품\n대표자: 오가상\n전화번호: 확인 필요';

export const tsvSample='사업자명\t대표자\t전화번호\t필요자금\t체납여부\n샘플 달빛공방\t한가상\t010-0000-2001\t5,000만원\t\n샘플 온유상사\t김가상\t010-0000-1001\t3천만원\t없음\n샘플 푸른제작\t윤가상\t확인 필요\t\t미확인';
export const outcomes:readonly string[]=DB_SHEET_RESULTS;
/** 저장값은 그대로 두고 화면 이름만 바꾼다(AS예정→AS신청 · 컨택진행→미팅예약 · 상담 후 거절→컨택 후 거절). */
export const outcomeDisplayLabel=dbSheetResultLabel;
/** 컨택결과를 다시 말할 뿐인 현재상태 값 — 표에 따로 보이지 않는다(2026-10-25 belie 「현재상태 칸 없애고 필요한 것만 접기」). */
const CONTACT_DERIVED_STAGES=['미컨택','DB컨택중','상담 중'];
/** 컨택결과 옆 꼬리표 — 직접 정한 장기관리·진행종료만(미팅 뒤 진행은 「진행 단계」 칸이 보여 준다, 2026-10-25). */
export function resultTag(row:Pick<Row,'stage'|'result'|'meetingId'>):string{
 const s=(row.stage??'').trim();
 if(row.meetingId||!s||CONTACT_DERIVED_STAGES.includes(s)||s===outcomeDisplayLabel(row.result)||(row.result==='AS예정'&&s==='진행종료'))return '';
 return s;
}
/**
 * 「진행 단계」 칸(2026-10-25 belie 「어느 탭으로 가서 이어 갈지 바로가기」): 미팅이 잡힌 DB = STEP 3 일정(그 미팅으로),
 * 계약이 연결된 DB = STEP 4 실무/수납(그 업체로). 미팅 전 DB 는 DB관리시트에서 이어 가므로 비워 둔다. state = 지금 상태 한 마디.
 */
export function stepShortcut(row:Pick<Row,'stage'|'meetingId'|'effectiveMeetingId'|'contact'|'contractRow'>):{label:string;href:string;state:string}|null{
 const state=(row.stage??'').trim();
 if(row.contractRow)return {label:'STEP 4 실무/수납',href:`/payment?row=${row.contractRow}`,state};
 const id=row.effectiveMeetingId||row.meetingId;
 if(!id||state==='미팅 삭제됨')return null;
 const date=row.contact?.meetingDate??'';
 return {label:'STEP 3 일정',href:`/schedule?${date?`date=${encodeURIComponent(date)}&`:''}focus=${encodeURIComponent(id)}`,state};
}
/**
 * 「진행 단계」 칸 분류(2026-10-26 belie 「재통화 이하는 1.5, 미팅예약·컨택 후 거절은 2」) — 가장 멀리 간 단계 하나.
 * 계약 연결 = STEP 4 · 미팅 연결 = STEP 3 · 컨택결과 미팅예약/컨택 후 거절 = STEP 2 · 그 밖(미컨택·부재·단순거절·재통화·AS신청) = STEP 1.5.
 * href 는 다른 화면으로 이어 갈 때만(1.5 는 지금 이 화면이라 없음). rank = 정렬 순서(단계 → 단계 안 진행 순서).
 */
const STEP_STATE_ORDER=['미팅예약','미팅변경','미팅완료','계약','실무진행','수납대기','완료','장기관리','진행종료'];
export function stepStage(row:Pick<Row,'result'|'stage'|'meetingId'|'effectiveMeetingId'|'contact'|'contractRow'>):{step:'1.5'|'2'|'3'|'4';label:string;href:string|null;state:string;rank:number}{
 const link=stepShortcut(row);
 if(link){
  const four=link.label.startsWith('STEP 4');
  const i=STEP_STATE_ORDER.indexOf(link.state);
  return {step:four?'4':'3',label:link.label,href:link.href,state:link.state,rank:(four?400:300)+(i<0?STEP_STATE_ORDER.length:i)};
 }
 if(isQualifiedDbSheetContact(row.result))return {step:'2',label:'STEP 2 컨택관리',href:'/contact',state:outcomeDisplayLabel(row.result),rank:200+(row.result==='컨택진행'?0:1)};
 const i=outcomes.indexOf(row.result);
 return {step:'1.5',label:'STEP 1.5 DB관리시트',href:null,state:'',rank:100+(i<0?outcomes.length:i)};
}
/** 저장값은 그대로 두고 선택지에 STEP 2 집계 기준만 안내한다. */
export function outcomeLabel(result:string,activities=true):string {
 const qualified=isQualifiedDbSheetContact(result);
 return `${outcomeDisplayLabel(result)} · ${qualified?(activities?'STEP 2 컨택진행 +1':'STEP 2 기록 꺼짐'):'집계 제외'}`;
}

export function recordContact(row:Row,result:string,date:string):Row {
 const first=nextDbSheetFirstContact(row.first,result,date);
 const hasQualifiedContact=(row.hasQualifiedContact??!!row.first)||isQualifiedDbSheetContact(result);
 return {...row,result,first,hasQualifiedContact,stage:dbSheetContactStage({meetingId:row.meetingId,stage:row.stage,result,hasQualifiedContact})};
}

export const showsNextContact=(result:string)=>isDbSheetFollowUpResult(result);
/** 재통화인데 다음 연락일이 비었으면 일정 안내를 띄운다. */
export const needsRecallDate=(row:Pick<Row,'result'|'next'>)=>row.result==='재통화'&&!row.next;

export function formatPhone(value:string){const digits=domesticPhoneDigits(value);if(/^01[016789]\d{8}$/.test(digits))return digits.replace(/^(\d{3})(\d{4})(\d{4})$/,'$1-$2-$3');if(/^02\d{7,8}$/.test(digits))return digits.replace(/^(02)(\d{3,4})(\d{4})$/,'$1-$2-$3');if(/^0[3-9]\d{8,9}$/.test(digits))return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/,'$1-$2-$3');return value;}
