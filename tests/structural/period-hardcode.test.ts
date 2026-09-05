/**
 * Structural tests — 기간·날짜·보관 하드코딩 재발 방지 (R4 W1-0, G1~G8).
 * 입력: scratchpad/r4-hardcode-inventory.md §4 (구조테스트 가드 후보 + 오탐 제외목록).
 * 상수 정본 = lib/config/cohort-dates.ts · 주차 계산 정본 = lib/util/week.ts.
 *
 * 원칙: 실패 메시지는 "어떻게 고치는지"까지 포함한다 (remediation-as-error).
 * baseline(박제) 목록 = 이 PR 시점의 기존 잔존 — 새 출현만 차단하고, 잔존은
 * R4 후속 wave 가 소거한다. baseline 에서 사라지는 것은 언제나 OK (ratchet).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");

// ── 파일 수집 ────────────────────────────────────────────────
function walk(dir: string): string[] {
  const out: string[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

/** 앱 코드 스캔 대상 (테스트·스크립트 제외). */
function appFiles(): string[] {
  return ["lib", "app", "components"].flatMap((d) => walk(join(ROOT, d)));
}

/** 내용만 지우고 개행은 보존 — 라인 단위 검사가 뭉개지지 않게. */
const blank = (m: string) => m.replace(/[^\n]/g, "");

/**
 * 문자열·주석을 **한 번의 순서 있는 패스**로 토크나이즈 — 문자열 안의 `//`(URL)를
 * 주석으로 오인해 고아 따옴표→수백 줄 소거가 나던 사고 방지(적대리뷰 확정 HIGH).
 * "..."/'...' 는 \n 제외(개행 넘는 짝짓기 원천 차단), `...` 은 blank 로 개행 보존.
 */
const TOKENS =
  /(`(?:[^`\\]|\\[\s\S])*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g;

/** 주석 제거 (문자열 유지) — 날짜 리터럴·archived 문자열 검사용. */
function stripComments(src: string): string {
  return src.replace(TOKENS, (m) => (m[0] === "/" ? blank(m) : m));
}

/** 주석 + 문자열 리터럴 제거 — 숫자 매직값 검사용 (문구/주석 오탐 방지). */
function stripCommentsAndStrings(src: string): string {
  return src.replace(TOKENS, (m) =>
    m[0] === "/" || m[0] === "`" ? blank(m) : '""',
  );
}

function readRel(f: string): string {
  return readFileSync(join(ROOT, f), "utf8");
}

// ═════════════════════════════════════════════════════════════
// 자기검증 — strip 헬퍼가 라인 구조를 보존하는가 (스캔 소거 사고 재발 방지)
// ═════════════════════════════════════════════════════════════
describe("strip 헬퍼 자기검증", () => {
  it("strip 전후 줄 수 불변 (전 파일)", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const src = readFileSync(file, "utf8");
      const n = src.split("\n").length;
      if (stripComments(src).split("\n").length !== n) bad.push(rel(file) + " (stripComments)");
      if (stripCommentsAndStrings(src).split("\n").length !== n)
        bad.push(rel(file) + " (stripCommentsAndStrings)");
    }
    expect(bad, "strip 이 개행을 삼킴 — 라인 검사 전제 붕괴.\n" + bad.join("\n")).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// lib/util 순수성 — layers.test 방향 검사 밖이므로 여기서 import 0 강제
// ═════════════════════════════════════════════════════════════
describe("lib/util 순수성", () => {
  it("lib/util 은 import 금지 (순수 유틸 — 상위 레이어 역류 원천 차단)", () => {
    const bad: string[] = [];
    for (const file of walk(join(ROOT, "lib", "util"))) {
      const src = stripComments(readFileSync(file, "utf8"));
      if (/(?:^|\n)\s*(?:import|export)\s[^;]*from\s/.test(src)) bad.push(rel(file));
    }
    expect(
      bad,
      "lib/util 은 의존 0 계약 (CLAUDE.md §2 — 어느 레이어에서나 안전하게 import 가능해야 함).\n" +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G1 — graduation offset(50/57) 상수화
// ═════════════════════════════════════════════════════════════
describe("G1: grad-offset 상수화 (50/57)", () => {
  it("GRADUATION_OFFSET* 숫자 정의는 lib/config/cohort-dates.ts 에서만", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (r === "lib/config/cohort-dates.ts") continue;
      const src = stripCommentsAndStrings(readFileSync(file, "utf8"));
      if (/GRADUATION_OFFSET\w*\s*=\s*\d/.test(src)) bad.push(r);
    }
    expect(
      bad,
      `graduation offset 숫자 정의 재출현.\n` +
        `→ 고치는 법: lib/config/cohort-dates.ts 의 GRADUATION_OFFSET_DAYS(_LEGACY) 를 import 하세요.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });

  it("offset 문맥의 50/57 리터럴 금지 (grad/offset/O2 키워드 라인)", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (r === "lib/config/cohort-dates.ts") continue;
      const src = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const line of src.split("\n")) {
        // grad(?!ient): CSS linear/radial-gradient 오탐 제외
        if (!/grad(?!ient)|offset|졸업|종강|수료/i.test(line)) continue;
        // %·한글(예: "+50일" 안내 문구)·소수 연속은 offset 리터럴이 아님
        if (/(?<![\d.])(50|57)(?![\d.%가-힣])/.test(line)) {
          bad.push(`${r}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      bad,
      `offset 문맥에 50/57 리터럴.\n` +
        `→ 고치는 법: @/config/cohort-dates 의 GRADUATION_OFFSET_DAYS(_LEGACY)/ALLOWED_GRAD_OFFSETS 사용.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G2 — 편집 유예 69일 상수화
// ═════════════════════════════════════════════════════════════
describe("G2: 편집 유예(69일) 상수화", () => {
  it("숫자 69 는 lib/config/cohort-dates.ts(EDIT_WINDOW_DAYS) 밖 금지", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (r === "lib/config/cohort-dates.ts") continue;
      const src = stripCommentsAndStrings(readFileSync(file, "utf8"));
      if (/(?<![\d.\w])69(?![\d.\w])/.test(src)) bad.push(r);
    }
    expect(
      bad,
      `편집 유예 69 하드코딩 재출현.\n` +
        `→ 고치는 법: @/config/cohort-dates 의 EDIT_WINDOW_DAYS 를 import 하세요.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G3 — 시트 주차 상한 10 상수화 (물리 상한)
// ═════════════════════════════════════════════════════════════
describe("G3: 시트 주차상한(10) 상수화", () => {
  // 오탐 제외 + baseline (inventory §4 오탐 주의).
  // **R4 W1-2 에서 lib/types/meeting.ts 를 면제에서 뺐다** — 그 파일의 Zod `max(10)` 이 이미
  // 제거돼(grep 0건) 면제가 유령이 됐고, 남겨두면 상한이 다시 들어와도 가드가 못 잡는다.
  const BASELINE = new Set<string>();

  it("week 문맥의 10 비교/클램프는 MAX_SHEET_WEEK 로", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (r === "lib/config/cohort-dates.ts" || BASELINE.has(r)) continue;
      const src = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const line of src.split("\n")) {
        if (!/week/i.test(line)) continue;
        if (/(?:[<>]=?\s*10\b|\bmin\(\s*10\b|\bmax\(\s*10\b|\.max\(\s*10\s*\))/.test(line)) {
          bad.push(`${r}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      bad,
      `주차 상한 10 하드코딩 재출현 (물리 상한).\n` +
        `→ 고치는 법: @/config/cohort-dates 의 MAX_SHEET_WEEK 를 import 하세요. ` +
        `(lib/types 는 layers 제약으로 박제 — BASELINE 참조)\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G4 — 통계 주차수 8 상수화 (통계 창)
// ═════════════════════════════════════════════════════════════
describe("G4: 통계 주차수(8) 상수화", () => {
  // 오탐 제외 (inventory §4): 기수 식별자 "8"(문자열) 은 stripCommentsAndStrings 로 자연 제외.
  it("week 문맥의 8-루프/버킷/클램프는 STATS_WEEKS 로", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (r === "lib/config/cohort-dates.ts") continue;
      const src = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const line of src.split("\n")) {
        if (!/week|주차/i.test(line)) continue;
        if (
          // 비교연산은 좌변이 식별자/괄호로 끝나는 경우만(JSX 텍스트 "…>8주차" 오탐 제외)
          /(?:[\w)\]]\s*[<>]=?\s*8(?![\d.가-힣])|\bnew Array(?:<\w+>)?\(\s*8\s*\)|\blength:\s*8\b|\bmin\((?:[^,()]*,)?\s*8\s*\)|,\s*8\s*\)\s*;?\s*$)/.test(
            line,
          )
        ) {
          bad.push(`${r}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      bad,
      `통계 8주 하드코딩 재출현 (통계 창).\n` +
        `→ 고치는 법: @/config/cohort-dates 의 STATS_WEEKS 를 import 하세요.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G5 — 날짜 리터럴 금지 (앱 코드)
// ═════════════════════════════════════════════════════════════
describe("G5: YYYY-MM-DD 리터럴 금지 (앱 코드)", () => {
  // baseline: 잔여 허용분만 — dashboard 더미 fallback 은 W1-3 에서 소거 완료(재유입 즉시 차단).
  const BASELINE = new Set([
    // "0001-01-01" = 전체기간 뷰 min-date sentinel (달력 날짜 하드코딩 아님)
    "lib/service/expense-ledger.ts",
    // PostHog defaults: "YYYY-MM-DD" 는 SDK 동작 버전 키 (날짜가 아니라 설정 스위치)
    "app/providers.tsx",
  ]);

  it("날짜 리터럴은 테스트 fixture·ops 스크립트에서만", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (BASELINE.has(r)) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      const m = src.match(/["'`]\d{4}-\d{2}-\d{2}/g);
      if (m) bad.push(`${r} (${m.length}건)`);
    }
    expect(
      bad,
      `날짜 하드코딩 금지 (CLAUDE.md §2.5).\n` +
        `→ 고치는 법: O1/O2 파생값 또는 인자로 받으세요. 더미 fallback 은 null 처리로.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G6 — 쓰기 진입점 단일화 강제 (getWritableUserEmail)
//
// ⚠️ R4 W1-1 / ADR-0029(G1 편집 완전해제) 이후 이 게이트의 **의미가 바뀌었다**:
//   구: "archived(수료) 쓰기 차단" — 폐지됨(수료 후에도 저장 가능해야 무제한 CRM).
//   현: "수강생 데이터 쓰기는 반드시 한 진입점을 지난다" — 정책을 한 곳에서 갈아끼우기 위한
//       단일 지점 보장(향후 entitlement §B2 결합 지점). 그래서 함수는 유지·강제한다.
//   → getWritableUserEmail 에 archived throw 를 **되살리지 말 것**(ADR-0029 supersede 필요).
// ═════════════════════════════════════════════════════════════
describe("G6: 수강생 데이터 쓰기 route 는 getWritableUserEmail 경유", () => {
  // 수강생 데이터(시트/DB) 쓰기 prefix — admin(관리자 인증)·gcal(토큰)·claim(온보딩)은 별도 체계.
  const GATED_PREFIXES = [
    "app/api/daily/",
    "app/api/meeting",
    "app/api/todos",
    "app/api/contract-payment",
    "app/api/db/",
    "app/api/company-info",
    "app/api/drive-link",
    "app/api/expenses",
    "app/api/expense-",
  ];
  // company-info/export: TXT 내보내기(읽기 파생) — 쓰기 게이트 비대상 (실측 2026-07-26).
  const EXEMPT = new Set(["app/api/company-info/export/route.ts"]);

  it("write 메서드(POST/PATCH/PUT/DELETE) 가진 gated route 전수", () => {
    const bad: string[] = [];
    for (const file of walk(join(ROOT, "app", "api"))) {
      const r = rel(file);
      if (!r.endsWith("route.ts") || EXEMPT.has(r)) continue;
      if (!GATED_PREFIXES.some((p) => r.startsWith(p))) continue;
      const src = readFileSync(file, "utf8");
      if (!/export (?:async function|const) (?:POST|PATCH|PUT|DELETE)/.test(src)) continue;
      if (!src.includes("getWritableUserEmail")) bad.push(r);
    }
    expect(
      bad,
      `쓰기 진입점 누락 — 수강생 데이터 write route 는 반드시 ` +
        `getWritableUserEmail(@/auth/identity) 를 경유해야 한다 (쓰기 정책 단일 지점, ADR-0029).\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G7 — archived 라우팅 판정 단일화 (app 레이어)
// ═════════════════════════════════════════════════════════════
describe('G7: app 레이어 "archived" 리터럴 분기 금지', () => {
  // baseline: 상태값 자체를 다루는 곳만 면제.
  // ※ payment/page.tsx 의 archivedRows(계약 해지숨김)는 식별자라 문자열 스캔에 안 걸림(오탐 제외목록).
  //
  // **R4 W1-2 에서 `app/page.tsx`·`app/(app)/layout.tsx` 를 면제에서 뺐다** — 두 파일의
  // archived 분기를 실제로 제거(shouldRedirectToClaim 로 통합)했으므로, 면제로 남겨두면
  // 같은 하드코딩이 다시 들어와도 가드가 잡지 못한다(적대리뷰 지적: 유령 baseline).
  const BASELINE = new Set([
    "app/api/admin/set-cohort-status/route.ts", // admin 토글 — 상태값 자체를 다루는 곳
  ]);

  it('새 app 파일에서 "archived" 문자열 분기 금지 — 공용 헬퍼 사용', () => {
    const bad: string[] = [];
    for (const file of walk(join(ROOT, "app"))) {
      const r = rel(file);
      if (BASELINE.has(r)) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      if (/["'`]archived["'`]/.test(src)) bad.push(r);
    }
    expect(
      bad,
      `archived 판정을 라우팅에서 직접 하드코딩하지 마세요.\n` +
        `→ 고치는 법: lib/repo/users.ts isNumericCohortArchived / ` +
        `lib/repo/user-priority.ts / lib/auth/identity.ts getWritableUserEmail 을 경유.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// G8 — weekIndexOf 단일 소스 (재구현 금지)
// ═════════════════════════════════════════════════════════════
describe("G8: 주차 계산(weekIndexOf) 단일 소스", () => {
  // 주차식 시그니처: floor(x/7)+1 (앵커 불문) · (dow+2)%7 (금요일 앵커 보조식)
  const WEEK_FORMULA = /(?:\/\s*7\s*\)\s*\+\s*1|\(\s*\w+\s*\+\s*2\s*\)\s*%\s*7)/;

  it("lib/app/components 에서 주차식 재구현 금지 — 정본은 lib/util/week.ts", () => {
    const bad: string[] = [];
    for (const file of appFiles()) {
      const r = rel(file);
      if (r === "lib/util/week.ts") continue;
      const src = stripCommentsAndStrings(readFileSync(file, "utf8"));
      if (WEEK_FORMULA.test(src)) bad.push(r);
    }
    expect(
      bad,
      `주차 계산 재구현 금지 (과거 5중복 사고).\n` +
        `→ 고치는 법: @/util/week 의 weekIndexOf(시작일 앵커·시트 row)/` +
        `friWeekIndexOf(금~목·UI) 를 import 하세요. 앵커 차이는 lib/util/week.ts 헤더 참조.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });

  it("scripts/ 의 사본은 WEEK-INDEX-SSOT-COPY 마커 의무 (.mjs 는 TS import 불가)", () => {
    const bad: string[] = [];
    const walkAll = (dir: string): string[] => {
      const out: string[] = [];
      let names: string[] = [];
      try {
        names = readdirSync(dir);
      } catch {
        return out;
      }
      for (const name of names) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...walkAll(full));
        else if (/\.(mjs|js|ts)$/.test(name)) out.push(full);
      }
      return out;
    };
    for (const file of walkAll(join(ROOT, "scripts"))) {
      const src = readFileSync(file, "utf8");
      const noComment = stripCommentsAndStrings(src);
      if (WEEK_FORMULA.test(noComment) && !src.includes("WEEK-INDEX-SSOT-COPY")) {
        bad.push(rel(file));
      }
    }
    expect(
      bad,
      `scripts 주차식 사본에 마커 없음.\n` +
        `→ 고치는 법: 계산식 위에 "// WEEK-INDEX-SSOT-COPY: lib/util/week.ts …" 주석을 달고 ` +
        `정본과 동기하세요.\n` +
        bad.map((b) => "  • " + b).join("\n"),
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// 계약 자체 검증 — 상수 정본이 기대값에서 벗어나면 즉시 감지
// ═════════════════════════════════════════════════════════════
describe("cohort-dates 계약값", () => {
  it("현행 정책값 고정 (변경은 ADR + belie 결정)", async () => {
    const c = await import("@/config/cohort-dates");
    expect(c.GRADUATION_OFFSET_DAYS).toBe(50);
    expect(c.GRADUATION_OFFSET_DAYS_LEGACY).toBe(57);
    expect(c.ALLOWED_GRAD_OFFSETS).toEqual([50, 57]);
    expect(c.EDIT_WINDOW_DAYS).toBe(69);
    expect(c.MAX_SHEET_WEEK).toBe(10);
    expect(c.STATS_WEEKS).toBe(8);
  });
});
