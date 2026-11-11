/**
 * Layer: service. 간편인증 서류 조회 — 요청 시작·승인 확인·결과 정리·DB 연결·업체정보 반영.
 * 계획: docs/plans/active/simple-auth-scraping.md (belie 2026-11-08~09).
 *
 * 흐름(간편인증): 서류마다 CODEF 요청을 같은 id 로 한꺼번에 보낸다 → 기관마다 첫 요청이 「추가인증(CF-03002)」으로
 *   돌아오고 나머지는 고객 승인까지 응답을 잡고 있다 → 수강생이 「승인 확인」 → 2차 요청이 성공하면 잡혀 있던 요청도
 *   차례로 도착(2026-11-08 데모 실측). 기관이 다르면(홈택스·정부24) 승인이 따로 한 번 더 필요하다.
 * 흐름(공동인증서): 고객 승인 없이 차례로 호출. 사업자등록증명을 먼저 받아 법인/개인을 보고 재무제표·지방세 상품을 고른다.
 *
 * 진행 중 상태(대기 중인 CODEF 요청·2차 인증 정보·재전송용 입력)는 이 프로세스 메모리에만 있다(PM2 1개 프로세스).
 * 배포·재시작으로 끊긴 요청은 목록을 읽을 때 「다시 보내 주세요」로 정리한다. 인증서·비밀번호·주민번호 뒷자리는 저장하지 않는다.
 */
import { randomUUID } from "node:crypto";
import { isSimilarDbSheetCompany, type DbSheetContext, type DbSheetLead } from "@/types/db-sheet";
import { DbSheetLeadInput } from "@/types/db-sheet";
import type { CompanyInfo } from "@/types/meeting";
import {
  SimpleAuthStart, type SimpleAuthAction, type SimpleAuthBusiness, type SimpleAuthDocKey, type SimpleAuthDocResult,
  type SimpleAuthLink, type SimpleAuthRequest,
} from "@/types/simple-auth";
import {
  SIMPLE_AUTH_CONFIRM_TRIES, SIMPLE_AUTH_DAILY_LIMIT, SIMPLE_AUTH_KEEP_DAYS, SIMPLE_AUTH_WAIT_MS, simpleAuthDocLabel,
} from "@/config/simple-auth";
import { codefCall, codefConfigured, CodefNotConfigured, type CodefResult } from "@/repo/codef-client";
import * as store from "@/repo/db/simple-auth";
import { findUserByEmail } from "@/repo/users";
import { executeDbSheet, loadDbSheet, resolveDbSheetContext } from "./db-sheet";
import { reportSimpleAuthActive, simpleAuthDraining } from "@/repo/deploy-drain";
import { PARSERS, asList, originalPdf, type DocParts } from "./simple-auth-parse";
import { baseYear, buildCalls, kstMidnight, kstToday, type Call, type Obj } from "./simple-auth-calls";
import { digitsOnly, formatBizNo } from "@/lib/document-ocr/bizno";

export class SimpleAuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Lead = { call: Call; twoWay: Obj; tries: number; extra?: unknown };
type Job = {
  reqId: string;
  owner: store.SimpleAuthOwner;
  input: SimpleAuthStart;
  leads: Lead[];
  datas: Map<SimpleAuthDocKey, unknown[]>;
  errors: Map<SimpleAuthDocKey, string>;
  /** 저장한 원문 「사업자번호|서류」(재무제표는 fs-연도). */
  saved: Set<string>;
  pending: number;
  finished: boolean;
  doneAt?: number;
  /** 이때까지는 「진행 중」으로 본다(승인 마감 + 서류 받기 여유). 승인 확인을 안 눌러 끝나지 않은 작업이 배포를 붙잡지 않게. */
  until: number;
};
const jobs = new Map<string, Job>();
/** 진행 중(끝나지 않은) 작업 수를 배포 쪽에 알린다 — 배포는 0이 될 때까지 재시작을 미룬다. */
const JOB_GRACE_MS = 3 * 60_000;
function reportActive() {
  const live = [...jobs.values()].filter((j) => !j.finished && j.until > Date.now());
  reportSimpleAuthActive(live.length, Math.max(0, ...live.map((j) => j.until)));
}
const KEEP_JOB_MS = 30 * 60_000;


const SUCCESS = "CF-00000", NEED_2WAY = "CF-03002";
const failText = (r: CodefResult) => (r.extraMessage || r.message || `오류 ${r.code}`).slice(0, 200);
const isTwoWay = (r: CodefResult) => r.code === NEED_2WAY && !!(r.data as Obj | undefined)?.continue2Way;

// ───────────────────────── 실행 ─────────────────────────

async function persist(job: Job, patch: Parameters<typeof store.updateSimpleAuthRequest>[2]) {
  await store.updateSimpleAuthRequest(job.owner.spreadsheetId, job.reqId, patch).catch(() => null);
}

async function keepOriginals(job: Job, doc: SimpleAuthDocKey, data: unknown) {
  for (const o of asList(data)) {
    const pdf = originalPdf(o, doc === "ins" ? "resOriGinalData" : "resOriGinalData1");
    if (!pdf) continue;
    const raw = typeof o.resCompanyIdentityNo === "string" ? o.resCompanyIdentityNo : (asList(o.resBasicList)[0]?.resCompanyIdentityNo as string | undefined) ?? "";
    const biz = digitsOnly(raw).length === 10 ? formatBizNo(raw) : "";
    const key = doc === "fs" ? `fs-${String(o.resAttrYear || String(o.commEndDate ?? "").slice(0, 4))}` : doc;
    await store.saveSimpleAuthOriginal(job.reqId, biz, key, pdf).then(() => job.saved.add(`${biz}|${key}`)).catch(() => undefined);
  }
}

async function settle(job: Job, call: Call, r: CodefResult) {
  if (r.code === SUCCESS) {
    const list = job.datas.get(call.doc) ?? [];
    list.push(r.data);
    job.datas.set(call.doc, list);
    await keepOriginals(job, call.doc, r.data);
  } else {
    // 원인 찾기용 — 서류·기관·CODEF 코드만(이름·번호 등 개인정보 없음).
    console.log(JSON.stringify({ t: "simple_auth_fail", doc: call.doc, group: call.group, code: r.code }));
    const text = failText(r);
    if (!job.datas.get(call.doc)?.length && !job.errors.has(call.doc)) job.errors.set(call.doc, call.doc === "fs" && FS_NEEDS_BIZ.test(text) ? FS_MULTI_BIZ : text);
  }
  job.pending -= 1;
  const done = new Set([...job.datas.keys(), ...job.errors.keys()]).size;
  // 받은 서류는 바로 저장 — 서버가 재시작돼도 이미 받은 서류는 남는다(2026-11-11: 배포 재시작으로 받은 서류까지 사라짐).
  await persist(job, { progress: done, ...(r.code === SUCCESS ? { businesses: assemble(job) } : {}) });
  if (job.pending <= 0) await finish(job);
}

/** 사업장이 여럿인 개인사업자는 홈택스가 재무제표에 사업자번호를 요구한다(2026-11-10 운영 실측).
 *  사업자번호를 붙여 다시 보내면 대표가 또 승인해야 해서(같은 세션 재사용 안 됨, 2026-11-11 실측 — 4분 30초씩 대기) 자동 재요청은 하지 않고 이유만 알린다. */
const FS_NEEDS_BIZ = /사업자\s*번호를 입력/;
const FS_MULTI_BIZ = "사업장이 여러 곳이면 홈택스가 재무제표를 내주지 않아요(사업자별 발급 필요).";

/** 요청 하나 보내기. 2차 인증을 요구하면 lead 로 잡아 두고(승인 확인 대기), 아니면 결과를 정리한다. */
async function fire(job: Job, call: Call) {
  let r: CodefResult;
  try { r = await codefCall(call.path, call.params); }
  catch (e) { r = { code: "NETWORK", message: e instanceof Error ? e.message : "연결 오류", extraMessage: "", data: null }; }
  if (job.finished) return;
  if (isTwoWay(r)) {
    const d = r.data as Obj;
    // 4대보험: 인증서에 사업장이 여럿이면 첫 사업장으로 고른다(2차 요청에 index).
    if (call.group === "pp") { await confirmLead(job, { call, twoWay: d, tries: 0, extra: r.extra }); return; }
    job.leads.push({ call, twoWay: d, tries: 0 });
    return;
  }
  await settle(job, call, r);
}

async function confirmLead(job: Job, lead: Lead): Promise<"ok" | "waiting" | "failed"> {
  const two = { jobIndex: lead.twoWay.jobIndex, threadIndex: lead.twoWay.threadIndex, jti: lead.twoWay.jti, twoWayTimestamp: lead.twoWay.twoWayTimestamp };
  const params = lead.call.group === "pp"
    ? { ...lead.call.params, index: "0", is2Way: true, twoWayInfo: two }
    : { ...lead.call.params, simpleAuth: "1", is2Way: true, twoWayInfo: two };
  lead.tries += 1;
  let r: CodefResult;
  try { r = await codefCall(lead.call.path, params); }
  catch (e) { r = { code: "NETWORK", message: e instanceof Error ? e.message : "연결 오류", extraMessage: "", data: null }; }
  if (r.code === NEED_2WAY) return "waiting";
  job.leads = job.leads.filter((l) => l !== lead);
  await settle(job, lead.call, r);
  return r.code === SUCCESS ? "ok" : "failed";
}

function startJob(job: Job, calls: Call[]) {
  job.pending = calls.length;
  jobs.set(job.reqId, job);
  reportActive();
  void (async () => {
    // 같은 id 요청을 0.3초 간격으로 겹쳐 보낸다(실측: 첫 요청만 승인을 받고 나머지는 승인 뒤 도착).
    for (const c of calls) { void fire(job, c); await new Promise((r) => setTimeout(r, 300)); }
  })();
}

/** 공동인증서: 승인이 없으니 차례로. 사업자등록증명으로 법인 여부를 먼저 본다. */
function startCertJob(job: Job) {
  jobs.set(job.reqId, job);
  reportActive();
  void (async () => {
    const ids = { nt: randomUUID(), mw: randomUUID(), pp: randomUUID() };
    // 요청 수는 법인 여부와 상관없이 같다 — 끝 판정(pending 0)은 처음부터 전체 수로.
    job.pending = buildCalls(job.input, ids, false).length;
    for (const c of buildCalls(job.input, ids, false, ["biz"])) await fire(job, c);
    const corp = (job.datas.get("biz") ?? []).flatMap(asList).some((o) => /법인/.test(String(o.resBusinessmanType ?? "")));
    for (const c of buildCalls(job.input, ids, corp, job.input.docs.filter((d) => d !== "biz"))) {
      if (job.finished) return;
      await fire(job, c);
    }
  })();
}

// ───────────────────────── 결과 정리 · DB 연결 ─────────────────────────

function assemble(job: Job): SimpleAuthBusiness[] {
  const y = baseYear();
  const parts = new Map<SimpleAuthDocKey, DocParts>();
  for (const [doc, datas] of job.datas) parts.set(doc, PARSERS[doc](datas, y));
  const names = new Map<string, string>();
  for (const p of parts.values()) for (const [biz, v] of p) if (biz && !names.get(biz)) names.set(biz, v.name);
  for (const [biz, v] of parts.get("biz") ?? []) if (biz) names.set(biz, v.name || names.get(biz) || "");
  const docs = job.input.docs;
  return [...names.entries()].map(([bizNo, name]) => {
    const results: SimpleAuthDocResult[] = docs.map((doc) => {
      const p = parts.get(doc)?.get(bizNo) ?? parts.get(doc)?.get("");
      const hasOriginal = [...job.saved].some((k) => [bizNo, ""].some((b) => k === `${b}|${doc}` || (doc === "fs" && k.startsWith(`${b}|fs-`))));
      if (p && (p.facts.length || p.fields.length)) return { key: doc, ok: true, facts: p.facts.filter(Boolean), fields: p.fields, ...(p.issuedAt ? { issuedAt: p.issuedAt } : {}), hasOriginal };
      return { key: doc, ok: false, reason: job.errors.get(doc) ?? (parts.has(doc) ? "이 사업자의 서류가 없어요." : "받지 못했어요."), facts: [], fields: [], hasOriginal: false };
    });
    return { bizNo, name: name || bizNo, results, link: { state: "none" }, applied: false };
  });
}

const digits = (v: string) => v.replace(/\D/g, "");
/** DB 연결 순서: 사업자번호 → 대표 휴대폰 + 비슷한 상호 → 비슷한 상호만(후보 고르기) → 없음. */
export function matchBusiness(b: { bizNo: string; name: string }, phone: string, rows: Pick<DbSheetLead, "id" | "company" | "owner" | "phone" | "biz">[]): SimpleAuthLink {
  const byBiz = rows.find((r) => digits(r.biz) && digits(r.biz) === digits(b.bizNo));
  if (byBiz) return { state: "linked", dbId: byBiz.id, company: byBiz.company, why: "bizNo" };
  const similar = rows.filter((r) => isSimilarDbSheetCompany(r.company, b.name));
  const byPhone = phone ? similar.find((r) => digits(r.phone) === digits(phone)) : undefined;
  if (byPhone) return { state: "linked", dbId: byPhone.id, company: byPhone.company, why: "phone" };
  if (similar.length) return { state: "pick", candidates: similar.slice(0, 5).map((r) => ({ dbId: r.id, company: r.company, owner: r.owner, phone: r.phone })) };
  return { state: "none" };
}

async function dbContext(owner: store.SimpleAuthOwner): Promise<DbSheetContext | null> {
  try { return await resolveDbSheetContext(owner.email, owner.spreadsheetId); } catch { return null; }
}

/** 새 DB 한 줄 — 유입 집계에는 넣지 않는다(이미 아는 고객의 서류를 받은 것이라서). */
async function createDbRow(ctx: DbSheetContext, b: SimpleAuthBusiness, owner: string, phone: string): Promise<SimpleAuthLink> {
  const field = (k: string) => b.results.flatMap((r) => r.fields).find((f) => f.key === k)?.value ?? "";
  const lead = DbSheetLeadInput.parse({
    id: randomUUID(), supplier: "간편인증", date: kstToday(), channel: "직접생산", company: b.name, owner, phone, biz: b.bizNo,
    address: field("소재지"), industry: field("업태"), credit: "", sales: "", arrears: "", funds: "", memo: "간편인증 서류 조회로 만든 DB",
    recording: { inflow: false, activities: true },
  });
  await executeDbSheet(ctx, { action: "save", lead, revision: null, allowDuplicate: true });
  return { state: "linked", dbId: lead.id, company: b.name, why: "created" };
}

async function finish(job: Job) {
  if (job.finished) return;
  job.finished = true;
  job.doneAt = Date.now();
  reportActive();
  // 인증서·비밀번호는 요청에만 — 끝나면 메모리에서도 지운다(다시 보내기는 간편인증만).
  if (job.input.mode === "cert") job.input = { ...job.input, certPfx: undefined, certDer: undefined, certKey: undefined, certPassword: "" };
  const businesses = assemble(job);
  if (!businesses.length) {
    const why = [...job.errors.values()][0] ?? "받은 서류가 없어요.";
    await persist(job, { status: "failed", error: why, businesses: [] });
    return;
  }
  const ctx = await dbContext(job.owner);
  if (ctx) {
    try {
      const rows = await loadDbSheet(ctx);
      const phone = job.input.phone;
      // 새 DB 자동 생성은 사업자가 1곳일 때만. 여러 곳(임대사업자 등 영업 대상이 아닌 사업자가 섞임)이면
      // 화면에서 「DB 등록」을 골라야 만든다(belie 2026-11-09). 기존 DB 와 맞는 사업자는 그대로 연결.
      const autoCreate = businesses.length === 1;
      for (const b of businesses) {
        b.link = matchBusiness(b, phone, rows);
        if (b.link.state === "none" && autoCreate) b.link = await createDbRow(ctx, b, job.input.owner, phone).catch(() => ({ state: "none" as const }));
      }
    } catch { /* DB 를 못 읽어도 서류는 보여 준다 — 연결은 화면에서 */ }
  }
  await persist(job, { status: "done", progress: job.input.docs.length, businesses, error: undefined });
}

// ───────────────────────── 공개 함수 ─────────────────────────

export type SimpleAuthWho = { email: string; spreadsheetId: string };

/** CODEF 키가 서버에 있는지 — 없으면 화면이 「준비 중」으로 보내기를 막는다. */
export const simpleAuthReady = () => codefConfigured();

/** 로그인한 수강생 → 테넌트(개인 시트). 조회 중인 시트가 내 것이 아니면 거절. */
export async function simpleAuthWho(email: string, sheetOverride?: string): Promise<SimpleAuthWho> {
  const user = await findUserByEmail(email, { fresh: true });
  if (!user?.spreadsheetId || (sheetOverride && sheetOverride !== user.spreadsheetId)) throw new SimpleAuthError("계정 연결을 확인할 수 없어요.", 403);
  return { email, spreadsheetId: user.spreadsheetId };
}

/** 배포 직전(재시작 예고)에는 새 승인 대기를 시작하지 않는다 — 진행 중인 요청은 배포가 끝나기를 기다려 준다. */
const DRAINING = "곧 업데이트가 있어요. 2~3분 뒤 다시 보내 주세요.";

export async function startSimpleAuth(who: SimpleAuthWho, raw: unknown): Promise<SimpleAuthRequest> {
  if (!codefConfigured()) throw new SimpleAuthError(new CodefNotConfigured().message, 503);
  if (simpleAuthDraining()) throw new SimpleAuthError(DRAINING, 503);
  const input = SimpleAuthStart.parse(raw);
  if (!input.docs.includes("biz")) input.docs.unshift("biz");
  if (input.docs.includes("localTax")) {
    if (!input.address) throw new SimpleAuthError("지방세 완납증명은 주소가 필요해요.");
    if (input.mode === "simple" && !input.rrnBack) throw new SimpleAuthError("지방세 완납증명은 주민번호 뒷자리가 필요해요.");
    if (input.mode === "cert" && !input.phone) throw new SimpleAuthError("지방세 완납증명은 대표 휴대폰이 필요해요.");
  }
  if (input.mode === "simple" && input.method === "PASS" && !input.telecom) throw new SimpleAuthError("PASS는 통신사가 필요해요.");
  if (input.mode === "cert" && !input.certPfx && !(input.certDer && input.certKey)) throw new SimpleAuthError("인증서 파일을 골라 주세요.");
  if (await store.countSimpleAuthSince(who.email, kstMidnight()) >= SIMPLE_AUTH_DAILY_LIMIT) {
    throw new SimpleAuthError(`하루에 ${SIMPLE_AUTH_DAILY_LIMIT}건까지 보낼 수 있어요. 내일 다시 보내 주세요.`, 429);
  }
  const now = Date.now();
  const req: SimpleAuthRequest = {
    id: randomUUID(), owner: input.owner, phone: input.phone, method: input.mode === "cert" ? "공동인증서" : input.method,
    docs: input.docs, status: input.mode === "cert" ? "scraping" : "waiting", sentAt: new Date(now).toISOString(),
    deadline: now + SIMPLE_AUTH_WAIT_MS, resends: 0, progress: 0, businesses: [],
  };
  await store.insertSimpleAuthRequest(who, req);
  const job: Job = { reqId: req.id, owner: who, input, leads: [], datas: new Map(), errors: new Map(), saved: new Set(), pending: 0, finished: false, until: Date.now() + SIMPLE_AUTH_WAIT_MS + JOB_GRACE_MS };
  if (input.mode === "cert") startCertJob(job);
  else startJob(job, buildCalls(input, { nt: randomUUID(), mw: randomUUID(), pp: randomUUID() }, false));
  return req;
}

/** 목록. 끊긴(메모리에 없는) 진행 중 요청·대기 시간이 지난 요청을 정리하고, 하루 한 번 오래된 기록을 지운다. */
let lastPurge = 0;
export async function listSimpleAuth(who: SimpleAuthWho): Promise<SimpleAuthRequest[]> {
  if (Date.now() - lastPurge > 3_600_000) { lastPurge = Date.now(); void store.purgeSimpleAuthOlderThan(SIMPLE_AUTH_KEEP_DAYS).catch(() => 0); }
  for (const [id, j] of jobs) if (j.doneAt && Date.now() - j.doneAt > KEEP_JOB_MS) jobs.delete(id);
  const list = await store.listSimpleAuthRequests(who.spreadsheetId, SIMPLE_AUTH_KEEP_DAYS);
  const out: SimpleAuthRequest[] = [];
  for (const r of list) {
    const job = jobs.get(r.id);
    const active = r.status === "waiting" || r.status === "scraping";
    if (active && !job) {
      // 받아 둔 서류가 있으면 그만큼은 「받음」으로 남긴다(DB 연결은 화면에서).
      const patch = r.businesses.length
        ? { status: "done" as const, error: "서버가 다시 시작돼 일부 서류만 받았어요. 빠진 서류는 다시 보내 주세요." }
        : { status: "failed" as const, error: "서버가 다시 시작돼 끊겼어요. 다시 보내 주세요." };
      out.push((await store.updateSimpleAuthRequest(who.spreadsheetId, r.id, patch)) ?? r);
    } else if (r.status === "waiting" && Date.now() > r.deadline + 15_000 && job && !job.datas.size) {
      job.finished = true;
      reportActive();
      out.push((await store.updateSimpleAuthRequest(who.spreadsheetId, r.id, { status: "expired" })) ?? r);
    } else out.push(r);
  }
  return withSavedOriginals(who, out);
}

/** 중간에 끊겨(재시작·실패) 요약이 비었어도, 이미 받아 저장한 원문 PDF 는 사업자별로 보여 준다(belie 2026-11-11). 한 번 채우면 저장. */
async function withSavedOriginals(who: SimpleAuthWho, list: SimpleAuthRequest[]): Promise<SimpleAuthRequest[]> {
  const empty = list.filter((r) => !r.businesses.length && r.status !== "waiting" && r.status !== "scraping");
  const keys = await store.listSimpleAuthOriginalKeys(who.spreadsheetId, empty.map((r) => r.id)).catch(() => []);
  if (!keys.length) return list;
  const fixed = new Map<string, SimpleAuthRequest>();
  for (const r of empty) {
    const mine = keys.filter((k) => k.requestId === r.id);
    if (!mine.length) continue;
    const named = [...new Set(mine.map((k) => k.bizNo).filter(Boolean))];
    const businesses: SimpleAuthBusiness[] = (named.length ? named : [""]).map((bizNo) => ({
      bizNo, name: bizNo || "사업자", applied: false, link: { state: "none" },
      results: r.docs.map((doc) => {
        const got = mine.filter((k) => (k.bizNo === bizNo || !k.bizNo) && (k.docKey === doc || (doc === "fs" && k.docKey.startsWith("fs-"))));
        if (!got.length) return { key: doc, ok: false, reason: "받지 못했어요.", facts: [], fields: [], hasOriginal: false };
        // 재무제표 원문 링크는 화면이 「YYYY년」 문구에서 연도를 읽어 만든다.
        const facts = doc === "fs"
          ? [...new Set(got.map((k) => k.docKey.slice(3)))].sort().reverse().map((y) => `${y}년 — 원문만 남았어요(요약 없음)`)
          : ["원문만 남았어요(요약 없음) — 「원문」으로 열어 보세요"];
        return { key: doc, ok: true, facts, fields: [], hasOriginal: true };
      }),
    }));
    const updated = await store.updateSimpleAuthRequest(who.spreadsheetId, r.id, {
      status: "done", businesses, error: "중간에 끊겨 받은 서류의 원문만 남았어요. 빠진 서류는 다시 보내 주세요.",
    });
    if (updated) fixed.set(r.id, updated);
  }
  return list.map((r) => fixed.get(r.id) ?? r);
}

async function own(who: SimpleAuthWho, id: string): Promise<SimpleAuthRequest> {
  const r = await store.getSimpleAuthRequest(who.spreadsheetId, id);
  if (!r) throw new SimpleAuthError("요청을 찾지 못했어요.", 404);
  return r;
}

export async function actSimpleAuth(who: SimpleAuthWho, id: string, action: SimpleAuthAction): Promise<{ request: SimpleAuthRequest | null; message?: string }> {
  const r = await own(who, id);
  const job = jobs.get(id);
  switch (action.action) {
    case "confirm": {
      if (r.status !== "waiting") return { request: r };
      if (!job?.leads.length) return { request: r, message: "아직 인증 요청이 도착하지 않았어요. 잠시 뒤 다시 눌러 주세요." };
      if (job.leads.every((l) => l.tries >= SIMPLE_AUTH_CONFIRM_TRIES)) return { request: r, message: "승인 확인을 여러 번 했어요. 「다시」로 새로 보내 주세요." };
      await store.updateSimpleAuthRequest(who.spreadsheetId, id, { status: "scraping" });
      const results = await Promise.all([...job.leads].map((l) => confirmLead(job, l)));
      if (results.includes("waiting")) {
        await store.updateSimpleAuthRequest(who.spreadsheetId, id, { status: job.datas.size ? "scraping" : "waiting" });
        return { request: await own(who, id), message: "고객이 아직 승인하지 않았어요. 승인한 뒤 다시 눌러 주세요." };
      }
      return { request: await own(who, id) };
    }
    case "resend": return { request: await resendSimpleAuth(who, id) };
    case "cancel": {
      if (job) { job.finished = true; reportActive(); }
      return { request: await store.updateSimpleAuthRequest(who.spreadsheetId, id, { status: "canceled" }) };
    }
    case "delete": {
      if (r.status === "waiting" || r.status === "scraping") throw new SimpleAuthError("진행 중인 요청은 먼저 취소해 주세요.", 409);
      jobs.delete(id);
      await store.deleteSimpleAuthRequest(who.spreadsheetId, id);
      return { request: null };
    }
    case "link": return { request: await linkBusiness(who, r, action.bizNo, action.link) };
    case "apply": return { request: await applyBusiness(who, r, action.bizNo, action.patch) };
  }
}

/** 다시 보내기 — 처음 보낸 입력이 서버 메모리에 남아 있을 때(30분)만. 인증 정보는 저장하지 않아서다. */
export async function resendSimpleAuth(who: SimpleAuthWho, id: string): Promise<SimpleAuthRequest> {
  const r = await own(who, id);
  const old = jobs.get(id);
  if (simpleAuthDraining()) throw new SimpleAuthError(DRAINING, 503);
  if (!old || old.input.mode !== "simple") throw new SimpleAuthError("처음 보낸 정보가 없어요. 왼쪽에서 다시 입력해 보내 주세요.", 409);
  if (r.status === "waiting" || r.status === "scraping") old.finished = true;
  const now = Date.now();
  const updated = await store.updateSimpleAuthRequest(who.spreadsheetId, id, {
    status: "waiting", deadline: now + SIMPLE_AUTH_WAIT_MS, resends: r.resends + 1, progress: 0, businesses: [], error: undefined,
  });
  const job: Job = { reqId: id, owner: who, input: old.input, leads: [], datas: new Map(), errors: new Map(), saved: new Set(), pending: 0, finished: false, until: Date.now() + SIMPLE_AUTH_WAIT_MS + JOB_GRACE_MS };
  startJob(job, buildCalls(old.input, { nt: randomUUID(), mw: randomUUID(), pp: randomUUID() }, false));
  return updated ?? r;
}

function bizOf(r: SimpleAuthRequest, bizNo: string): SimpleAuthBusiness {
  const b = r.businesses.find((x) => x.bizNo === bizNo);
  if (!b) throw new SimpleAuthError("사업자를 찾지 못했어요.", 404);
  return b;
}

async function needCtx(who: SimpleAuthWho): Promise<DbSheetContext> {
  const ctx = await dbContext(who);
  if (!ctx) throw new SimpleAuthError("DB 목록을 열 수 없는 계정이에요.", 409);
  return ctx;
}

async function linkBusiness(who: SimpleAuthWho, r: SimpleAuthRequest, bizNo: string, to: Extract<SimpleAuthAction, { action: "link" }>["link"]) {
  const b = bizOf(r, bizNo);
  let link: SimpleAuthLink;
  if (to.to === "later") link = { state: "later" };
  else {
    const ctx = await needCtx(who);
    if (to.to === "new") link = await createDbRow(ctx, b, r.owner, r.phone);
    else {
      const row = (await loadDbSheet(ctx)).find((x) => x.id === to.dbId);
      if (!row) throw new SimpleAuthError("그 DB를 찾지 못했어요.", 404);
      link = { state: "linked", dbId: row.id, company: row.company, why: "picked" };
    }
  }
  return store.updateSimpleAuthRequest(who.spreadsheetId, r.id, { businesses: r.businesses.map((x) => (x.bizNo === bizNo ? { ...x, link } : x)) });
}

/** 연결된 DB 의 지금 업체정보(비교표의 「지금 값」). */
export async function currentCompanyInfo(who: SimpleAuthWho, id: string, bizNo: string): Promise<{ ci: CompanyInfo; readOnly: boolean }> {
  const b = bizOf(await own(who, id), bizNo);
  if (b.link.state !== "linked") throw new SimpleAuthError("먼저 DB에 연결해 주세요.", 409);
  const dbId = b.link.dbId;
  const row = (await loadDbSheet(await needCtx(who))).find((x) => x.id === dbId);
  if (!row) throw new SimpleAuthError("연결한 DB를 찾지 못했어요.", 404);
  return { ci: row.contact.ci, readOnly: !!row.meetingId };
}

async function applyBusiness(who: SimpleAuthWho, r: SimpleAuthRequest, bizNo: string, patch: Record<string, string>) {
  const b = bizOf(r, bizNo);
  if (b.link.state !== "linked") throw new SimpleAuthError("먼저 DB에 연결해 주세요.", 409);
  const dbId = b.link.dbId;
  const ctx = await needCtx(who);
  const row = (await loadDbSheet(ctx)).find((x) => x.id === dbId);
  if (!row) throw new SimpleAuthError("연결한 DB를 찾지 못했어요.", 404);
  if (row.meetingId) throw new SimpleAuthError("미팅에 연결된 DB예요. 업체정보는 미팅 화면에서 고쳐 주세요.", 409);
  const allowed = new Set([...b.results.flatMap((x) => x.fields.map((f) => f.key)), "매출기준연도"]);
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.has(k)));
  const lead = DbSheetLeadInput.parse({ ...row, contact: { ...row.contact, ci: { ...row.contact.ci, ...clean } } });
  await executeDbSheet(ctx, { action: "save", lead, revision: row.revision });
  return store.updateSimpleAuthRequest(who.spreadsheetId, r.id, { businesses: r.businesses.map((x) => (x.bizNo === bizNo ? { ...x, applied: true } : x)) });
}

/** 원문 PDF(base64) — 사업자 몫이 없으면 개인 서류 몫(""). */
export async function originalOf(who: SimpleAuthWho, id: string, bizNo: string, doc: string): Promise<{ pdf: Buffer; fileName: string }> {
  const r = await own(who, id);
  const b = bizOf(r, bizNo);
  const pdf = (await store.readSimpleAuthOriginal(who.spreadsheetId, id, bizNo, doc)) ?? (await store.readSimpleAuthOriginal(who.spreadsheetId, id, "", doc));
  if (!pdf) throw new SimpleAuthError("원문이 없어요.", 404);
  const label = doc.startsWith("fs-") ? `${simpleAuthDocLabel("fs")} ${doc.slice(3)}` : simpleAuthDocLabel(doc as SimpleAuthDocKey);
  return { pdf: Buffer.from(pdf, "base64"), fileName: `${b.name} ${label}.pdf` };
}

/** 테스트 전용 — 진행 중 작업 비우기. */
export function resetSimpleAuthJobs() { jobs.clear(); }
