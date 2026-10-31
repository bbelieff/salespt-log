/** 실무/수납 합성 화면 서버(localhost 전용). node tests/browser/payment-live/server.mjs — 먼저 npm run build(글꼴). 가상 업체 10곳(장기관리 3곳). */
import {context} from 'esbuild';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'payment-live-'));
const nav=`import React,{useSyncExternalStore} from 'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const go=p=>{history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:go,replace:go,refresh:()=>{},prefetch:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);export default function Link({href,children,...p}){return <a {...p} href={href}>{children}</a>}`;
const mocks={'next-auth/react':`export const signOut=()=>{};export const useSession=()=>({data:null});`};
const ctx=await context({entryPoints:['tests/browser/payment-live/App.tsx'],bundle:true,outfile:join(dir,'app.js'),platform:'browser',jsx:'automatic',logLevel:'warning',external:['tesseract.js','pdfjs-dist/*'],define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'mock',setup(b){
 b.onResolve({filter:/.*/},a=>{if(mocks[a.path])return{path:a.path,namespace:'mock'};if(/^next\/(link|navigation)$/.test(a.path))return{path:'navigation',namespace:'mock'};if(a.path.endsWith('auth/RoleViewSwitch'))return{path:'role',namespace:'mock'};if(a.path.endsWith('announcements/AnnouncementsGate'))return{path:'ann',namespace:'mock'};});
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='navigation'?nav:a.path==='role'?`export default function RoleViewSwitch(){return null};export const useTrainerState=()=>({data:{canStudent:true,canTrainer:false}});`:a.path==='ann'?`export const ANNOUNCEMENTS_SEEN_EVENT='mock-ann';export const hasUnseenUpdates=()=>false;export default function AnnouncementsGate(){return null};`:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));
}}]});await ctx.rebuild();await ctx.watch();
const css=spawnSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','app/globals.css','-o',join(dir,'style.css'),'--content','app/**/*.{ts,tsx},components/**/*.{ts,tsx}'],{encoding:'utf8'});if(css.status!==0)throw new Error(css.stderr);
const built=readdirSync('.next/static/css').filter(f=>f.endsWith('.css')).map(f=>readFileSync(join('.next/static/css',f),'utf8')).join('\n');
const faces=(built.match(/@font-face\{[^}]+\}/g)||[]).filter(s=>s.includes('Noto')).join('\n');const family=faces.match(/font-family:([^;]+);/)?.[1];if(!family)throw new Error('Run npm run build first for production fonts');
const fontCss=faces.replaceAll('../media/','/media/').replaceAll('/_next/static/media/','/media/')+`:root{--font-noto-sans-kr:${family}}`;
const media=new Map(readdirSync('.next/static/media').map(f=>['/media/'+f,join('.next/static/media',f)]));
const slot=(o={})=>({진행기관:'',진행상품:'',진행률:'',현황:'',승인금액:0,수납액:0,수납일:'',메모:'',...o});
const names=['가나식당','다라상회','마바전기','사아산업','자차공방','카타물산','파하유통','가람정밀','나래푸드','다솜환경'];
const rows=names.map((n,i)=>{const done=i>=7;const s=done?slot({진행기관:'소진공',진행상품:'대환대출',진행률:'수납완료',승인금액:3000000,수납액:300000,수납일:'2026-10-01'}):slot({진행기관:'소진공',진행상품:'신용취약',진행률:'40%'});
 return {row:3+i,계약일:`2026-10-${String(1+i).padStart(2,'0')}`,업체명:`샘플${n}`,수임비:1100000,공동인증서:false,임대차계약서:false,신분증:false,드라이브업로드:false,사업계획서초안발송:false,컨설팅5종서류발송:false,플러그이관:false,
  수납1:s,수납2:!done&&i%2?slot({진행기관:'신용보증재단',진행상품:'특례자금',진행률:'20%'}):slot(),수납3:!done&&i%3===0?slot({진행기관:'중진공',진행상품:'혁신성장',진행률:'0%'}):slot(),로드맵메모:'',계약비고:'',해지일:'',해지사유:'',반환액:0,해지숨김:false,...(i===0?{추가진행:[slot({진행기관:'기술보증기금',진행상품:'보증',진행률:'60%'})]}:{})};});
const ref=r=>`${r.계약일}|${r.업체명}`;
const grants={unavailable:false,announcements:{g1:{id:'g1',title:'가상 소상공인 정책자금 공고',agency:'가상기관',regionText:'전국',maxAmount:'7천만원',deadlineText:'11/30',deadlineDate:'2026-11-30',link:'',lastSeen:'2026-10-30'}},companies:Object.fromEntries(rows.map(r=>[ref(r),{hasInfo:true,noRegion:false,matches:r.row%2?[{id:'g1',verdict:'match',reasons:['지역 전국'],urgent:false}]:[]}]))};
const ci={소재지:'경북 청도군 가상로 1',업태:'제조업',업종:'제조업',대표자:'김가상',개업일:'2016.10.10'};
const api=path=>path==='/api/contract-payment'?{rows}:path==='/api/todos'?{todos:[]}:path==='/api/grant-matches'?grants:path==='/api/company-info'?{업체정보:ci}:path==='/api/me'?{name:'연습사용자',cohort:'샘플',email:'mock@example.invalid',sessionRole:'student',courseStartISO:'2026-09-01'}:{};
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>실무/수납 합성 검증</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><body class="bg-slate-50 font-sans antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';
createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='GET'?api(path):{ok:true,row:3}));return;}
 const file=media.get(path)??({'/app.js':join(dir,'app.js'),'/app.css':join(dir,'app.css'),'/style.css':join(dir,'style.css')})[path];
 res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript;charset=utf-8':path.endsWith('.css')?'text/css;charset=utf-8':path.endsWith('.woff2')?'font/woff2':'text/html;charset=utf-8');
 res.end(path==='/font.css'?fontCss:file?readFileSync(file):html);
}).listen(Number(process.env.PORT||0),'127.0.0.1',function(){console.log(`PAYMENT_LIVE http://127.0.0.1:${this.address().port}/payment`);});
