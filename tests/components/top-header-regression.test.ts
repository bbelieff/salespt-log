import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);
const state = vi.hoisted(() => ({
  trainer: { canStudent: true, canTrainer: true, impersonating: false, name: "합성 트레이너" },
  graduationISO: "2026-10-01" as string | undefined,
}));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.trainer }) }));
vi.mock("@/components/DirtyGuard", () => ({ useGuardedNav: () => (fn: () => void) => fn() }));
vi.mock("@/query/me-hook", () => ({ useMe: () => ({ data: { name: "합성 사용자", cohort: "99", graduationISO: state.graduationISO } }) }));
vi.mock("@/query/announcements-hook", () => ({ useAnnouncements: () => ({ data: { latestPr: 0 } }) }));
vi.mock("@/config", () => ({ guideUrl: () => "" }));
vi.mock("@/analytics", () => ({ identifyUser: vi.fn(), resetUser: vi.fn(), markInternal: vi.fn(), clearInternal: vi.fn() }));
vi.mock("@/components/announcements/AnnouncementsGate", () => ({ ANNOUNCEMENTS_SEEN_EVENT: "synthetic-news", hasUnseenUpdates: () => false }));
import TopHeader from "@/components/TopHeader";

beforeEach(() => {
  state.trainer = { canStudent: true, canTrainer: true, impersonating: false, name: "합성 트레이너" };
  state.graduationISO = "2026-10-01";
});
const render = () => renderToStaticMarkup(React.createElement(TopHeader, { pageEmoji: "X", pageTitle: "합성 화면", roleMode: "student" }));

describe("shared header real React rendering", () => {
  it("renders the real role switch next to dashboard, with identity and D-day separately", () => {
    const html = render();
    expect(html).toContain('aria-label="접속 역할"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("합성 사용자");
    expect(html).toContain("D-—"); // DDayBadge hydration placeholder, not a mock.
    const actions = (html.split("data-header-actions")[1] ?? "").split("</header>")[0] ?? "";
    expect(actions).toContain("대시보드");
    expect(actions).toContain("트레이너");
    expect(actions).not.toContain("data-header-dday");
    expect(actions).not.toContain("합성 사용자");
  });
  it.each([true, false])("keeps impersonation marker separate from role actions: %s", impersonating => {
    state.trainer.impersonating = impersonating;
    const html = render();
    expect(html.includes("대리 접속 중")).toBe(impersonating);
    expect((html.split("data-header-actions")[1] ?? "").split("</header>")[0] ?? "").not.toContain("대리 접속 중");
    if (impersonating) expect(html).not.toContain('aria-pressed="true"');
  });
  it.each([[true, false], [false, true], [false, false]])("does not offer a dual-role switch for student=%s trainer=%s", (canStudent, canTrainer) => {
    Object.assign(state.trainer, { canStudent, canTrainer });
    expect(render()).not.toContain('aria-label="접속 역할"');
  });
  it.each([undefined, "not-a-date", "2026-02-30"])("renders safely with graduationISO=%s", graduation => {
    state.graduationISO = graduation;
    expect(render()).toContain("D-—");
    expect(render()).not.toContain("NaN");
  });
});

// Same external browser-tools convention as trainer-access-settings.browser.mjs.
// QA_TOOLS_DIR must contain Playwright. Ordinary unit CI explicitly skips this
// browser gate; release verification runs it with QA_TOOLS_DIR set (no live auth).
// No generated fixture, browser dependency or screenshot is written into the repo.
const browserScript = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = process.cwd();
const repo = createRequire(path.join(root, 'package.json'));
const { chromium } = createRequire(path.resolve(process.env.QA_TOOLS_DIR, 'package.json'))('playwright');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-header-956-'));
const mocks = [
  "import React from 'react';",
  "export const useMe=()=>({data:{cohort:'99',name:'합성 긴이름 사용자 테스트',graduationISO:window.__fixture.date}});",
  "export const useAnnouncements=()=>({data:{latestPr:0}});",
  "export const useQuery=()=>({data:{...window.__fixture,name:'합성 트레이너'}});",
  "export const usePathname=()=>location.pathname;",
  "export const useGuardedNav=()=>fn=>fn();",
  "export const guideUrl=()=>'';export const identifyUser=()=>{};export const resetUser=()=>{};export const markInternal=()=>{};export const clearInternal=()=>{};",
  "export const hasUnseenUpdates=()=>false;export const ANNOUNCEMENTS_SEEN_EVENT='synthetic-news';export const signOut=()=>{};",
  "export default function Link(props){return <a {...props}/>;}"
].join('\n');
(async () => {
  let browser;
  try {
    await repo('esbuild').build({
      stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import TopHeader from './components/TopHeader';createRoot(document.getElementById('root')).render(<TopHeader pageEmoji='X' pageTitle='합성 화면' roleMode={location.pathname.startsWith('/trainer')?'trainer':'student'}/>);",resolveDir:root,loader:'tsx'},
      outfile:path.join(temp,'app.js'),bundle:true,jsx:'automatic',plugins:[{name:'synthetic-hooks',setup(b){
        b.onResolve({filter:/AnnouncementsGate$|^(next\/|next-auth\/|@tanstack\/|@\/)/}, args => {
          if(args.path==='@/util/role-view') return {path:path.join(root,'lib/util/role-view.ts')};
          return {path:args.path,namespace:'synthetic'};
        });
        b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:mocks,loader:'tsx',resolveDir:root}));
      }}]
    });
    const config=repo('tailwindcss/loadConfig')(path.join(root,'tailwind.config.ts'));
    config.content=[{raw:['TopHeader.tsx','DDayBadge.tsx','auth/RoleViewSwitch.tsx','PageContainer.tsx'].map(f=>fs.readFileSync(path.join(root,'components',f),'utf8')).join('\n'),extension:'tsx'}];
    const globals=path.join(root,'app/globals.css');
    const css=(await repo('postcss')([repo('tailwindcss')(config)]).process(fs.readFileSync(globals,'utf8'),{from:globals})).css;
    const breakpoint=config.theme.screens['2xl'];
    assert.match(breakpoint,/^\d+px$/, '2xl must be an explicit pixel breakpoint');
    const desktopMin=Number.parseInt(breakpoint,10);
    const widths=[...new Set([360,390,desktopMin-1,desktopMin,1440])];
    const js=fs.readFileSync(path.join(temp,'app.js'),'utf8');
    browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_EXECUTABLE?{executablePath:process.env.QA_BROWSER_EXECUTABLE}:{})});
    const validDate=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    const base={canStudent:true,canTrainer:true,impersonating:false,date:validDate};
    const scenarios=[
      {label:'dual-student'}, {label:'dual-trainer',start:'/trainer'},
      {label:'impersonating',impersonating:true},
      {label:'student-only',canTrainer:false}, {label:'trainer-only',canStudent:false},
      {label:'neither',canStudent:false,canTrainer:false},
      {label:'undefined-date',date:undefined}, {label:'invalid-date',date:'invalid'},
      {label:'invalid-calendar-date',date:'2026-02-30'}
    ];
    let cases=0;
    for(const width of widths) for(const scenario of scenarios){
      const fixture={...base,...scenario};
      const page=await browser.newPage({viewport:{width,height:800}});
      const posts=[]; const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*', async route=>{
        const request=route.request();const url=new URL(request.url());
        if(url.origin!=='http://header.test')return route.abort();
        if(url.pathname==='/api/role-view'){
          const body=request.postDataJSON();posts.push(body);
          return route.fulfill({json:{destination:body.role==='trainer'?'/trainer':'/dashboard'}});
        }
        if(url.pathname==='/salespt-logo.png')return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'public/salespt-logo.png'))});
        if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:js});
        return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><script>window.__fixture='+JSON.stringify(fixture)+'</script><div id="root"></div><script src="/app.js"></script>'});
      });
      await page.goto('http://header.test'+(scenario.start||'/dashboard'));
      await page.waitForSelector('[data-header-dday]');
      await page.waitForFunction(()=>document.querySelector('header img').complete);
      if(fixture.date===validDate)await page.waitForFunction(()=>!document.querySelector('[data-header-dday]').textContent.includes('D-—'));
      const result=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
        return{rem:Number.parseFloat(getComputedStyle(document.documentElement).fontSize),width:innerWidth,scroll:document.documentElement.scrollWidth,header:rect('header'),logo:rect('[aria-label="계정 메뉴 열기"]'),actions:rect('[data-header-actions]'),info:rect('[data-header-info]'),name:rect('[data-header-info] > :first-child'),marker:document.querySelector('[data-header-impersonation]')?rect('[data-header-impersonation]'):null,dday:rect('[data-header-dday]'),banner:rect('header ~ .sticky'),date:document.querySelector('[data-header-dday]').textContent,infoText:document.querySelector('[data-header-info]').textContent,actionText:document.querySelector('[data-header-actions]').textContent,roleButtonHeight:document.querySelector('.app-role-option')?.getBoundingClientRect().height,overflow:getComputedStyle(document.querySelector('header')).overflowX};
      });
      const label=width+' '+scenario.label;
      assert.ok(result.scroll<=width,label+' overflow '+JSON.stringify(result));
      assert.ok(result.actions.right<=width && result.actions.left>=0,label+' action bounds');
      assert.ok(result.dday.right<=width && result.dday.left>=0,label+' D-day bounds');
      assert.ok(Math.abs(result.logo.top-result.actions.top)<=1,label+' first row');
      assert.ok(result.banner.top>=result.header.bottom-1,label+' banner overlaps header');
      assert.ok(!['hidden','clip'].includes(result.overflow),label+' overflow must not be hidden');
      if(width<desktopMin){assert.equal(result.header.height,6*result.rem,label);assert.ok(result.info.top>=result.actions.bottom-1,label+' information row');}
      else{assert.equal(result.header.height,3.5*result.rem,label);assert.ok(Math.abs(result.info.top-result.actions.top)<=1,label+' desktop single row');}
      assert.ok(result.infoText.includes('합성 긴이름 사용자 테스트') && result.name.right>result.name.left,label+' visible name');
      if(fixture.impersonating)assert.ok(result.marker && result.marker.left>=0 && result.marker.right<=width && result.marker.top>=result.info.top && result.marker.bottom<=result.info.bottom+1,label+' visible marker');
      assert.equal(result.infoText.includes('대리 접속 중'),fixture.impersonating,label+' marker');
      assert.ok(!result.actionText.includes('대리 접속 중'),label+' marker separate');
      assert.ok(!result.date.includes('NaN'),label+' invalid date');
      if(fixture.date!==validDate)assert.equal(result.date,'D-—',label+' date placeholder');
      const dual=fixture.canStudent&&fixture.canTrainer;
      assert.equal(await page.getByRole('group',{name:'접속 역할'}).count(),dual?1:0,label+' capabilities');
      if(dual){
        assert.ok(result.roleButtonHeight>=44,label+' real global role styling');
        const group=page.getByRole('group',{name:'접속 역할'});
        assert.equal(await group.locator('[aria-pressed="true"]').count(),fixture.impersonating?0:1,label+' pressed role');
        const target=scenario.start?'수강생':'트레이너';const destination=scenario.start?'/dashboard':'/trainer';
        await Promise.all([page.waitForURL('http://header.test'+destination),group.getByRole('button',{name:target,exact:true}).click()]);
        assert.ok(posts.some(p=>p.switch===true&&p.role===(scenario.start?'student':'trainer')),label+' real switch POST');
      }
      assert.deepEqual(errors,[],label+' page errors');
      if(process.env.QA_HEADER_ARTIFACT_DIR && scenario.label==='impersonating'){
        fs.mkdirSync(process.env.QA_HEADER_ARTIFACT_DIR,{recursive:true});
        // Capture the impersonating state again after the navigation assertion.
        await page.goto('http://header.test/dashboard');await page.waitForFunction(()=>document.querySelector('[data-header-dday]') && !document.querySelector('[data-header-dday]').textContent.includes('D-—'));await page.waitForFunction(()=>document.querySelector('header img').complete);
        await page.screenshot({path:path.join(process.env.QA_HEADER_ARTIFACT_DIR,'header-'+width+'.png')});
      }
      console.log('PASS '+label+' scrollWidth='+result.scroll+' headerHeight='+result.header.height);
      cases++;await page.close();
    }
    console.log('Browser matrix: '+cases+' passed');
  } finally {if(browser)await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
`;

it.skipIf(!process.env.QA_TOOLS_DIR)("real browser: responsive rows, no overflow, marker/date/capabilities and role navigation", () => {
  const output = execFileSync(process.execPath, ["-e", browserScript], {
    cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  console.log(output);
  expect(output).toContain("Browser matrix: 45 passed");
}, 150_000);
