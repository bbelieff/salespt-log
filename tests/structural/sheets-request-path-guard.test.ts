/**
 * 구조 테스트 — 요청 경로 시트 재유입 차단 게이트 (BBE-251, 시트독립 프로그램 4단계).
 *
 * BBE-246(계약·DB관리 update/clear 시트 동기 제거)·BBE-56(레지스트리 읽기 flip) 이 파일럿
 * 경로에서 어렵게 걷어낸 시트 왕복이, 이후 아무 코드에서나 다시 스며들어도 눈에 안 띄면
 * 소용이 없다. 이 테스트는 "요청 경로(app/api/**·app/(app)/**)가 실제로 도달할 수 있는
 * lib/repo/** 파일 중 시트 저수준 호출(sheetsClient()/readRange/appendRows/ensureGridColumns)
 * 을 갖는 파일" 을 매 커밋 재계산해서, 화이트리스트 밖의 새 파일이 나타나면 CI 를 깨뜨린다.
 *
 * 패턴은 tests/structural/sheets-append-guard.test.ts(BBE-97)·layers.test.ts 와 동일 —
 * AST 대신 regex import 파서 + BFS. 화이트리스트는 파일 단위(BBE-97 과 동일 세밀도), 항목마다
 * 사유 태그 필수(A 의 BBE-245 설계 코멘트 제안 그대로):
 *   - R2-비파일럿-폴백    : chooseDailySource/chooseWriteSource 가 시트로 판정할 때만 도달
 *                          (비파일럿 기수 — R2 설계상 영구 시트 유지, daily-source.ts 참조)
 *   - append-제외         : 행번호가 시트 할당이라 재시도 시 중복행 위험(db-write-flip.md §6 R3-3/R3-4)
 *   - union-백필-안전망    : DB append-미러 실패로 누락된 행을 시트에서 보충(Promise.allSettled
 *                          병행 read, loadContractPayments/loadDBOverview 의 의도적 설계)
 *   - 비동기-수렴미러      : queueXxxSync 류 — 응답 이후 detached promise 로 큐잉되는 시트 미러.
 *                          fire-and-forget 이라 요청 경로를 "동기로" 막지 않는다(BBE-246 patterns).
 *   - 레거시-미전환        : chooseDailySource/chooseWriteSource 게이트를 쓰지만 아직 파일럿
 *                          DB-primary 전환이 안 된 화면(계약·DB관리 외 나머지 탭) — 4단계
 *                          시점(2026-08-20) 기준 사실 그대로 등재, 전환될 때마다 항목이 준다.
 *   - 인프라               : sheets-client.ts 자신(저수준 함수 정의부).
 *
 * "진행률 지표": 화이트리스트 항목 수가 마이그레이션 진행에 따라 줄어드는 것 자체가
 * 기계검증 가능한 탈피 진행도다(A 의 설계 제안 그대로 채택).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = join(__dirname, "..", "..");

function walk(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, pattern));
    else if (pattern.test(name)) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const re = /(?:^|\s)(?:import|from)\s+['"]([^'"]+)['"]/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) names.push(m[1]!);
  return names;
}

// vitest.config.ts 의 alias 테이블과 1:1 대응 (구체적 → 일반 순서 유지).
const ALIASES: Array<[RegExp, string]> = [
  [/^@\/types$/, "lib/types/index.ts"],
  [/^@\/config$/, "lib/config/index.ts"],
  [/^@\/service$/, "lib/service/index.ts"],
  [/^@\/types\/(.*)$/, "lib/types/$1"],
  [/^@\/config\/(.*)$/, "lib/config/$1"],
  [/^@\/repo\/(.*)$/, "lib/repo/$1"],
  [/^@\/service\/(.*)$/, "lib/service/$1"],
  [/^@\/auth\/(.*)$/, "lib/auth/$1"],
  [/^@\/query\/(.*)$/, "lib/query/$1"],
  [/^@\/util\/(.*)$/, "lib/util/$1"],
  [/^@\/(.*)$/, "$1"],
];

/** import specifier(alias/relative) → repo-root-relative 실제 파일 경로. 외부 패키지/해석
 *  불가면 null(노드 무시 — node_modules 는 이 BFS 의 관심사가 아니다). */
function resolveImport(fromFile: string, spec: string): string | null {
  let target: string | null = null;
  if (spec.startsWith(".")) {
    target = relative(ROOT, join(dirname(fromFile), spec)).replace(/\\/g, "/");
  } else {
    for (const [re, replacement] of ALIASES) {
      const m = spec.match(re);
      if (m) {
        target = replacement.replace(
          "$1",
          () => m[1] ?? "",
        );
        break;
      }
    }
  }
  if (target === null) return null; // 외부 패키지(googleapis 등) — 격리는 layers.test.ts 소관
  const abs = join(ROOT, target);
  for (const cand of [abs, `${abs}.ts`, `${abs}.tsx`, join(abs, "index.ts"), join(abs, "index.tsx")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return relative(ROOT, cand).replace(/\\/g, "/");
  }
  return null;
}

/** app/api/**·app/(app)/** 의 모든 엔트리에서 BFS 로 도달 가능한 lib/repo/** 파일 집합. */
function reachableRepoFiles(): Set<string> {
  const entries = [
    ...walk(join(ROOT, "app", "api"), /\.(ts|tsx)$/),
    ...walk(join(ROOT, "app", "(app)"), /\.(ts|tsx)$/),
  ].map((f) => relative(ROOT, f).replace(/\\/g, "/"));

  const visited = new Set<string>();
  const repoHits = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const rel = queue.shift()!;
    if (visited.has(rel)) continue;
    visited.add(rel);
    if (rel.startsWith("lib/repo/")) repoHits.add(rel);
    const abs = join(ROOT, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    for (const spec of importsOf(abs)) {
      const resolved = resolveImport(abs, spec);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return repoHits;
}

const LOW_LEVEL_CALL = /\b(sheetsClient|readRange|appendRows|ensureGridColumns)\s*\(/;

function touchesSheetsLowLevel(rel: string): boolean {
  if (rel === "lib/repo/sheets-client.ts") return false; // 인프라 자신은 아래서 별도 처리
  const src = readFileSync(join(ROOT, rel), "utf8");
  return LOW_LEVEL_CALL.test(src);
}

// ── 화이트리스트 정본 — 사유 태그 필수 ──────────────────────────────
// 첫 실측(discovery, 빈 화이트리스트로 1회 실행)으로 실제 도달 가능·시트 저수준 호출 보유
// 파일 목록을 얻은 뒤, 파일마다 그 정의부(head 주석)를 직접 읽고 분류했다(추측 등재 금지,
// CLAUDE.md §0.8 "증거 없는 문장 금지"). 최초 초안엔 lib/service/* 파일 4개를 lib/repo/* 로
// 착각해 등재한 오기가 있었는데, 바로 아래 "죽은 등록 방지" 테스트가 즉시 잡아냈다(존재하지
// 않는 lib/repo/ 경로라 도달성 0으로 뜸) — 화이트리스트 자기검증 테스트가 실제로 작동한다는
// 증거로 겸사 남긴다.
type Reason =
  | "R2-비파일럿-폴백"
  | "append-제외"
  | "union-백필-안전망"
  | "비동기-수렴미러"
  | "레거시-미전환"
  | "시트전용기능"
  | "백필-도구"
  | "인프라";

const WHITELIST: Record<string, Reason> = {
  "lib/repo/sheets-client.ts": "인프라",

  // 계약(02) — BBE-246 이후 update/clear 는 파일럿에서 시트 제거됐으나, append(행번호 시트
  // 할당)·union 백필 read·비파일럿 폴백은 같은 파일 안에 여전히 남아 있다(BBE-242 실측).
  "lib/repo/contract-payment.ts": "union-백필-안전망",
  "lib/repo/contract-payment-link.ts": "R2-비파일럿-폴백",
  "lib/repo/contract-payment-sync.ts": "R2-비파일럿-폴백",
  "lib/repo/contract-payment-termination.ts": "R2-비파일럿-폴백",
  "lib/repo/contract-sheet-sync.ts": "비동기-수렴미러",

  // DB관리(03) — 계약과 대칭 구조(BBE-246 worklog: db-tab-sync.ts 가 같은 append-제외 결정 선례).
  // db-write.ts·db-tab-sheet-sync.ts 는 저수준 호출을 직접 하지 않고 db-tab-writers.ts 로
  // 위임(실측 확인 — grep 0건) — 화이트리스트 불필요, 위임처만 등재.
  "lib/repo/db.ts": "union-백필-안전망",
  // db.ts(append)·db-write.ts(update/clear) 공용 저수준 쓰기 헬퍼 — append 는 항상(전 기수)
  // 도달하므로 append-제외 가 지배적 사유(db-tab-writers.ts 자체 doc comment: "db.ts(append)·
  // db-write.ts(update/clear) 양쪽이 공유").
  "lib/repo/db-tab-writers.ts": "append-제외",
  // BBE-61(R3-4b) 로 파일럿이어도 mirrorSheetRowAwaitable 로 "동기 시도"(단 절대 throw 안 함) —
  // 컨택 저장이 이미 커밋된 뒤라 이 실패로 응답을 되돌리면 안 되기 때문(파일 자체 doc comment).
  // 비동기-수렴미러 의 awaited 변형으로 분류.
  "lib/repo/db-production-cell.ts": "비동기-수렴미러",

  // 레지스트리 — BBE-56 게이트 ON 이후 DB 우선이나, cachedRegistryRows 의 fresh 우회·DB null
  // 폴백 경로(BBE-247)가 저수준 시트 read 를 그대로 가짐. 담당배정(G열) 등 registry 컬럼
  // 쓰기는 시트가 여전히 쓰기 정본(BBE-253 조사로 실측 확인 — updateUserCell).
  "lib/repo/users.ts": "레거시-미전환",
  "lib/repo/users-rows.ts": "레거시-미전환",
  "lib/repo/users-sort.ts": "레거시-미전환",
  "lib/repo/users-prep.ts": "레거시-미전환",
  "lib/repo/users-delete.ts": "레거시-미전환",
  "lib/repo/users-arena.ts": "레거시-미전환", // 아레나 회장/참가자 registry — users.ts 와 동형
  "lib/repo/cohorts.ts": "레거시-미전환",
  // self-claim 최초 로그인 시 registry 새 row 생성(A{n} 결정적 좌표 append) — 시트 행 할당.
  "lib/repo/users-claim.ts": "append-제외",
  // registry I~L 캐시 컬럼 일괄 백필(PR B-3) — 정기 요청 경로가 아니라 admin 트리거 1회성
  // 마이그레이션 도구(파일 자체 doc comment: "동작: 1.registry 전체 row 스캔...").
  "lib/repo/users-cache-migrate.ts": "백필-도구",

  // 04 업체관리(미팅)·05 투두·gcal 재열거 — daily-source.ts 의 동일 게이트를 쓰지만 계약·
  // DB관리처럼 파일럿 DB-primary 전환(BBE-246 급)이 아직 안 됐다(BBE-242 로드맵 3단계).
  "lib/repo/meetings.ts": "레거시-미전환",
  "lib/repo/todos.ts": "레거시-미전환",
  "lib/repo/gcal-schedule-read.ts": "레거시-미전환", // 04·05 전체 열거(읽기 전용), 재사용 뿐

  // 01 영업관리(sales) — 계약·DB관리처럼 아직 파일럿 DB-primary 전환 전(로드맵 3단계 잔여).
  "lib/repo/sales.ts": "레거시-미전환",
  "lib/repo/sales-profile.ts": "레거시-미전환", // B3/C3 self-claim 최초 1회 쓰기
  // R3⑤ "수렴 미러 전용"(파일 자체 doc comment 문구) — DB 정본 경로의 시트 미러.
  "lib/repo/sales-row-write.ts": "비동기-수렴미러",
  "lib/repo/sales-production-cell.ts": "비동기-수렴미러", // mirrorSheetRow(non-awaited) 사용

  // 아레나 이월 — 04 는 새 미팅 append(행 신규 생성), 02 는 계약 append 경로 재사용.
  "lib/repo/carryover.ts": "append-제외",

  // 시트 전용 기능 — DB 에 대응 개념이 없다(설계상 영구 시트, "재이관" 대상 아님).
  "lib/repo/setup-formulas.ts": "시트전용기능", // 시트 수식 설치/제거(DB엔 수식이 없다)
  "lib/repo/dashboard.ts": "시트전용기능", // CLAUDE.md: "대시보드는 읽기전용, 시트 수식이 계산 — 재구현 X"

  // 레지스트리 탭(개인 시트 아님) — 소량·저빈도 admin 관리 컬렉션, 미전환.
  "lib/repo/share-scores.ts": "레거시-미전환",
  "lib/repo/announcements.ts": "레거시-미전환",

  // 캘린더 — 요청 경로에서 도달하나 시트가 아니라 gcal API 전용 보조 read(union backfill 성격).
  "lib/repo/gcal-event-ids.ts": "union-백필-안전망",

  // 기수 생성 시 O1/O2(수강시작/종강) 쓰기 — admin 전용, 저빈도(R3-5).
  "lib/repo/course-dates.ts": "레거시-미전환",

  // 06 업체정보 탭 — 계약 액션 시 스냅샷 큐/수렴 동기화(BBE-60, R7-#11). BBE-246 이 이 파일의
  // 큐/수렴 골격을 그대로 이식했다고 명시(worklog) — 원조 비동기 수렴미러.
  "lib/repo/company-info-archive.ts": "비동기-수렴미러",
};

describe("시트 요청 경로 재유입 차단 게이트 (BBE-251)", () => {
  it("app/api·app/(app) 에서 도달 가능한 lib/repo 파일 중 시트 저수준 호출은 전부 화이트리스트에 등록돼 있다", () => {
    const reachable = reachableRepoFiles();
    const violations: string[] = [];
    for (const rel of reachable) {
      if (rel in WHITELIST) continue;
      if (touchesSheetsLowLevel(rel)) violations.push(rel);
    }
    expect(
      violations,
      "요청 경로에서 새로 도달 가능해진 시트 저수준 호출 발견 — 의도적이면 " +
        "tests/structural/sheets-request-path-guard.test.ts 의 WHITELIST 에 사유(Reason)와 " +
        "함께 등록하라(예: R2-비파일럿-폴백/append-제외/union-백필-안전망/비동기-수렴미러/" +
        "레거시-미전환/시트전용기능/백필-도구). 의도치 않았다면 DB 경로로 되돌려라. " +
        "참고: docs/plans/active/db-write-flip.md",
    ).toEqual([]);
  });

  it("화이트리스트 항목은 실제로 요청 경로에서 도달 가능하고, 시트 저수준 호출도 실제로 갖고 있다(죽은 등록 방지)", () => {
    const reachable = reachableRepoFiles();
    const staleReachability: string[] = [];
    const staleCall: string[] = [];
    for (const rel of Object.keys(WHITELIST)) {
      if (rel === "lib/repo/sheets-client.ts") continue; // 인프라 — 도달성/호출 여부 무관하게 등록
      if (!reachable.has(rel)) staleReachability.push(rel);
      if (!existsSync(join(ROOT, rel)) || !touchesSheetsLowLevel(rel)) staleCall.push(rel);
    }
    expect(staleReachability, "더 이상 요청 경로에서 도달 못 하는 화이트리스트 항목 — 제거하라").toEqual([]);
    expect(staleCall, "더 이상 시트 저수준 호출이 없는 화이트리스트 항목 — 제거하라(마이그레이션 진행)").toEqual([]);
  });
});

// ── 검출 로직 자체를 실제 코드와 무관하게 검증(음성 테스트) ───────────
// BFS·저수준 호출 탐지 함수를 실제 리포에 손대지 않고 합성(fixture) 입력으로 직접 검증한다.
// "위반이 실제로 있으면 이 로직이 잡는가" 를 리포 상태와 독립적으로 증명 — CI 위반 재현.
describe("검출 로직 자체 회귀 — 화이트리스트 밖 시트 호출을 실제로 잡는가", () => {
  it("★음성 테스트: 화이트리스트에 없는 파일이 sheetsClient() 를 호출하면 위반으로 잡힌다", () => {
    const fakeReachable = new Set(["lib/repo/__fixture-not-real__.ts"]);
    const fakeWhitelist: Record<string, Reason> = { ...WHITELIST }; // 실제 화이트리스트, fixture 파일은 미등록
    const fakeSource = `
      import { sheetsClient } from "./sheets-client";
      export async function newUnvettedWrite(id: string) {
        await sheetsClient().spreadsheets.values.update({ spreadsheetId: id } as never);
      }
    `;
    const violations: string[] = [];
    for (const rel of fakeReachable) {
      if (rel in fakeWhitelist) continue;
      if (LOW_LEVEL_CALL.test(fakeSource)) violations.push(rel);
    }
    expect(violations).toEqual(["lib/repo/__fixture-not-real__.ts"]); // 잡혔다 — 가드가 작동함
  });

  it("★화이트리스트에 등록된 파일은 같은 호출이 있어도 위반으로 잡히지 않는다(등록 시 통과 확인)", () => {
    const fakeReachable = new Set(["lib/repo/__fixture-registered__.ts"]);
    const fakeWhitelist: Record<string, Reason> = {
      "lib/repo/__fixture-registered__.ts": "R2-비파일럿-폴백",
    };
    const fakeSource = `sheetsClient().spreadsheets.values.get({} as never);`;
    const violations: string[] = [];
    for (const rel of fakeReachable) {
      if (rel in fakeWhitelist) continue;
      if (LOW_LEVEL_CALL.test(fakeSource)) violations.push(rel);
    }
    expect(violations).toEqual([]); // 화이트리스트 등록으로 정상 통과
  });
});
