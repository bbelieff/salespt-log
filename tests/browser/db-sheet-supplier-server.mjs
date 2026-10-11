// 「공급처별 성과」(DB관리시트 유입 경로 #10) 목업 서버 — 합성 데이터만, 운영 DB·OAuth·시트 접근 없음.
//   실행: node tests/browser/db-sheet-supplier-server.mjs   (먼저 npm run build 한 번 — 운영 폰트 .next/static 재사용)
//   열기: 출력된 주소 /db-sheet?view=suppliers
//   시나리오(화면 주소 뒤에): ?empty=1(DB 없음) · ?few=1(20건 미만뿐) · ?many=1(공급처 11곳) · ?error=1(첫 조회 실패)
// 실제 경로(route → service → repo → 단계 계산)를 PGlite 위에서 그대로 돌린다(tests/browser/db-sheet-live/server.mjs 와 같은 방식).
// 시드도 같은 API(import/contact/meeting)로 넣고, 미팅 상태·계약 행만 SQL 로 바꾼다. 날짜는 오늘(KST) 기준 상대값.
import {context,build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
import {createRequire} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'db-sheet-supplier-mockup-'));
const tenantStore=new AsyncLocalStorage();
globalThis.__supplierTenant=tenantStore;
const TENANTS={default:'fixture-sheet',empty:'fixture-empty',few:'fixture-few',many:'fixture-many'};

// ── 브라우저 번들: 실제 페이지 + 앱 껍데기, 로그인/공지/분석만 모의 ─────────────────────────────
const nav=`import React,{useSyncExternalStore} from 'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const go=p=>{if(!p.startsWith('/')||p.startsWith('//'))return;history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:go,replace:go,refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);export default function Link({href,children,onClick,...p}){return <a {...p} href={href} onClick={e=>{e.preventDefault();if(onClick)onClick(e);else go(String(href))}}>{children}</a>}`;
const mocks={
 './company-doc/CompanyDocAutofillButton':`export default function MockDoc(){return null;}`,
 './company-info/CompanyVaultSection':`export default function MockVault(){return null;}`,
 '@/query/me-hook':`export const useMe=()=>({data:{name:'연습사용자',cohort:'샘플',email:'mock@example.invalid',sessionRole:'student'},isLoading:false});`,
 '@/query/announcements-hook':`export const useAnnouncements=()=>({data:{latestPr:0,announcements:[],activeAnchor:null}});`,
 '@/analytics':`export const identifyUser=()=>{};export const resetUser=()=>{};export const markInternal=()=>{};export const clearInternal=()=>{};`,
 'next-auth/react':`export const signOut=()=>{};`,
};

// ── 서버: 실제 /api/db-sheet 를 PGlite 에 연결. 테넌트(시트 id)는 화면 주소의 시나리오로 고른다 ─────────
const database=new PGlite();
await database.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
await database.exec(readFileSync('lib/repo/db/migrations/0008_db_sheet.sql','utf8'));
globalThis.__supplierFixtureDb={query:async(sql,params=[])=>{const r=await database.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}};
const apiMocks={
 '@/service/db-sheet-sync':`export const queueDbSheetProductionSync=()=>{};`,
 '@/repo/db/client':`export const ensureSchema=async()=>{};export const upsertSheetRow=()=>{throw new Error("Unexpected mirror")};export const dbEnabled=()=>true;export const getDbPool=()=>({query:(...a)=>globalThis.__supplierFixtureDb.query(...a),connect:async()=>({query:(...a)=>globalThis.__supplierFixtureDb.query(...a),release(){}})});`,
 '@/auth/identity':`export class StudentViewContextError extends Error{};export const requireStudentViewContext=async()=>({ok:true,mode:'own',email:'fixture@example.test'});export const getWritableUserEmail=async()=> 'fixture@example.test';`,
 '@/repo/users':`export const findUserByEmail=async()=>({spreadsheetId:globalThis.__supplierTenant.getStore()??'${TENANTS.default}',email:'fixture@example.test',cohort:'0'});`,
 '@/service/sales-write':`export const queueSalesRowSync=()=>{};`,
 '@/service/meetings-write':`export const queueMeetingSheetSync=()=>{};`,
};
await build({entryPoints:['app/api/db-sheet/route.ts'],bundle:true,outfile:join(dir,'api.cjs'),format:'cjs',platform:'node',packages:'external',plugins:[{name:'fixture-api',setup(b){b.onResolve({filter:/.*/},a=>{const key=a.path.startsWith('./')&&a.importer.replaceAll('\\','/').endsWith('service/db-sheet.ts')?'@/service/'+a.path.slice(2):a.path;if(apiMocks[key])return{path:key,namespace:'fixture-api'};if(a.path==='./client'&&a.importer.includes('repo'))return{path:'@/repo/db/client',namespace:'fixture-api'};});b.onLoad({filter:/.*/,namespace:'fixture-api'},a=>({contents:apiMocks[a.path],loader:'ts'}));}}]});
const require=createRequire(resolve('package.json'));
// Resolve external Next/Zod packages from the worktree, not the temporary output directory.
const Module=require('node:module');const compiled=new Module(join(dir,'api.cjs'));compiled.paths=Module._nodeModulePaths(process.cwd());compiled._compile(readFileSync(join(dir,'api.cjs'),'utf8'),join(dir,'api.cjs'));const api=compiled.exports;
const {NextRequest}=require('next/server');
async function call(tenant,method,body){
 return tenantStore.run(tenant,async()=>{
  const request=new NextRequest('http://localhost/api/db-sheet',{method,...(method==='POST'?{body,headers:{'content-type':'application/json'}}:{})});
  return method==='POST'?api.POST(request):api.GET();
 });
}
async function post(tenant,command){const response=await call(tenant,'POST',JSON.stringify(command));const json=await response.json();if(!response.ok)throw new Error(`${command.action} ${response.status} ${json.error}`);return json.leads;}

// ── 합성 시드 ────────────────────────────────────────────────────────────────────────────────
const kstToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const shift=(iso,days)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const cut=shift(kstToday,-11);// 「이번 기간」 시작(오늘-11일). A·메타·미입력은 이날부터, B는 모두 이 전날까지.
let serial=0;
const CONTACT_ONLY=['부재','단순거절','재통화'],CONSULT=['컨택진행','컨택진행','상담 후 거절'];
/** plan: untouched | contact:<결과> | meeting:<예약|완료|취소|삭제|계약|계약+진행|계약+해지|변경→계약+진행> */
function group(supplier,channel,dates,plans){
 return plans.map((plan,i)=>{serial+=1;const date=dates(i);return {plan,lead:{id:randomUUID(),supplier,date,channel,company:`샘플 ${String(serial).padStart(3,'0')}상사`,owner:'김가상',phone:`010-0000-${String(1000+serial).slice(-4)}`,industry:'합성 업종',contact:{date,meetingDate:shift(date,3),time:'14:00',ci:{소재지:'합성시 가상구'},companyName:`샘플 ${String(serial).padStart(3,'0')}상사`}}};});
}
const repeat=(n,plan)=>Array.from({length:n},(_,i)=>typeof plan==='function'?plan(i):plan);
const recent=i=>shift(cut,i%12),earlier=i=>shift(cut,-1-(i%11));
const DEFAULT_SEED=[
 // 샘플디비A(매입DB) 40 = 미연락 10 + 연락만 14 + 상담 10(미팅 취소 1·삭제 1 포함) + 미팅 4(예약 2·완료 1·계약해지 1) + 계약 2(미팅 계약 1·진행 계약 1)
 ...group('샘플디비A','매입DB',recent,[...repeat(10,'untouched'),...repeat(14,i=>'contact:'+CONTACT_ONLY[i%3]),...repeat(8,i=>'contact:'+CONSULT[i%3]),'meeting:취소','meeting:삭제','meeting:예약','meeting:예약','meeting:완료','meeting:계약+해지','meeting:계약','meeting:계약+진행']),
 // 샘플디비B(매입DB) 25, 모두 기간 시작 전 = 미연락 5 + 연락 14 + 상담 5 + 미팅 1
 ...group('샘플디비B','매입DB',earlier,[...repeat(5,'untouched'),...repeat(14,i=>'contact:'+CONTACT_ONLY[i%3]),...repeat(5,'contact:컨택진행'),'meeting:예약']),
 // 메타 광고(직접생산) 30 = 미연락 6 + 연락 10 + 상담 10 + 미팅 2 + 계약 2(진행 계약 1 · 일정 변경 뒤 새 미팅에 연결된 진행 계약 1)
 ...group('메타 광고','직접생산',recent,[...repeat(6,'untouched'),...repeat(10,i=>'contact:'+CONTACT_ONLY[i%3]),...repeat(10,i=>'contact:'+CONSULT[i%3]),'meeting:예약','meeting:완료','meeting:계약+진행','meeting:변경→계약+진행']),
 // 공급처 미입력(매입DB) 3
 ...group('','매입DB',recent,repeat(3,'untouched')),
];
const FEW_SEED=[
 ...group('샘플디비C','매입DB',recent,[...repeat(4,'untouched'),...repeat(3,'contact:부재'),'contact:컨택진행','meeting:예약','meeting:계약']),
 ...group('가상 블로그','직접생산',recent,[...repeat(3,'untouched'),'contact:재통화','contact:컨택진행']),
];
const MANY_SEED=Array.from({length:11},(_,s)=>{const total=[24,21,18,15,12,10,8,6,5,3,2][s];const consult=Math.floor(total/4),contact=Math.floor(total/3);
 return group(`가상디비${String(s+1).padStart(2,'0')}`,s%3===2?'직접생산':'매입DB',recent,[...repeat(total-consult-contact-(s<2?1:0),'untouched'),...repeat(contact,'contact:부재'),...repeat(consult,'contact:컨택진행'),...(s<2?['meeting:계약']:[])]);}).flat();

let contractRow=6;
async function sql(text,params){await database.query(text,params);}
async function setMeeting(tenant,id,patch){await sql("update sheet_rows set payload=payload || $3::jsonb,updated_at=now() where spreadsheet_id=$1 and tab='meetings' and row_key=$2",[tenant,id,JSON.stringify(patch)]);}
async function addContract(tenant,lead,meetingId,extra={}){
 contractRow+=1;
 await sql("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values('0','fixture@example.test',$1,'contracts',$2,$3::jsonb)",[tenant,'r'+contractRow,JSON.stringify({계약일:shift(lead.date,4),업체명:lead.company,수임비:3000000,linkedMeetingId:meetingId,...extra})]);
}
async function seed(tenant,rows){
 if(!rows.length)return;
 const imported=await post(tenant,{action:'import',batchId:randomUUID(),leads:rows.map(r=>r.lead)});
 const revision=new Map(imported.map(l=>[l.id,l.revision]));
 for(const {plan,lead} of rows){
  if(plan==='untouched')continue;
  const [kind,value]=plan.split(':');
  if(kind==='contact'){const [saved]=await post(tenant,{action:'contact',id:lead.id,revision:revision.get(lead.id),date:lead.date,result:value,note:'합성 상담 메모'});revision.set(lead.id,saved.revision);continue;}
  const [saved]=await post(tenant,{action:'meeting',id:lead.id,revision:revision.get(lead.id)});revision.set(lead.id,saved.revision);
  const meetingId=saved.meetingId;
  if(value==='완료'||value==='취소'||value==='계약')await setMeeting(tenant,meetingId,{상태:value});
  if(value==='삭제')await setMeeting(tenant,meetingId,{_cleared:true});
  if(value==='계약+진행'){await setMeeting(tenant,meetingId,{상태:'계약'});await addContract(tenant,lead,meetingId);}
  if(value==='계약+해지'){await setMeeting(tenant,meetingId,{상태:'계약'});await addContract(tenant,lead,meetingId,{해지일:shift(lead.date,8),해지사유:'합성 해지'});}
  if(value==='변경→계약+진행'){
   await setMeeting(tenant,meetingId,{상태:'변경'});
   const root=(await database.query("select payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and row_key=$2",[tenant,meetingId])).rows[0].payload;
   const child={...root,id:randomUUID(),previousMeetingId:meetingId,상태:'계약',미팅날짜:shift(root.미팅날짜,2)};
   await sql("insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values('0','fixture@example.test',$1,'meetings',$2,$3::jsonb)",[tenant,child.id,JSON.stringify(child)]);
   await addContract(tenant,lead,child.id);
  }
 }
}
const started=Date.now();
await seed(TENANTS.default,DEFAULT_SEED);await seed(TENANTS.few,FEW_SEED);await seed(TENANTS.many,MANY_SEED);
// 시드 자체 검증: 기본 데이터의 서버 단계(funnel)가 기대 숫자와 정확히 맞는지(어긋나면 서버를 띄우지 않는다).
{
 const leads=await (await call(TENANTS.default,'GET')).json().then(j=>j.leads);
 const tally=supplier=>{const rows=leads.filter(l=>l.supplier===supplier);const at=steps=>rows.filter(l=>steps.includes(l.funnel)).length;return [rows.length,at(['상담','미팅','계약']),at(['미팅','계약']),at(['계약']),at(['유입'])];};
 const expected={'샘플디비A':[40,16,6,2,10],'샘플디비B':[25,6,1,0,5],'메타 광고':[30,14,4,2,6],'':[3,0,0,0,3]};
 for(const [supplier,want] of Object.entries(expected)){const got=tally(supplier);if(JSON.stringify(got)!==JSON.stringify(want))throw new Error(`seed mismatch ${supplier||'(미입력)'}: got ${got} want ${want}`);}
 if(leads.length!==98)throw new Error('seed mismatch total '+leads.length);
 console.log(`SEED_OK 98 leads (A 40/16/6/2 · B 25/6/1/0 · 메타 30/14/4/2 · 미입력 3) in ${Date.now()-started}ms · 기간 시작 ${cut} · 오늘 ${kstToday}`);
}

// ── 화면 번들·CSS·폰트 ─────────────────────────────────────────────────────────────────────
const ctx=await context({entryPoints:['tests/browser/db-sheet-supplier-fixture.tsx'],bundle:true,outfile:join(dir,'app.js'),platform:'browser',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-mock',setup(b){
 b.onResolve({filter:/.*/},args=>{if(mocks[args.path])return {path:args.path,namespace:'mock'};if(/^next\/(link|navigation)$/.test(args.path))return{path:'navigation',namespace:'mock'};if(args.path.endsWith('auth/RoleViewSwitch'))return{path:'role',namespace:'mock'};if(args.path.endsWith('announcements/AnnouncementsGate'))return{path:'ann',namespace:'mock'};});
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='navigation'?nav:args.path==='role'?`export default function RoleViewSwitch(){return null};export const useTrainerState=()=>({data:{canStudent:true,canTrainer:false}});`:args.path==='ann'?`export const ANNOUNCEMENTS_SEEN_EVENT='mock-ann';export const hasUnseenUpdates=()=>false;export default function AnnouncementsGate(){return null};`:mocks[args.path],loader:'tsx',resolveDir:process.cwd()}));
}}]});await ctx.rebuild();await ctx.watch();
const css=spawnSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','app/globals.css','-o',join(dir,'style.css'),'--content','app/**/*.{ts,tsx},components/**/*.{ts,tsx},tests/browser/db-sheet-supplier-fixture.tsx'],{encoding:'utf8'});if(css.status!==0)throw new Error(css.stderr);
const built=readdirSync('.next/static/css').filter(f=>f.endsWith('.css')).map(f=>readFileSync(join('.next/static/css',f),'utf8')).join('\n');
const faces=(built.match(/@font-face\{[^}]+\}/g)||[]).filter(s=>s.includes('Noto')).join('\n');const family=faces.match(/font-family:([^;]+);/)?.[1];if(!family)throw new Error('Run npm run build first for production fonts');const fontCss=faces.replaceAll('../media/','/media/').replaceAll('/_next/static/media/','/media/')+`:root{--font-noto-sans-kr:${family}}`;
const media=new Map(readdirSync('.next/static/media').map(f=>['/media/'+f,join('.next/static/media',f)]));
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DB관리시트 · 공급처별 성과 · 합성 목업</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/mock.css"><body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';

/** 화면 주소(Referer)의 시나리오 → 테넌트. fetch 는 같은 출처라 전체 주소를 Referer 로 보낸다. */
function scenario(req){
 let params;try{params=new URL(req.headers.referer||'http://x/').searchParams;}catch{params=new URLSearchParams();}
 if(params.get('error')==='1')return 'error';
 for(const key of ['empty','few','many'])if(params.get(key)==='1')return key;
 return 'default';
}
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'");res.setHeader('Cache-Control','no-store');
 if(path==='/api/db-sheet'){
  try{
   const which=scenario(req);
   if(which==='error'&&req.method==='GET'){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요.'}));}
   let body='';for await(const chunk of req)body+=chunk;
   const response=await call(TENANTS[which]??TENANTS.default,req.method==='POST'?'POST':'GET',body);
   res.writeHead(response.status,{'Content-Type':'application/json'});return res.end(await response.text());
  }catch(e){console.error(e);res.writeHead(500);return res.end('{}');}
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end('Mock server: writes disabled');}
 const files={'/app.js':join(dir,'app.js'),'/style.css':join(dir,'style.css'),'/mock.css':join(dir,'app.css'),'/salespt-logo.png':'public/salespt-logo.png'};
 if(path==='/font.css'){res.setHeader('Content-Type','text/css');return res.end(fontCss);}
 if(files[path]||media.has(path)){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'font/woff2');return res.end(readFileSync(files[path]||media.get(path)));}
 if(path.startsWith('/api/')||path.startsWith('/auth/')){res.writeHead(403);return res.end('Production API disabled in mockup');}
 if(['/','/db-sheet','/db','/contact','/dashboard','/calendar','/schedule','/payment','/weekly-goals'].includes(path)){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
 res.writeHead(404);res.end('Mock route not implemented');
});
server.listen(Number(process.env.PORT??0),'127.0.0.1',()=>{
 const base=`http://127.0.0.1:${server.address().port}`;
 console.log(`${base}/db-sheet?view=suppliers`);
 console.log(`MOCKUP_URL=${base}/db-sheet?view=suppliers  (시나리오: &empty=1 · &few=1 · &many=1 · &error=1)`);
});
