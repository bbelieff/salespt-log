/**
 * ADR-0038 5단계 샌드박스 — 「시트에서 떼어 낸 기수」(SHEET_DETACHED_COHORTS) 의 기존 시트 수강생도
 * 주요 화면·저장이 구글 시트를 한 번도 부르지 않는지 본다(2단계 시트 없는 수강생 하네스와 같은 단계).
 * 아래는 2단계 원문 설명 —
 * ADR-0038 2단계 샌드박스 — 시트 없는 수강생(케이스 B, `local:` 번호)으로 주요 화면 API 의
 * 서비스 함수를 실제 SQL(PGlite) 위에서 돌려, 구글 시트를 한 번도 부르지 않는지 확인한다.
 * 운영 DB·네트워크·실명 없음(합성 이메일·합성 번호만). 구글 API 는 모킹 — 닿으면 숫자가 오른다.
 *
 * 통과 조건(docs/plans/active/sheetless-student-id.md §3 2단계):
 *  · 각 화면 함수가 `[no-sheet]` 오류 없이 끝난다.
 *  · 시트 관문이 막은 횟수(sheetlessBlockCount) 0 — 뒤에서 조용히 삼킨 시트 미러 시도까지 0.
 *  · 구글 API 실제 호출 0.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as unknown as import("@electric-sql/pglite").PGlite, google: 0, where: [] as string[] }));
vi.mock("@/config/sheet-detach", () => ({ SHEET_DETACHED_COHORTS: new Set(["9"]) }));
vi.mock("@/lib/analytics/api-timing", async (orig) => ({
  ...(await orig<object>()),
  captureServerEvent: (event: string) => {
    if (event !== "sheetless_sheet_blocked") return;
    const frames = (new Error().stack ?? "").split("\n").filter((l) => /lib[\\/](repo|service)/.test(l) && !/sheets-client/.test(l));
    fixture.where.push(frames.slice(0, 3).map((l) => l.replace(/.*lib[\\/]/, "lib/").replace(/\)$/, "")).join(" <- "));
  },
}));
// 실제 DB 클라이언트(lib/repo/db/client.ts)가 그대로 돌도록 pg 의 Pool 만 메모리 DB 로 바꾼다.
vi.mock("pg", () => {
  class Pool {
    query = query;
    async connect() { return { query, release() {} }; }
    on() { return this; }
    async end() {}
  }
  return { Pool, default: { Pool } };
});
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn, revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("@/repo/db/trainer-recruitment", () => ({ listTrainerQualifications: async () => [] }));
vi.mock("@/config", async (orig) => ({
  ...(await orig<object>()),
  serviceAccount: () => ({ client_email: "sa@example.test", private_key: "synthetic" }),
}));
vi.mock("googleapis", () => {
  const fn = async () => {
    fixture.google += 1;
    const frames = (new Error().stack ?? "").split("\n").filter((l) => /lib[\\/](repo|service)/.test(l) && !/sheets-client/.test(l));
    fixture.where.push(frames.slice(0, 3).map((l) => l.replace(/.*lib[\\/]/, "lib/").replace(/\)$/, "")).join(" <- "));
    return { data: { values: [] } };
  };
  const values = { get: fn, batchGet: fn, update: fn, batchUpdate: fn, append: fn, clear: fn, batchClear: fn };
  return {
    google: {
      auth: { JWT: class {}, GoogleAuth: class {} },
      sheets: () => ({ spreadsheets: { values, get: fn, batchUpdate: fn } }),
      drive: () => ({ files: { get: fn, list: fn, create: fn, update: fn } }),
      calendar: () => ({ events: { list: fn, insert: fn, patch: fn, delete: fn } }),
    },
  };
});
async function query(sql: string | { text: string; values?: unknown[] }, params: unknown[] = []) {
  if (typeof sql !== "string") { params = sql.values ?? []; sql = sql.text; }
  const r = params.length ? await fixture.db.query(sql, params) : await fixture.db.exec(sql).then((rs) => rs[rs.length - 1] ?? { rows: [], affectedRows: 0 });
  return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
}

import { sheetlessBlockCount } from "@/repo/sheets-client";

const MEETING_ID = "33333333-3333-4333-8333-333333333333";
const state = { contractRow: 0 };
const LOCAL_B = "1SyntheticDetachedSheet9_abcdefghijklmnopqrstu"; // 시트 번호(떼어 낸 9기)
const EMAIL = "d9@example.test";
const TODAY = "2026-11-10";

beforeAll(async () => {
  process.env.REGISTRY_DB_READ = "1";
  process.env.DATABASE_URL = "postgres://synthetic.invalid/sandbox"; // 연결은 위 pg 모킹이 가로챈다
  fixture.db = new PGlite();
  for (const f of [
    "0001_users_cohorts.sql",
    "0002_users_natural_key.sql",
    "0005_weekly_goals.sql",
    "0008_db_sheet.sql",
    "0014_call_records.sql",
    "0015_contact_scripts.sql",
    "0016_db_sheet_feeds.sql",
  ]) {
    await fixture.db.exec(readFileSync(`lib/repo/db/migrations/${f}`, "utf8"));
  }
  await fixture.db.exec(`create table if not exists sheet_rows (
    id bigserial primary key, cohort text not null, email text, spreadsheet_id text not null,
    tab text not null, row_key text not null, payload jsonb not null,
    updated_at timestamptz not null default now(), mirror_pending boolean not null default false,
    unique (spreadsheet_id, tab, row_key))`);
  await query(
    `insert into users(id,email,cohort,name,spreadsheet_id,role,course_start_iso,graduation_iso,cohort_label)
     values($1,$2,'9','합성B',$3,'trainee','2026-10-05','2026-12-26','9')`,
    [randomUUID(), EMAIL, LOCAL_B],
  );
}, 60000);
afterAll(async () => {
  delete process.env.REGISTRY_DB_READ;
  delete process.env.DATABASE_URL;
  await fixture.db?.close();
});

type Step = { name: string; run: () => Promise<unknown> };

async function runStep(step: Step) {
  const before = sheetlessBlockCount();
  const g0 = fixture.google;
  fixture.where = [];
  let error = "";
  try {
    await step.run();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  // 응답 뒤로 미룬 미러 작업(fire-and-forget)까지 마치게 잠깐 기다린다.
  await new Promise((r) => setTimeout(r, 30));
  return { name: step.name, error, blocks: sheetlessBlockCount() - before + (fixture.google - g0), where: [...new Set(fixture.where)] };
}

const STEPS: Step[] = [
  { name: "me", run: async () => (await import("@/service/me")).loadMe(EMAIL) },
  { name: "dashboard", run: async () => (await import("@/service/dashboard")).loadDashboard(EMAIL) },
  { name: "daily load", run: async () => (await import("@/service/contact")).loadDay(EMAIL, TODAY) },
  {
    name: "daily save",
    run: async () =>
      (await import("@/service/contact")).saveContactMetrics(EMAIL, TODAY, {
        직접생산: { production: 3, inflow: 2, contactProgress: 1, meetingReservation: 0 },
      } as never),
  },
  { name: "db overview", run: async () => (await import("@/service/db")).loadDBOverview(EMAIL) },
  {
    name: "db add production",
    run: async () =>
      (await import("@/service/db-creates")).addProduction(EMAIL, {
        시작일: TODAY, 종료일: TODAY, 소재: "합성소재", 기간예산: 10000, 생산개수: 5, 기타: "", 부가세여부: false,
      }),
  },
  {
    name: "db add purchase",
    run: async () =>
      (await import("@/service/db-creates")).addPurchase(EMAIL, {
        구매일: TODAY, 업체명: "합성공급처", 개당단가: 1000, 주문개수: 3, 기타: "", 부가세여부: false,
      }),
  },
  { name: "schedule week", run: async () => (await import("@/service/contact-week")).loadWeekMeetings(EMAIL, "2026-11-06") },
  { name: "schedule month", run: async () => (await import("@/service/calendar")).loadMonthMeetings(EMAIL, "2026-11") },
  {
    name: "meeting add",
    run: async () =>
      (await import("@/service/contact")).appendNewMeeting(EMAIL, {
        id: MEETING_ID, 예약일: TODAY, 예약시각: "10:00", 미팅날짜: "2026-11-12", 미팅시간: "14:00",
        channel: "직접생산", 업체명: "합성업체", 장소: "합성시 합성구", 예약비고: "", 상태: "예약",
        계약여부: false, 수임비: 0, 미팅사유: "", 계약조건: "",
      } as never),
  },
  { name: "follow-ups", run: async () => (await import("@/service/meeting-follow-ups")).loadFollowUpMeetings(EMAIL, TODAY) },
  { name: "meeting patch", run: async () => (await import("@/service/contact")).patchMeeting(EMAIL, MEETING_ID, { 상태: "계약", 계약여부: true, 수임비: 1000000 }) },
  {
    name: "contract add",
    run: async () => {
      const r = await (await import("@/service/contract-payment-add")).addFromContract(EMAIL, { 계약일: "2026-11-12", 업체명: "합성업체", 수임비: 1000000 });
      state.contractRow = r.row;
    },
  },
  {
    name: "company info save",
    run: async () =>
      (await import("@/service/contract-payment")).saveCompanyInfoByContract(EMAIL, {
        계약일: "2026-11-12", 업체명: "합성업체", 업체정보: { 소재지: "합성시 합성구" } as never,
      }),
  },
  { name: "company info load", run: async () => (await import("@/service/contract-payment")).loadCompanyInfoByContract(EMAIL, { 계약일: "2026-11-12", 업체명: "합성업체" }) },
  {
    name: "contract patch",
    run: async () => {
      const svc = await import("@/service/contract-payment");
      const cp = (await svc.loadContractPayments(EMAIL)).find((c) => c.row === state.contractRow);
      if (!cp) throw new Error(`계약 행 ${state.contractRow} 없음`);
      await svc.patchContractPayment(EMAIL, { ...cp, 공동인증서: true });
    },
  },
  {
    name: "todo create",
    run: async () =>
      (await import("@/service/todos")).createTodo(EMAIL, {
        contractRef: "2026-11-12|합성업체", institutionRef: "", 업체명: "합성업체", type: "기타", 제목: "합성 할 일",
        예정일자: "2026-11-13", 예정시각: "", 장소: "", 상세: "", showOnCalendar: true, 분류: "",
      } as never),
  },
  { name: "todos after", run: async () => (await import("@/service/todos")).listTodos(EMAIL, "2026-11-12|합성업체") },
  { name: "contracts", run: async () => (await import("@/service/contract-payment")).loadContractPayments(EMAIL) },
  { name: "todos", run: async () => (await import("@/service/todos")).listTodos(EMAIL, "") },
  { name: "badges", run: async () => (await import("@/service/badges")).loadBadges(EMAIL, TODAY) },
  { name: "grant matches", run: async () => (await import("@/service/grant-matches")).loadGrantMatches(EMAIL, TODAY) },
  { name: "expenses", run: async () => (await import("@/service/expense-ledger")).getExpenseLedger(EMAIL, { view: "month", month: "2026-11" }) },
  { name: "vault", run: async () => (await import("@/service/company-vault")).loadVault(EMAIL, { 계약일: "2026-11-12", 업체명: "합성업체" }, undefined) },
  { name: "lead candidates", run: async () => (await import("@/service/db")).listLeadCandidates(EMAIL, "") },
  { name: "export", run: async () => (await import("@/service/export-xlsx")).buildExportWorkbookData(EMAIL) },
];

describe("떼어 낸 9기 시트 수강생 — 주요 화면이 시트 없이 돈다", () => {
  it("모든 화면 함수가 시트 호출 0 으로 끝나고, 저장한 값이 다시 읽힌다", async () => {
    const results = [];
    for (const step of STEPS) results.push(await runStep(step));
    const failed = results.filter((r) => r.error || r.blocks > 0);
    expect(failed, JSON.stringify(failed, null, 1)).toEqual([]);
    expect(sheetlessBlockCount()).toBe(0);
    expect(fixture.google).toBe(0);
  }, 120000);

  it("저장한 값이 DB 에서 다시 읽힌다(대시보드·DB관리·계약·할 일)", async () => {
    const { loadDBOverview } = await import("@/service/db");
    const db = await loadDBOverview(EMAIL);
    expect(db.purchases.map((p) => p.업체명)).toContain("합성공급처");
    expect(db.productions.map((p) => p.소재)).toContain("합성소재");
    const contracts = await (await import("@/service/contract-payment")).loadContractPayments(EMAIL);
    const c = contracts.find((x) => x.row === state.contractRow);
    expect(c?.업체명).toBe("합성업체");
    expect(c?.공동인증서).toBe(true);
    const todos = await (await import("@/service/todos")).listTodos(EMAIL, "2026-11-12|합성업체");
    expect(todos.map((t) => t.제목)).toContain("합성 할 일");
    const day = await (await import("@/service/contact")).loadDay(EMAIL, TODAY);
    // 직접생산은 생산=유입(ADR-0024) — 입력한 유입 2·컨택 1 이 그대로 다시 읽혀야 한다.
    expect(JSON.stringify(day)).toContain("\"inflow\":2,\"contactProgress\":1");
    const me = await (await import("@/service/me")).loadMe(EMAIL);
    expect(me.name).toBe("합성B");
    expect(sheetlessBlockCount()).toBe(0);
  }, 60000);

  it("DB관리 행 번호는 DB 가 정하고 서로 겹치지 않는다(동시 추가)", async () => {
    const { addPurchase } = await import("@/service/db-creates");
    const rows = await Promise.all(
      [1, 2, 3].map((i) =>
        addPurchase(EMAIL, { 구매일: TODAY, 업체명: `동시${i}`, 개당단가: 100, 주문개수: 1, 기타: "", 부가세여부: false }),
      ),
    );
    const nums = rows.map((r) => r.row);
    expect(new Set(nums).size).toBe(3);
    expect(sheetlessBlockCount()).toBe(0);
  }, 60000);
});
