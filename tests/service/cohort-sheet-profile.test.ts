/**
 * 기수 생성 시 시트 B3:C3(기수·이름) 도장 — 회귀 가드.
 *
 * ## 무슨 사고였나 (2026-09-04)
 * 11기 7명이 「11 + 이름」으로 제대로 클레임했는데 앱에서 **8기로 보였다**.
 * 레지스트리 B열 cohort 는 11 로 정확히 들어가 있었다. 틀린 건 **시트 `01 영업관리` B3 = 8**.
 * B3 가 기수의 **정본**(sheet-structure.md §6 — registry B 열은 deprecated)이라 화면이 8기를 따랐다.
 *
 * ## 왜 8이 남았나 — 두 구멍이 겹쳤다
 * ① `create-cohort-members` 가 템플릿을 복제하면서 **O1/O2(날짜)만** 쓰고 B3/C3 를 안 썼다.
 *    템플릿은 8기 사본이라 B3 에 8 이 딸려온다(같은 파일의 날짜 주석이 이미 그렇게 적고 있다).
 * ② 클레임 경로는 사전등록 행에 spreadsheetId 가 이미 있으면 `writeProfile` 을 **건너뛴다**
 *    (`lib/service/auth.ts` — `if (!existingSheetId && !resolved.redirected)`).
 * 그래서 아무도 B3 를 고치지 않았다.
 *
 * 아레나 라우트는 **이미** 이 처리를 하고 있었다(create-arena-members). 숫자 기수만 빠져 있었다.
 * 이 테스트는 그 비대칭이 다시 생기지 않게 양쪽을 함께 못 박는다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const COHORT_ROUTE = "app/api/admin/create-cohort-members/route.ts";
const ARENA_ROUTE = "app/api/admin/create-arena-members/route.ts";
const AUTH = "lib/service/auth.ts";

const cohortSrc = readFileSync(COHORT_ROUTE, "utf8");
const arenaSrc = readFileSync(ARENA_ROUTE, "utf8");
const authSrc = readFileSync(AUTH, "utf8");

describe("★새 시트에 기수·이름을 찍는다", () => {
  it("★숫자 기수 생성 경로가 writeProfile 로 B3:C3 를 찍는다", () => {
    expect(cohortSrc).toContain('from "@/repo/sales"');
    expect(cohortSrc).toMatch(/writeProfile\(\s*newSheetId\s*,\s*parsed\.label\s*,\s*name\s*\)/);
  });

  it("★아레나 경로도 여전히 찍는다 — 한쪽만 고쳐 비대칭이 되지 않게", () => {
    expect(arenaSrc).toMatch(/writeProfile\(/);
  });

  it("아레나는 숫자 기수 경로에서 찍지 않는다 — 라벨 모양이 다르다(A2 vs A2-6기)", () => {
    expect(cohortSrc).toContain('parsed.type === "cohort"');
  });

  it("복제(create) 때만 찍는다 — 남의 기존 시트(link)는 안 건드린다", () => {
    const at = cohortSrc.indexOf("writeProfile(newSheetId");
    expect(at).toBeGreaterThan(-1);
    const createGuard = cohortSrc.lastIndexOf('plan.action === "create"', at);
    expect(createGuard).toBeGreaterThan(-1);
  });

  it("기록 실패가 기수 생성을 막지 않는다 — 날짜와 같은 방침", () => {
    const at = cohortSrc.indexOf("writeProfile(newSheetId");
    const around = cohortSrc.slice(Math.max(0, at - 400), at + 400);
    expect(around).toMatch(/try\s*\{/);
    expect(around).toMatch(/catch/);
  });
});

describe("클레임 경로는 이걸 못 고친다 (사고 원인 박제)", () => {
  it("★사전등록 행에 시트가 이미 있으면 writeProfile 을 건너뛴다", () => {
    // 이 조건이 있는 한 「생성 시점에 찍기」가 유일한 방어선이다. 조건이 사라지면
    // 이 테스트가 깨지고, 그때 위 가드가 아직 필요한지 다시 판단하게 된다.
    expect(authSrc).toContain("if (!existingSheetId && !resolved.redirected)");
  });
});

describe("B3 가 정본이라는 전제", () => {
  it("registry B 열은 deprecated 로 문서에 박혀 있다", () => {
    const users = readFileSync("lib/repo/users.ts", "utf8");
    expect(users).toContain("B cohort(deprecated, 시트 B3 SSOT)");
  });
});
