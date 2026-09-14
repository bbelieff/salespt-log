// Local synthetic API + actual components/CSS/fonts. Browser interaction is performed separately.
// Run: node tests/browser/weekly-pt-results-server.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "student-dashboard-"));
await build({ entryPoints: ["tests/browser/weekly-pt-results-fixture.tsx"], bundle: true,
  outfile: join(dir, "app.js"), platform: "browser", jsx: "automatic",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("navigation")
      ? "export const useRouter=()=>({push:p=>location.assign(p)}); export const usePathname=()=>location.pathname;"
      : 'import React from "react"; export default function Link({href,children,...rest}){return React.createElement("a",{...rest,href},children)}',
      loader: "js", resolveDir: process.cwd() }));
  }}] });
const css=spawnSync(process.execPath,["node_modules/tailwindcss/lib/cli.js","-i","app/globals.css","-o",join(dir,"style.css")],{encoding:"utf8"});
assert.equal(css.status,0,css.stderr);
let record={specialNotes:"테스트 특이사항",priorOutcome:"분석 완료\n\n점검 진행",revision:1,updatedAt:null};
// <style> reproduces production constraint html,body{height:100%} extended to #root
// so the fixture does not conceal the sticky-containment bug with root auto height.
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>주간 PT 검증</title><link rel="stylesheet" href="/style.css"><style>html,body,#root{height:100%}</style><body class="bg-gray-50"><div id="root"></div><script src="/app.js"></script></body></html>';
const server=createServer(async(req,res)=>{
 const path=req.url.split('?')[0];
 if(path.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(req.method==='POST') {let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);record={...record,...data,revision:record.revision+1};return res.end(JSON.stringify({revision:record.revision}));}
  return res.end(JSON.stringify(record));
 }
 res.setHeader('Content-Type',path==='/app.js'?'application/javascript':path==='/style.css'?'text/css':'text/html');
 res.end(path==='/app.js'?readFileSync(join(dir,'app.js')):path==='/style.css'?readFileSync(join(dir,'style.css')):html);
});
server.listen(54705,'127.0.0.1',()=>console.log('http://127.0.0.1:54705'));
