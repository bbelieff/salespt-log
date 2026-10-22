/** Synthetic, localhost-only proof of actual product bytes; not a production account server. */
import {context} from 'esbuild';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'header-release-'));
const css=spawnSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','app/globals.css','-o',join(dir,'style.css'),'--content','./app/**/*.tsx,./components/**/*.tsx,./tests/browser/company-header-release-fixture.tsx'],{encoding:'utf8'});
assert.equal(css.status,0,css.stderr);
const bundle=await context({entryPoints:['tests/browser/company-header-release-fixture.tsx'],bundle:true,outfile:join(dir,'app.js'),platform:'browser',jsx:'automatic',logLevel:'warning',external:['tesseract.js','pdfjs-dist/*'],define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'fixture-navigation-only',setup(build){build.onResolve({filter:/^next\/navigation$/},args=>({path:args.path,namespace:'navigation'}));build.onLoad({filter:/.*/,namespace:'navigation'},()=>({loader:'js',contents:'export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>"/header-release";export const useSearchParams=()=>new URLSearchParams();'}));}}]});
await bundle.rebuild();await bundle.watch();
const fonts=join(process.env.FONT_BUILD_ROOT??'.next','static');
const fontSources=readdirSync(join(fonts,'css')).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(fonts,'css',name),'utf8')).join('\n');
const faces=(fontSources.match(/@font-face\{[^}]+\}/g)??[]).filter(value=>value.includes('Noto')).join('\n');
const family=faces.match(/font-family:([^;]+);/)?.[1];assert.ok(family,'Production font assets required');
const fontCss=faces.replaceAll('../media/','/media/').replaceAll('/_next/static/media/','/media/')+':root{--font-noto-sans-kr:'+family+'}';
const media=new Map(readdirSync(join(fonts,'media')).map(name=>['/media/'+name,join(fonts,'media',name)]));
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>출시 A 실제 컴포넌트 합성 검증</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><body class="bg-slate-50 font-sans antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Content-Security-Policy',"default-src 'self';script-src 'self';style-src 'self' 'unsafe-inline';font-src 'self';img-src 'self' data:;connect-src 'self';form-action 'none'");
 if(path==='/api/company-info/export'&&req.method==='POST'){res.setHeader('Content-Type','text/plain;charset=utf-8');res.end('샘플업체 · 합성 업체정보 TXT\n운영 데이터 없음');return;}
 if(path.startsWith('/api/')||req.method!=='GET'){res.writeHead(403);res.end('Fixture boundary: external and customer operations unavailable');return;}
 const file=media.get(path)??({'/app.js':join(dir,'app.js'),'/app.css':join(dir,'app.css'),'/style.css':join(dir,'style.css')})[path];
 res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript;charset=utf-8':path.endsWith('.css')?'text/css;charset=utf-8':path.endsWith('.woff2')?'font/woff2':'text/html;charset=utf-8');
 res.end(path==='/font.css'?fontCss:file?readFileSync(file):html);
});
server.listen(0,'127.0.0.1',()=>console.log(`HEADER_RELEASE_UI http://127.0.0.1:${server.address().port}/header-release`));
