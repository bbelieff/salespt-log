import {context,build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
if(process.env.DB_SHEET_PROBE_PORT && process.env.DB_SHEET_PROBE_PORT !== '61112')throw new Error('Only the dedicated loopback probe tunnel is allowed');
const remoteProbe=process.env.DB_SHEET_PROBE_PORT === '61112';
const dir=mkdtempSync(join(tmpdir(),'db-sheet-mockup-'));
const nav=`import React,{useSyncExternalStore} from 'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const go=p=>{if(!p.startsWith('/')||p.startsWith('//'))return;history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:go,replace:go,refresh:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);export default function Link({href,children,onClick,...p}){return <a {...p} href={href} onClick={e=>{e.preventDefault();if(onClick)onClick(e);else go(String(href))}}>{children}</a>}`;
const mocks={
 './company-doc/CompanyDocAutofillButton':`export default function MockDoc(){return null;}`,
 './company-info/CompanyVaultSection':`export default function MockVault(){return null;}`,

 '@/query/me-hook':`export const useMe=()=>({data:{name:'연습사용자',cohort:'샘플',email:'mock@example.invalid',sessionRole:'student'},isLoading:false});`,
 '@/query/announcements-hook':`export const useAnnouncements=()=>({data:{latestPr:0,announcements:[],activeAnchor:null}});`,
 '@/analytics':`export const identifyUser=()=>{};export const resetUser=()=>{};export const markInternal=()=>{};export const clearInternal=()=>{};`,
 'next-auth/react':`export const signOut=()=>{};`,
};
const database=new PGlite();
await database.exec(`create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));`);
await database.exec(readFileSync('lib/repo/db/migrations/0008_db_sheet.sql','utf8'));
globalThis.__dbSheetFixture={query:async(sql,params=[])=>{const r=await database.query(sql,params);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}};
const apiMocks={
 '@/service/db-sheet-sync':`export const queueDbSheetProductionSync=()=>{};`,
 '@/repo/db/client':`export const ensureSchema=async()=>{};export const upsertSheetRow=()=>{throw new Error("Unexpected mirror")};export const dbEnabled=()=>true;export const getDbPool=()=>({query:(...a)=>globalThis.__dbSheetFixture.query(...a),connect:async()=>({query:(...a)=>globalThis.__dbSheetFixture.query(...a),release(){}})});`,
 '@/auth/identity':`export class StudentViewContextError extends Error{};export const requireStudentViewContext=async()=>({ok:true,mode:'own',email:'fixture@example.test'});export const getWritableUserEmail=async()=> 'fixture@example.test';`,
 '@/repo/users':`export const findUserByEmail=async()=>({spreadsheetId:'fixture-sheet',email:'fixture@example.test',cohort:'0'});`,
 '@/service/sales-write':`export const queueSalesRowSync=()=>{};`,
 '@/service/meetings-write':`export const queueMeetingSheetSync=()=>{};`,
};
await build({entryPoints:['app/api/db-sheet/route.ts'],bundle:true,outfile:join(dir,'api.cjs'),format:'cjs',platform:'node',packages:'external',plugins:[{name:'fixture-api',setup(b){b.onResolve({filter:/.*/},a=>{const key=a.path.startsWith('./')&&a.importer.replaceAll('\\','/').endsWith('service/db-sheet.ts')?'@/service/'+a.path.slice(2):a.path;if(apiMocks[key])return{path:key,namespace:'fixture-api'};if(a.path==='./client'&&a.importer.includes('repo'))return{path:'@/repo/db/client',namespace:'fixture-api'};});b.onLoad({filter:/.*/,namespace:'fixture-api'},a=>({contents:apiMocks[a.path],loader:'ts'}));}}]});
const require=createRequire(resolve('package.json'));
// Resolve external Next/Zod packages from the worktree, not the temporary output directory.
const Module=require('node:module');const compiled=new Module(join(dir,'api.cjs'));compiled.paths=Module._nodeModulePaths(process.cwd());compiled._compile(readFileSync(join(dir,'api.cjs'),'utf8'),join(dir,'api.cjs'));const api=compiled.exports;
const {NextRequest}=require('next/server');
const ctx=await context({entryPoints:['tests/browser/db-sheet-live/App.tsx'],bundle:true,outfile:join(dir,'app.js'),platform:'browser',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-mock',setup(b){
 b.onResolve({filter:/.*/},args=>{if(mocks[args.path])return {path:args.path,namespace:'mock'};if(/^next\/(link|navigation)$/.test(args.path))return{path:'navigation',namespace:'mock'};if(args.path.endsWith('auth/RoleViewSwitch'))return{path:'role',namespace:'mock'};if(args.path.endsWith('announcements/AnnouncementsGate'))return{path:'ann',namespace:'mock'};});
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='navigation'?nav:args.path==='role'?`export default function RoleViewSwitch(){return null};export const useTrainerState=()=>({data:{canStudent:true,canTrainer:false}});`:args.path==='ann'?`export const ANNOUNCEMENTS_SEEN_EVENT='mock-ann';export const hasUnseenUpdates=()=>false;export default function AnnouncementsGate(){return null};`:mocks[args.path],loader:'tsx',resolveDir:process.cwd()}));
 b.onLoad({filter:/company-info-defs\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replace(/^.*f\(\["(?:업체|대표)기타메모".*\r?\n/gm,''),loader:'ts',resolveDir:resolve('components')}));
 }}]});await ctx.rebuild();await ctx.watch();
const css=spawnSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','app/globals.css','-o',join(dir,'style.css'),'--content','app/**/*.{ts,tsx},components/**/*.{ts,tsx},tests/browser/db-sheet/**/*.{ts,tsx}'],{encoding:'utf8'});if(css.status!==0)throw new Error(css.stderr);
const built=readdirSync('.next/static/css').filter(f=>f.endsWith('.css')).map(f=>readFileSync(join('.next/static/css',f),'utf8')).join('\n');
const faces=(built.match(/@font-face\{[^}]+\}/g)||[]).filter(s=>s.includes('Noto')).join('\n');const family=faces.match(/font-family:([^;]+);/)?.[1];if(!family)throw new Error('Run npm run build first for production fonts');const fontCss=faces.replaceAll('../media/','/media/').replaceAll('/_next/static/media/','/media/')+`:root{--font-noto-sans-kr:${family}}`;
const media=new Map(readdirSync('.next/static/media').map(f=>['/media/'+f,join('.next/static/media',f)]));
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DB관리시트 · 합성 목업</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/mock.css"><body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'");res.setHeader('Cache-Control','no-store');if(remoteProbe && ['/api/db-sheet','/fixture-proof'].includes(path)){try{let body='';for await(const chunk of req)body+=chunk;const response=await fetch('http://127.0.0.1:61112'+path,{method:req.method,...(req.method==='POST'?{body,headers:{'content-type':'application/json'}}:{})});res.writeHead(response.status,{'Content-Type':'application/json'});return res.end(await response.text());}catch{res.writeHead(503);return res.end(JSON.stringify({error:'Isolated PostgreSQL probe unavailable'}));}}if(path==='/api/db-sheet'){try{let body='';for await(const chunk of req)body+=chunk;const request=new NextRequest('http://localhost/api/db-sheet',{method:req.method,...(req.method==='POST'?{body,headers:{'content-type':'application/json'}}:{})});const response=await (req.method==='POST'?api.POST(request):api.GET());res.writeHead(response.status,{'Content-Type':'application/json'});return res.end(await response.text());}catch(e){console.error(e);res.writeHead(500);return res.end('{}');}}
if(path==='/fixture-proof'){const sales=await database.query("select row_key,payload from sheet_rows where tab='sales'");const meetings=await database.query("select row_key,payload from sheet_rows where tab='meetings'");res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({sales:sales.rows,meetings:meetings.rows}));}
if(req.method!=='GET'){res.writeHead(405);return res.end('Mock server: writes disabled');}const files={'/app.js':join(dir,'app.js'),'/style.css':join(dir,'style.css'),'/mock.css':join(dir,'app.css'),'/salespt-logo.png':'public/salespt-logo.png'};if(path==='/font.css'){res.setHeader('Content-Type','text/css');return res.end(fontCss);}if(files[path]||media.has(path)){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'font/woff2');return res.end(readFileSync(files[path]||media.get(path)));}if(path.startsWith('/api/')||path.startsWith('/auth/')){res.writeHead(403);return res.end('Production API disabled in mockup');}if(['/','/db-sheet','/db','/contact','/dashboard','/calendar','/schedule','/payment','/weekly-goals'].includes(path)){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}res.writeHead(404);res.end('Mock route not implemented');});
server.listen(61111,'127.0.0.1',()=>console.log(`MOCKUP_URL=http://127.0.0.1:${server.address().port}/db-sheet`));
