// 대시보드 「오늘 챙길 일」 목업 서버 — 실제 React 화면·CSS·폰트 + 합성 API(실데이터·자격증명·외부 호출 없음).
// 먼저 `npm run build`(폰트 자산) → node tests/browser/dashboard-followups-server.mjs → 출력된 주소를 연다.
//   /?scenario=some(기본) | many | empty | error | unsupported   (줄임: ?many=1 ?empty=1 ?error=1 ?unsupported=1)
//   ?slow=1  보조 조회(월 미팅·DB관리시트)를 1.5초 늦춰 카드 스켈레톤·전역 오버레이 미표시를 확인
//   카드 목록의 한 줄을 누르면 실제 /payment · /schedule · /db-sheet 화면이 같은 탭에서 열린다(캐시 유지).
// 날짜는 요청마다 오늘(KST) 기준으로 계산한다 — 코드에 날짜 리터럴 없음. 이름은 전부 '샘플'·'가상'.
// 수정(할 일 완료·미팅 결과·DB 상담 기록)은 서버 메모리에만 남는다: POST /fixture/reset 으로 초기화.
// 이 파일은 B(영업이익 문장)·C(채널 표) 목업이 /api/dashboard 응답을 넓혀 함께 쓴다.
// B 한 줄 문장(재무·주간 목표) — 시나리오는 쿠키 headline_finance·headline_goals(대시보드 진입 때 주소에서 적는다):
//   ?finance=profit(기본)|loss|cost-only|none|refund|ledger-fail|big   줄임 ?loss=1 ?big=1
//   ?goals=remaining(기본)|done|unset|zero                              줄임 ?goalDone=1   (?empty=1 이면 기본 none·unset)
//   refund 는 「이번 달」 칩에서 반환 문장이 보인다. 지난 주 과거형은 주간 목표 카드 ◀(서버가 ?date= 의 주를 돌려준다).
//   /headlines → 모든 문구 상태 승인표(실제 CardHeadline + FinanceSummaryBoxes / GoalRings, 320·390·넓게 폭 전환).
// C 채널별 남은 돈(영업이익 칸을 누르면 보이는 표) — ?channels=demo|empty|loss|large + ?ledgerFail=1 ?noChannels=1
//   ?staleChannels=1 ?renamed=1 ?stuck=1. 계약·DB·원장·대시보드 응답을 C 데이터로 바꾼다(dashboard-channel-profit-data.mjs).
import { context } from "esbuild";
import { channelProfitRoute } from "./dashboard-channel-profit-data.mjs";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "dashboard-followups-"));
const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
assert.equal(css.status, 0, css.stderr);
const bundle = await context({
  entryPoints: ["tests/browser/dashboard-followups-fixture.tsx"], bundle: true, outfile: join(dir, "app.js"),
  platform: "browser", jsx: "automatic", logLevel: "warning",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ loader: "js", resolveDir: process.cwd(), contents: args.path.endsWith("navigation")
      ? "export const useRouter=()=>({push:p=>window.__fixtureNavigate(p),replace:p=>window.__fixtureNavigate(p,true),back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{},prefetch:()=>{}});"
        + "export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search);"
        + "export const useParams=()=>({}); export const redirect=p=>window.__fixtureNavigate(p,true); export const notFound=()=>{};"
      : 'import React from "react"; export default function Link({href,children,prefetch,replace,scroll,...rest}){'
        + 'const to=typeof href==="string"?href:String(href);'
        + 'return React.createElement("a",{...rest,href:to,onClick:e=>{rest.onClick?.(e);if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();window.__fixtureNavigate(to,replace)}},children)}' }));
    // JS 를 다시 묶을 때마다(첫 빌드 제외) Tailwind 도 다시 뽑아 새 클래스가 바로 보이게(목업 반복 수정용).
    let first = true;
    b.onEnd(() => {
      if (first) { first = false; return; }
      spawn(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { stdio: "ignore" });
    });
  } }],
});
await bundle.rebuild();
await bundle.watch();

const builtCss = readdirSync(".next/static/css").filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(".next/static/css", f), "utf8")).join("\n");
const faces = (builtCss.match(/@font-face\{[^}]+\}/g) ?? []).filter((s) => s.includes("Noto")).join("\n");
const family = faces.match(/font-family:([^;]+);/)?.[1];
assert.ok(family, "Build first for production font assets");
const fontCss = faces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/") + ":root{--font-noto-sans-kr:" + family + "}";
const media = new Map(readdirSync(".next/static/media").map((f) => ["/media/" + f, join(".next/static/media", f)]));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>오늘 챙길 일 목업</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';

// ── 날짜(오늘 KST 기준) ───────────────────────────────────────────
const todayKST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const shift = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const friOf = (iso) => shift(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 2) % 7));
const datesOfMonth = (yyyyMM) => { const [y, m] = yyyyMM.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return Array.from({ length: last }, (_, i) => `${yyyyMM}-${String(i + 1).padStart(2, "0")}`); };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ── 합성 레코드 ───────────────────────────────────────────────────
const slot = (o = {}) => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...o });
const contract = (row, 업체명, 계약일, o = {}) => ({ row, 계약일, 업체명, 수임비: 3_300_000, 계약비고: "", 공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false, 사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false, 수납1: slot(), 수납2: slot(), 수납3: slot(), 로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, ...o });
const refOf = (cp) => `${cp.계약일}|${cp.업체명}`;
const todo = (id, cp, o = {}) => ({ id, contractRef: cp ? refOf(cp) : "", institutionRef: "", 업체명: cp?.업체명 ?? "", type: "전화", 제목: "확인 전화", 예정일자: todayKST(), 예정시각: "", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false, 생성시각: "", 분류: "", 기록종류: "todo", ...o });
const meeting = (id, 업체명, 미팅날짜, o = {}) => ({ id, 예약일: shift(미팅날짜, -3), 예약시각: "10:00", 미팅날짜, 미팅시간: "14:00", channel: "매입DB", 업체명, 장소: "가상 카페", 예약비고: "", 상태: "예약", 계약여부: false, 수임비: 0, 미팅사유: "", 계약조건: "", ...o });
const lead = (n, company, o = {}) => ({ id: uuid(n), supplier: "가상 DB공급처", date: shift(todayKST(), -20), channel: "매입DB", company, owner: "김가상", phone: "010-0000-0000", biz: "", address: "", industry: "", credit: "", sales: "", arrears: "미확인", funds: "", next: "", memo: "",
  contact: { ci: {}, note: "", date: "", meetingDate: "", time: "", place: "", reservationNote: "", registered: false, companyName: "" }, revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null, ...o });

/** 기본(some) — 기대 칩: 밀린 할 일 1 · 오늘 할 일 1 · 미팅 결과 2 · 다시 연락 2 · 멈춘 업체 3 · 7일 안 할 일 1 (총 9건) + 연결 끊긴 할 일 1건 안내. */
function someData(t) {
  const hanbit = contract(3, "샘플 한빛상사", shift(t, -40), { 수납1: slot({ 진행기관: "신용보증기금", 진행상품: "운전자금", 메모: "서류 접수" }) });
  const dalbit = contract(4, "샘플 달빛공방", shift(t, -20), { 수납1: slot({ 진행기관: " 소진공 ", 진행상품: "일반경영안정" }) });
  const pureun = contract(5, "샘플 푸른제작", shift(t, -10));
  const onyu = contract(6, "샘플 온유상사", shift(t, -3));
  const byeolbit = contract(7, "샘플 별빛식품", shift(t, -30), { 해지일: shift(t, -5), 해지사유: "가상 사유" });
  const eunha = contract(8, "샘플 은하상사", shift(t, -50), { 수납1: slot({ 진행기관: "기술보증기금", 승인금액: 30_000_000 }) });
  const goun = contract(9, "샘플 고운상사", shift(t, -30), { 수납1: slot({ 진행기관: "신용보증기금", 진행상품: "시설자금", 메모: "보완 서류" }) });
  const iwol = contract(10, "샘플 이월상사", shift(t, -90), { 구분: "이월", 수납1: slot({ 진행기관: "중진공", 메모: "상담" }), 수납2: slot({ 진행기관: "신용보증기금", 진행상품: "운전자금" }) });
  const contracts = [hanbit, dalbit, pureun, onyu, byeolbit, eunha, goun, iwol];
  const todos = [
    todo("todo-overdue", hanbit, { institutionRef: "신용보증기금", 제목: "서류 보완 요청", 예정일자: shift(t, -3), 예정시각: "10:00" }),
    todo("todo-today", dalbit, { institutionRef: "소진공", 제목: "현장실사 일정 확인", 예정일자: t, 예정시각: "15:00" }),
    todo("todo-soon", hanbit, { institutionRef: "신용보증기금", 제목: "보증서 발급 확인", 예정일자: shift(t, 2) }),
    todo("todo-personal", null, { type: "일반", 제목: "가상 개인 일정", 예정일자: t, 분류: "기타" }),
    todo("hist-dalbit", dalbit, { 기록종류: "history", institutionRef: "소진공", 제목: "서류 안내", 예정일자: shift(t, -12) }),
    todo("done-eunha", eunha, { institutionRef: "기술보증기금", 완료여부: true, 제목: "승인 확인", 예정일자: shift(t, -6) }),
    todo("todo-renamed", { 계약일: shift(t, -50), 업체명: "샘플 옛이름상사" }, { 제목: "옛 이름으로 남은 할 일", 예정일자: shift(t, -4) }),
    todo("hist-goun", goun, { 기록종류: "history", institutionRef: "신용보증기금", 제목: "보완 서류 제출", 예정일자: shift(t, -9) }),
    todo("hist-iwol", iwol, { 기록종류: "history", institutionRef: "중진공", 제목: "상담", 예정일자: shift(t, -15) }),
  ];
  const meetings = [
    meeting("mtg-garam", "샘플 가람식당", shift(t, -2), { 미팅시간: "14:00", 장소: "가상 카페 본점" }),
    meeting("mtg-narae", "(변경) 샘플 나래공업", shift(t, -1), { 미팅시간: "11:00", 장소: "나래공업 가상 사무실", previousMeetingId: "mtg-narae-old" }),
    meeting("mtg-narae-old", "샘플 나래공업", shift(t, -4), { 상태: "변경" }),
    meeting("mtg-dasom", "샘플 다솜치킨", shift(t, -5), { 상태: "완료" }),
    meeting("mtg-maru", "샘플 마루상회", shift(t, 1)),
    meeting("mtg-bareun", "샘플 바른학원", shift(t, -31)),
  ];
  const contacted = (date) => ({ ...lead(0, "").contact, date });
  const leads = [
    lead(1, "샘플 다온상회", { result: "재통화", next: shift(t, -1), contact: contacted(shift(t, -6)) }),
    lead(2, "샘플 소담제과", { result: "부재", next: t, channel: "직접생산" }),
    lead(3, "샘플 라온카페", { result: "컨택진행", next: shift(t, -5) }),
    lead(4, "샘플 미소식품", { result: "부재", next: shift(t, 3) }),
    lead(5, "샘플 바다수산", { result: "부재", next: "" }),
    lead(6, "샘플 새봄꽃집", { result: "단순거절", next: shift(t, -4), contact: contacted(shift(t, -2)) }),
  ];
  return { contracts, todos, meetings, leads };
}

/** 많음(many) — 멈춘 업체 12곳 + 밀린 할 일 8건: 목록 스크롤·PC 위로 뜨는 높이 확인용. */
function manyData(t) {
  const base = someData(t);
  const names = ["가온", "나린", "다올", "라임", "마중", "바름", "사랑", "아라", "자람", "차오", "카라", "타래"];
  const stalled = names.map((name, i) => contract(20 + i, `샘플 ${name}상사`, shift(t, -(8 + i * 4)), i % 3 === 0 ? { 수납1: slot({ 진행기관: "신용보증기금", 메모: "접수" }) } : {}));
  const busy = ["하늘", "구름", "바람", "별님"].map((name, i) => contract(40 + i, `샘플 ${name}공업`, shift(t, -25), { 수납1: slot({ 진행기관: "소진공", 진행상품: "일반경영안정" }) }));
  const overdue = Array.from({ length: 8 }, (_, i) => todo(`todo-many-${i}`, busy[i % 4], { institutionRef: "소진공", 제목: `가상 서류 ${i + 1}`, 예정일자: shift(t, -(i + 1)) }));
  return { ...base, contracts: [...base.contracts, ...stalled, ...busy], todos: [...base.todos.filter((x) => x.id !== "todo-overdue"), ...overdue] };
}

const stores = new Map();
function store(scenario) {
  const t = todayKST();
  const key = `${scenario}|${t}`;
  if (!stores.has(key)) {
    const empty = { contracts: [], todos: [], meetings: [], leads: [] };
    stores.set(key, scenario === "empty" ? empty : scenario === "many" ? manyData(t) : someData(t));
  }
  return stores.get(key);
}

// ── B: 한 줄 문장 시나리오(재무·주간 목표) ─────────────────────────────
// 재무 숫자는 이 블록만 정한다: 「오늘 챙길 일」 계약은 수임비 0 으로 보내고(챙길 일·진행건 판정과 무관),
// 오늘 계약(진행대기 — 멈춤 아님)·지난달 수납완료 계약(멈춤 아님)·DB 구매·경비장부를 더한다.
// profit: 전체 1,594,520 · 이번 달/주 594,520(=1,500,000−905,480, 스펙 예시) · big: 12,345,678(8자리 두 줄 확인).
const FINANCE_KINDS = ["profit", "loss", "cost-only", "none", "refund", "ledger-fail", "big"];
function financeData(kind, t) {
  const fresh = (업체명, 수임비) => contract(90, 업체명, t, { 수임비 });
  const settled = (업체명, 수임비, o = {}) => contract(91, 업체명, shift(t, -40), { 수임비,
    수납1: slot({ 진행기관: "신용보증기금", 진행상품: "운전자금", 승인금액: 50_000_000, 수납액: 800_000, 수납일: shift(t, -35) }), ...o });
  const buy = (구매일, 주문금액) => ({ 구매일, 주문금액 });
  const spend = (date, amountWon) => ({ id: "exp-fixture-1", categoryId: "cat-fixture", categoryName: "광고비", itemName: "가상 전단지", source: "one_time", amountWon, periodStart: date, periodEnd: date });
  switch (kind) {
    case "loss": return { contracts: [fresh("샘플 가상식품", 500_000)], purchases: [buy(t, 620_000)], ledger: [] };
    case "cost-only": return { contracts: [], purchases: [buy(t, 300_000)], ledger: [] };
    case "none": return { contracts: [], purchases: [], ledger: [] };
    case "refund": return { contracts: [settled("샘플 해지상사", 1_500_000, { 해지일: t, 해지사유: "가상 사유", 반환액: 2_000_000 }), fresh("샘플 가상식품", 500_000)], purchases: [buy(shift(t, -40), 300_000)], ledger: [] };
    case "ledger-fail": return { contracts: [fresh("샘플 가상식품", 1_200_000)], purchases: [buy(t, 300_000)], ledger: null };
    case "big": return { contracts: [fresh("샘플 가상식품", 15_000_000)], purchases: [buy(t, 2_654_322)], ledger: [] };
    default: return { contracts: [settled("샘플 지난달식품", 1_000_000), fresh("샘플 가상식품", 1_500_000)], purchases: [buy(t, 905_480), buy(shift(t, -40), 600_000)], ledger: [spend(shift(t, -38), 200_000)] };
  }
}
// 주간 목표 — remaining: 계약 2/1 → 「계약 목표까지 1건 남았어요 💪」(지난 주는 「…못 미쳤어요」), done: 초과 포함 전부 달성.
const NO_GOALS = { production: null, inflow: null, contacts: null, meetings: null, contracts: null };
const GOAL_SETS = {
  remaining: { goals: { production: 20, inflow: 10, contacts: 5, meetings: 3, contracts: 2 }, actuals: { production: 12, inflow: 4, contacts: 3, meetings: 2, contracts: 1 } },
  done: { goals: { production: 20, inflow: 10, contacts: 5, meetings: 3, contracts: 1 }, actuals: { production: 24, inflow: 10, contacts: 6, meetings: 3, contracts: 1 } },
  unset: { goals: NO_GOALS, actuals: { production: 6, inflow: 2, contacts: 1, meetings: 0, contracts: 0 } },
  zero: { goals: { ...NO_GOALS, production: 0 }, actuals: { production: 3, inflow: 1, contacts: 0, meetings: 0, contracts: 0 } },
};
const NO_ACTUALS = { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 };

const cookieOf = (req, name) => (req.headers.cookie ?? "").split(/;\s*/).find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
const readBody = (req) => new Promise((resolve) => { let raw = ""; req.on("data", (c) => { raw += c; }); req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const reply = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  const scenario = cookieOf(req, "followups_scenario") ?? "some";
  const slow = cookieOf(req, "followups_slow") === "1";
  const data = store(scenario);
  const t = todayKST();
  const courseStart = shift(t, -45);
  const financeKind = FINANCE_KINDS.find((k) => k === cookieOf(req, "headline_finance")) ?? (scenario === "empty" ? "none" : "profit");
  const goalKind = Object.hasOwn(GOAL_SETS, cookieOf(req, "headline_goals") ?? "") ? cookieOf(req, "headline_goals") : scenario === "empty" ? "unset" : "remaining";
  const fin = financeData(financeKind, t);

  if (path === "/fixture/reset") { stores.clear(); return reply({ ok: true }); }
  // C 채널별 남은 돈(?channels=…): 계약·DB·원장·대시보드 4곳만 C 데이터로(아니면 null → 아래 A·B 응답 그대로).
  const channelReply = channelProfitRoute(req, path, cookieOf, t);
  if (channelReply) return reply(channelReply.body, channelReply.status);
  if (path === "/api/me") return reply({ email: "fixture@example.invalid", name: "가상 수강생", cohort: "연습", sessionRole: "student", courseStartISO: courseStart, graduationISO: shift(courseStart, 84) });
  if (path === "/api/trainer/recruitment") return reply({ email: "fixture@example.invalid", name: "가상 수강생", status: "none", canStudent: true, canTrainer: false, isAdmin: false });
  if (path === "/api/announcements") return reply({ latestPr: 0, announcements: [], updates: [] });
  if (path === "/api/dashboard") return reply({
    kpi: { 총매출: 12_000_000, 총비용: 3_000_000, 수임비합: 8_000_000, 수수료합: 4_000_000, 이월매출: 2_000_000, 전체매출: 14_000_000, 이월비용: 100_000, 전체비용: 3_100_000 },
    additionalCost: { dbCostTotal: 2_000_000, additionalCost: 1_000_000, status: "available" }, channelMatrix: [], weeklyTrend: [], costBreakdown: [] });
  if (path === "/api/weekly-goals") {
    // 주차 = 금~목(운영과 같다). ?date= 가 있으면 그 날이 든 주를 돌려줘 카드 ◀▶ 이동·지난 주 과거형이 보인다.
    const anchor = friOf(courseStart);
    const weekOf = (iso) => Math.max(1, Math.floor((Date.parse(friOf(iso)) - Date.parse(anchor)) / (7 * 86_400_000)) + 1);
    const nowWeek = weekOf(t);
    const asked = url.searchParams.get("date");
    const week = /^\d{4}-\d{2}-\d{2}$/.test(asked ?? "") ? weekOf(asked) : nowWeek;
    const set = GOAL_SETS[goalKind];
    const item = (w) => { const start = shift(anchor, (w - 1) * 7); return { week: w, start, end: shift(start, 6),
      record: { goals: set.goals, task: `${w}주 과제`, revision: 0, updatedAt: null }, actuals: w > nowWeek ? NO_ACTUALS : set.actuals }; };
    return reply({ student: { email: "fixture@example.invalid", name: "가상 수강생", cohort: "연습", courseStart, region: "합성", trainers: [] }, current: item(week), previous: week > 1 ? item(week - 1) : null, canReadInternal: false });
  }

  // 계약·할 일
  if (path === "/api/contract-payment") return req.method === "GET" ? reply({ rows: [...data.contracts.map((c) => ({ ...c, 수임비: 0 })), ...fin.contracts] }) : reply({ ok: true, row: 3, synced: false });
  if (path.startsWith("/api/contract-payment/")) return reply({ ok: true, failures: [] });
  if (path === "/api/todos" && req.method === "GET") {
    const ref = url.searchParams.get("contractRef");
    return reply({ todos: ref == null ? data.todos : data.todos.filter((x) => x.contractRef === ref) });
  }
  if (path === "/api/todos" && req.method === "POST") {
    const body = await readBody(req);
    const created = { ...todo(body.operationId || `todo-${Date.now()}`, null), ...body, id: body.operationId || `todo-${Date.now()}` };
    data.todos.push(created);
    return reply({ ok: true, todo: created });
  }
  if (path.startsWith("/api/todos/")) {
    const id = decodeURIComponent(path.slice("/api/todos/".length));
    if (req.method === "DELETE") data.todos = data.todos.filter((x) => x.id !== id);
    else { const partial = await readBody(req); data.todos = data.todos.map((x) => (x.id === id ? { ...x, ...partial } : x)); }
    return reply({ ok: true });
  }

  // 미팅
  if (path.startsWith("/api/meetings/month/")) {
    if (slow) await sleep(1500);
    const yyyyMM = path.slice("/api/meetings/month/".length);
    const days = datesOfMonth(yyyyMM);
    return reply({ yyyyMM,
      daysByMeetingDate: days.map((date) => ({ date, meetings: data.meetings.filter((m) => m.미팅날짜 === date) })),
      daysByTodoDate: days.map((date) => ({ date, todos: data.todos.filter((x) => x.showOnCalendar && x.예정일자 === date) })) });
  }
  if (path.startsWith("/api/meetings/week/")) {
    const weekStart = path.slice("/api/meetings/week/".length);
    const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
    return reply({ weekStart, weekIndex: Math.max(1, Math.floor((Date.parse(weekStart) - Date.parse(courseStart)) / (7 * 86_400_000)) + 1), courseStart,
      daysByMeetingDate: days.map((date) => ({ date, meetings: data.meetings.filter((m) => m.미팅날짜 === date) })),
      daysByReservationDate: days.map((date) => ({ date, meetings: data.meetings.filter((m) => m.예약일 === date) })),
      weekFunnel: { 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0 } });
  }
  if (path === "/api/meetings/linkable") return reply({ meetings: [] });
  if (path.startsWith("/api/meeting/")) {
    const [id, action] = decodeURIComponent(path.slice("/api/meeting/".length)).split("/");
    if (req.method === "DELETE") data.meetings = data.meetings.filter((m) => m.id !== id);
    else if (action === "revert") data.meetings = data.meetings.map((m) => (m.id === id ? { ...m, 상태: "예약", 계약여부: false } : m));
    else if (req.method === "PATCH") { const partial = await readBody(req); data.meetings = data.meetings.map((m) => (m.id === id ? { ...m, ...partial } : m)); }
    return reply({ ok: true, status: "예약", cascade: "", childId: null });
  }
  if (path === "/api/meeting" && req.method === "POST") { const body = await readBody(req); data.meetings.push(body); return reply({ ok: true, id: body.id }); }

  // DB관리시트
  if (path === "/api/db-sheet") {
    if (slow) await sleep(1500);
    if (scenario === "error") return reply({ error: "저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요." }, 503);
    if (scenario === "unsupported") return reply({ error: "이 계정은 아직 DB관리시트를 지원하지 않습니다." }, 503);
    if (req.method === "POST") {
      const body = await readBody(req);
      const bump = (id, change) => { data.leads = data.leads.map((l) => (l.id === id ? { ...change(l), revision: l.revision + 1 } : l)); return data.leads.filter((l) => l.id === id); };
      if (body.action === "save") return reply({ leads: bump(body.lead.id, (l) => ({ ...l, ...body.lead })) });
      if (body.action === "contact") return reply({ leads: bump(body.id, (l) => ({ ...l, result: body.result, contact: { ...l.contact, date: body.date, note: body.note } })) });
      return reply({ leads: [] });
    }
    return reply({ leads: data.leads });
  }
  if (path === "/api/company-info") return reply({});
  // B 재무 문장: DB 비용(구매일·주문금액)과 경비장부(오늘까지 인식분). ledger-fail 은 경비장부만 실패.
  if (path === "/api/db") return reply({ purchases: fin.purchases, productions: [], banners: [], leads: [] });
  if (path === "/api/expenses" && req.method === "GET") {
    if (slow) await sleep(1500); // ?slow=1 — 재무 「불러오는 중」에서도 문장 자리가 같은 높이인지(3칸이 덜컹이지 않는지) 확인
    if (fin.ledger === null) return reply({ error: "경비장부를 불러오지 못했어요(합성 실패)." }, 503);
    return reply({ view: url.searchParams.get("view") ?? "all", month: url.searchParams.get("month"), categories: [], entries: fin.ledger, rules: [], categoryTotals: [],
      additionalCostTotal: fin.ledger.reduce((sum, e) => sum + e.amountWon, 0) });
  }
  if (path.startsWith("/api/")) return reply({ categories: [], entries: [], rules: [], categoryTotals: [], additionalCostTotal: 0 });

  // 정적 자산
  const file = media.get(path) || (path === "/salespt-logo.png" ? "public/salespt-logo.png" : null);
  if (file) { res.setHeader("Content-Type", file.endsWith("png") ? "image/png" : "font/woff2"); return res.end(readFileSync(file)); }
  if (path === "/app.js" || path === "/style.css" || path === "/app.css") {
    const out = join(dir, path.slice(1));
    res.setHeader("Content-Type", path.endsWith(".js") ? "application/javascript" : "text/css");
    return res.end(existsSync(out) ? readFileSync(out) : "");
  }
  if (path === "/font.css") { res.setHeader("Content-Type", "text/css"); return res.end(fontCss); }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
});
server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}`));
