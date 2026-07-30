/**
 * rejoin-routing 가드 (arena-carryover §1·§2, 2026-06-11) — cohorts 탭 archived
 * 기수의 trainee 행 분류. 트레이너(T)·연습·아레나 행 절대 비적용
 * (적용 시 전 트레이너 차단 사고 — 박제 테스트).
 *
 * **R4 G2 (2026-07-26)**: isNumericCohortArchived 는 이제 **분류·집계 전용**이며
 * 더 이상 /claim 강등을 유발하지 않는다. 강등 판정은 shouldRedirectToClaim 단일
 * 함수(미등록만 true) — 아래 전용 describe 참조. 분류 자체의 규칙은 불변이라
 * 기존 테스트를 그대로 보존한다(트레이너 차단 사고 박제 유지).
 */
import { describe, it, expect } from "vitest";
import { isNumericCohortArchived } from "@/repo/users";
import {
  isArenaCohortLabel,
  hasOwnSheet,
  shouldRedirectToClaim,
  pickPreferredUser,
  pickActiveArenaRow,
  dedupKeepIndex,
  arenaCohortCorrection,
} from "@/repo/user-priority";
import { cohortGroupKey, cohortSortTuple, cohortCategory } from "@/types";
import type { User } from "@/types";

const archived = new Set(["6", "T", "연습", "A1"]); // cohorts 탭에 섞여 있을 수 있는 라벨들

function mkUser(p: Partial<User>): User {
  return {
    email: "u@x.com",
    cohort: "6",
    name: "홍길동",
    spreadsheetId: "sid",
    role: "trainee",
    status: "active",
    ...p,
  } as User;
}

describe("isNumericCohortArchived (rejoin 라우팅 가드)", () => {
  it("trainee + 숫자형('6'/'6기') + archived → true", () => {
    expect(isNumericCohortArchived("trainee", "6", archived)).toBe(true);
    expect(isNumericCohortArchived("trainee", "6기", archived)).toBe(true);
    expect(isNumericCohortArchived("trainee", " 6 ", archived)).toBe(true);
  });

  it("트레이너(T)는 cohorts 에 T archived 가 있어도 절대 비적용", () => {
    expect(isNumericCohortArchived("trainer", "T", archived)).toBe(false);
    expect(isNumericCohortArchived("trainer", "6", archived)).toBe(false); // role 가드
  });

  it("숫자형 아닌 cohort(연습·T·아레나 A1-6)는 비적용", () => {
    expect(isNumericCohortArchived("trainee", "연습", archived)).toBe(false);
    expect(isNumericCohortArchived("trainee", "T", archived)).toBe(false);
    expect(isNumericCohortArchived("trainee", "A1-6", archived)).toBe(false);
    expect(isNumericCohortArchived("trainee", "A1-6기", archived)).toBe(false);
  });

  it("archived 아닌 기수(7)는 false", () => {
    expect(isNumericCohortArchived("trainee", "7", archived)).toBe(false);
  });

  it("admin 비적용", () => {
    expect(isNumericCohortArchived("admin", "6", archived)).toBe(false);
  });
});

describe("isArenaCohortLabel (아레나 라벨 판정)", () => {
  it("A{시즌}-{기수} 형태만 true", () => {
    expect(isArenaCohortLabel("A1-6")).toBe(true);
    expect(isArenaCohortLabel("A1-6기")).toBe(true);
    expect(isArenaCohortLabel("A12-3")).toBe(true);
    expect(isArenaCohortLabel(" A1-6 ")).toBe(true);
  });
  it("숫자/T/연습/잘못된 A 형태는 false", () => {
    expect(isArenaCohortLabel("6")).toBe(false);
    expect(isArenaCohortLabel("6기")).toBe(false);
    expect(isArenaCohortLabel("T")).toBe(false);
    expect(isArenaCohortLabel("A1")).toBe(false); // 시즌-기수 구분 없음
    expect(isArenaCohortLabel("Apple")).toBe(false);
  });
});

describe("pickPreferredUser (다중 행 라우팅 우선순위)", () => {
  it("아레나 재참가자: 옛 6기 active + A1-6 active → A1-6 우선", () => {
    // 행 순서상 옛 기수가 먼저 와도 아레나 행을 골라야 /claim 강등 회피.
    const old6 = mkUser({ cohort: "6", spreadsheetId: "old" });
    const arena = mkUser({ cohort: "A1-6", spreadsheetId: "arena" });
    expect(pickPreferredUser([old6, arena])?.spreadsheetId).toBe("arena");
    expect(pickPreferredUser([arena, old6])?.spreadsheetId).toBe("arena");
  });
  it("아레나 없으면 숫자 active 반환", () => {
    const u = mkUser({ cohort: "8", spreadsheetId: "s8" });
    expect(pickPreferredUser([u])?.spreadsheetId).toBe("s8");
  });
  it("active 없고 archived 만 있으면 archived fallback", () => {
    const arch = mkUser({ cohort: "6", status: "archived", spreadsheetId: "arch" });
    expect(pickPreferredUser([arch])?.spreadsheetId).toBe("arch");
  });
  it("아레나 active 가 archived 보다 우선", () => {
    const arch = mkUser({ cohort: "6", status: "archived", spreadsheetId: "arch" });
    const arena = mkUser({ cohort: "A1-6", spreadsheetId: "arena" });
    expect(pickPreferredUser([arch, arena])?.spreadsheetId).toBe("arena");
  });
  it("빈 배열 → null", () => {
    expect(pickPreferredUser([])).toBeNull();
  });
  it("수강생출신 트레이너: trainer 행 + 아레나 trainee 행 → trainer 우선(P14)", () => {
    const trainer = mkUser({ cohort: "T", role: "trainer", spreadsheetId: "t" });
    const arena = mkUser({ cohort: "A1-2", role: "trainee", spreadsheetId: "a" });
    expect(pickPreferredUser([arena, trainer])?.role).toBe("trainer");
    expect(pickPreferredUser([trainer, arena])?.role).toBe("trainer");
  });
  it("일반 아레나 참가자(trainer 행 없음)는 아레나 우선 — 회귀 없음", () => {
    const arena = mkUser({ cohort: "A1-2", role: "trainee", spreadsheetId: "a" });
    const old = mkUser({ cohort: "2", role: "trainee", spreadsheetId: "o" });
    expect(pickPreferredUser([old, arena])?.spreadsheetId).toBe("a");
  });
});

describe("pickActiveArenaRow (이월·회장 = 아레나 행 직접 해석, §B)", () => {
  it("수강생출신 트레이너: 6기 active + A1-6 active + T trainer → A1-6 아레나 행", () => {
    // 최정한 케이스 — pickPreferredUser 는 trainer 를 잡지만, 이월/회장은 아레나 행.
    const old6 = mkUser({ cohort: "6", role: "trainee", spreadsheetId: "old" });
    const arena = mkUser({ cohort: "A1-6", role: "trainee", spreadsheetId: "arena" });
    const trainer = mkUser({ cohort: "T", role: "trainer", spreadsheetId: "" });
    expect(pickActiveArenaRow([old6, arena, trainer])?.spreadsheetId).toBe("arena");
    // 행 순서 무관.
    expect(pickActiveArenaRow([trainer, old6, arena])?.spreadsheetId).toBe("arena");
  });
  it("아레나 행 없음 → null (이월 대상 아님)", () => {
    const old6 = mkUser({ cohort: "6", spreadsheetId: "old" });
    const trainer = mkUser({ cohort: "T", role: "trainer", spreadsheetId: "" });
    expect(pickActiveArenaRow([old6, trainer])).toBeNull();
  });
  it("아레나 행이 archived 면 제외 (active 만)", () => {
    const arena = mkUser({ cohort: "A1-6", status: "archived", spreadsheetId: "arena" });
    expect(pickActiveArenaRow([arena])).toBeNull();
  });
  it("spreadsheetId 빈 아레나 행은 제외", () => {
    const arena = mkUser({ cohort: "A1-6", spreadsheetId: "" });
    expect(pickActiveArenaRow([arena])).toBeNull();
  });
  it("captain_of 보존 — 회장 해석에 쓰이는 행을 그대로 반환", () => {
    const arena = mkUser({ cohort: "A1-6", spreadsheetId: "arena", captainOf: "A1-6" });
    expect(pickActiveArenaRow([arena])?.captainOf).toBe("A1-6");
  });
});

describe("cohortGroupKey (아레나 그룹 통일)", () => {
  it("아레나/일반 기 제거", () => {
    expect(cohortGroupKey("A1-1", "")).toBe("A1-1");
    expect(cohortGroupKey("A1-1기", "")).toBe("A1-1");
    expect(cohortGroupKey("8기", "")).toBe("8");
  });
  it("captainOf 우선 — 회장이 옛 기수로 저장돼도 아레나 그룹으로 통일", () => {
    expect(cohortGroupKey("3", "A1-3")).toBe("A1-3"); // P2 증상: A1-3 회장 cohort="3"
    expect(cohortGroupKey("3기", "A1-3기")).toBe("A1-3");
  });
  it("빈값 → —", () => {
    expect(cohortGroupKey("", "")).toBe("—");
  });
});

describe("cohortSortTuple (아레나 우선·시즌기수 asc·일반 desc)", () => {
  it("튜플 분류", () => {
    expect(cohortSortTuple("A1-1")).toEqual([0, 1, 1]);
    expect(cohortSortTuple("A1-6")).toEqual([0, 1, 6]);
    expect(cohortSortTuple("8")).toEqual([1, -8, 0]);
    expect(cohortSortTuple("관리")).toEqual([2, 0, 0]);
  });
  it("정렬 결과: 아레나(시즌·기수 asc) → 일반 숫자 desc → 기타", () => {
    const keys = ["8", "관리", "A1-6", "6", "A1-1"];
    const sorted = [...keys].sort((a, b) => {
      const ka = cohortSortTuple(a), kb = cohortSortTuple(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
    expect(sorted).toEqual(["A1-1", "A1-6", "8", "6", "관리"]);
  });
});

describe("dedupKeepIndex (중복 행 유지 대상)", () => {
  it("아레나 active > 옛 숫자 archived — 아레나 유지", () => {
    // 김미란 케이스: row13(6,archived) + row62(A1-6,active) → A1-6 유지
    const rows = [
      { cohort: "6", status: "archived" },
      { cohort: "A1-6", status: "active" },
    ];
    expect(dedupKeepIndex(rows)).toBe(1);
    // 순서 반대여도 아레나 active 유지
    expect(dedupKeepIndex([rows[1]!, rows[0]!])).toBe(0);
  });
  it("동점이면 마지막(최신) 유지", () => {
    const rows = [
      { cohort: "8", status: "active" },
      { cohort: "8", status: "active" },
    ];
    expect(dedupKeepIndex(rows)).toBe(1);
  });
  it("아레나 없으면 active > pending", () => {
    const rows = [
      { cohort: "5", status: "pending" },
      { cohort: "5", status: "active" },
    ];
    expect(dedupKeepIndex(rows)).toBe(1);
  });
});

describe("arenaCohortCorrection (B 숫자→A1-N 교정)", () => {
  it("B 숫자 + I 아레나 → 교정값", () => {
    expect(arenaCohortCorrection("3", "A1-3")).toBe("A1-3");
    expect(arenaCohortCorrection("1", "A1-1기")).toBe("A1-1");
    expect(arenaCohortCorrection("4기", "A1-4")).toBe("A1-4");
  });
  it("이미 일관(B 아레나)·I 숫자·둘다 숫자 → null(교정 불필요)", () => {
    expect(arenaCohortCorrection("A1-3", "A1-3")).toBeNull();
    expect(arenaCohortCorrection("8", "8")).toBeNull();
    expect(arenaCohortCorrection("8", "")).toBeNull();
  });
});

describe("cohortCategory (수강생/아레나/테스트 분류)", () => {
  it("A시즌-0=테스트, A시즌-N=아레나, 숫자=수강생", () => {
    expect(cohortCategory("A1-0")).toBe("테스트");
    expect(cohortCategory("A1-3")).toBe("아레나");
    expect(cohortCategory("A2-0")).toBe("테스트");
    expect(cohortCategory("8")).toBe("수강생");
    expect(cohortCategory("7")).toBe("수강생");
    expect(cohortCategory("—")).toBe("수강생");
  });
});

describe("hasOwnSheet (archived-login-access 2026-07-07 — 보관 등록자 라우팅 통과)", () => {
  it("시트 있는 archived trainee → true (/claim 강등 안 됨, 함진숙 케이스)", () => {
    expect(hasOwnSheet(mkUser({ cohort: "7", status: "archived" }))).toBe(true);
  });
  it("시트 없는 archived trainee → false (여전히 /claim)", () => {
    expect(hasOwnSheet(mkUser({ status: "archived", spreadsheetId: "" }))).toBe(false);
    expect(hasOwnSheet(mkUser({ status: "archived", spreadsheetId: "  " }))).toBe(false);
  });
  it("미등록(null)·트레이너는 false — 기존 라우팅 유지", () => {
    expect(hasOwnSheet(null)).toBe(false);
    expect(hasOwnSheet(undefined)).toBe(false);
    expect(hasOwnSheet(mkUser({ role: "trainer", status: "archived" }))).toBe(false);
  });
  it("cohorts 보관 기수(숫자 archived)여도 시트 있으면 통과 대상", () => {
    // page/layout 은 hasOwnSheet=true 면 isNumericCohortArchived 검사 자체를 건너뜀.
    const u = mkUser({ cohort: "6", status: "active" }); // 6 은 archived Set 에 있음
    expect(isNumericCohortArchived(u.role, u.cohort, archived)).toBe(true); // 분류는 불변
    expect(hasOwnSheet(u)).toBe(true); // 그래도 라우팅은 통과
  });
});

/**
 * R4 G2 (belie 결정 2026-07-26) — archived 라우팅 개정.
 * 이전: 보관이면 /claim 강등 + hasOwnSheet 예외가 면제.
 * 이후: **미등록(시트 없음)만 /claim**, 보관(수료)은 그대로 입장(무제한 CRM).
 * page.tsx·(app)/layout.tsx 두 곳이 이 한 함수만 호출한다(중복 분기 제거).
 */
describe("shouldRedirectToClaim (R4 G2 — /claim 강등 판정 SSOT)", () => {
  it("미등록(null/undefined) → true — /claim 강등의 유일한 사유", () => {
    expect(shouldRedirectToClaim(null)).toBe(true);
    expect(shouldRedirectToClaim(undefined)).toBe(true);
  });

  /**
   * 🚨 회귀 박제 2 (적대리뷰 BLOCKER, 2026-07-28).
   * 초안은 "시트 없는 등록 trainee" 도 /claim 으로 보냈다. 그러나 claimAccount 는 그 행이
   * 보관이 아니면 레지스트리를 건드리지 않고 200 을 반환하고(short-circuit), 클레임 화면은
   * 200 을 받으면 "/" 로 되돌린다 → 홈과 클레임 화면 사이 **영구 루프**(앱 진입 불가).
   * 그래서 **행이 있으면 시트 유무·보관 여부와 무관하게 통과**시킨다.
   */
  it("🚨 시트 없는 등록 trainee → false — 강등하면 claim short-circuit 무한루프", () => {
    expect(shouldRedirectToClaim(mkUser({ spreadsheetId: "" }))).toBe(false);
    expect(shouldRedirectToClaim(mkUser({ spreadsheetId: "   " }))).toBe(false);
    // 보관 + 시트 없음도 통과 — 재참가는 /claim 을 직접 열어 이용(강제 이동만 없음).
    expect(shouldRedirectToClaim(mkUser({ spreadsheetId: "", status: "archived" }))).toBe(false);
  });

  it("수료(행 status=archived)+시트 보유 → false — 계속 입장(G2 목표 상태)", () => {
    // 주: master 도 hasOwnSheet 예외로 이미 통과시켰다(archived-login-access).
    // 이 테스트는 "전환"이 아니라 **G2 목표 상태의 박제** — 이후 리팩터가 되돌리면 실패한다.
    expect(shouldRedirectToClaim(mkUser({ cohort: "7", status: "archived" }))).toBe(false);
  });

  it("보관 기수(cohorts archived '6')+시트 보유 → false, 단 분류는 true 유지", () => {
    const u = mkUser({ cohort: "6", status: "active" }); // "6" 은 archived Set 에 있음
    // 분류(집계·표시용)는 그대로 true 지만, 라우팅은 더 이상 강등하지 않는다.
    expect(isNumericCohortArchived(u.role, u.cohort, archived)).toBe(true);
    expect(shouldRedirectToClaim(u)).toBe(false);
  });

  it("현행 수강생(active+시트) → false — 회귀 없음", () => {
    expect(shouldRedirectToClaim(mkUser({ cohort: "9" }))).toBe(false);
    expect(shouldRedirectToClaim(mkUser({ cohort: "A1-6" }))).toBe(false);
    expect(shouldRedirectToClaim(mkUser({ cohort: "연습" }))).toBe(false);
  });

  /**
   * 🚨 회귀 박제 (적대리뷰 2026-07-26 이 잡은 결함).
   * 초안은 `!hasOwnSheet(u)` 를 그대로 반환했다 → hasOwnSheet 가 role==="trainee" 를
   * 요구하므로 **모든 트레이너가 항상 true(=/claim)** 가 됐고, layout 에서 트레이너
   * 분기보다 먼저 호출돼 /claim ↔ / 무한루프(2026-07-07 트레이너 차단 사고 재발).
   * 그래서 이 함수는 trainee 가 아니면 강등하지 않는다.
   */
  it("🚨 트레이너(시트 없음)는 false — 강등 금지(무한루프 재발 방지)", () => {
    expect(shouldRedirectToClaim(mkUser({ role: "trainer", spreadsheetId: "" }))).toBe(false);
    expect(shouldRedirectToClaim(mkUser({ role: "trainer", spreadsheetId: "", status: "pending" }))).toBe(false);
    // 수강생출신 트레이너(T 행 + 아레나 행) — pickPreferredUser 가 trainer 행을 먼저 준다.
    expect(shouldRedirectToClaim(mkUser({ role: "trainer", cohort: "T", spreadsheetId: "" }))).toBe(false);
  });

  it("🚨 admin 행(시트 없음)도 false — 강등 금지", () => {
    // ADMIN_EMAILS env 에 없는 admin 행이 layout 가드 안쪽으로 들어오는 경우.
    expect(shouldRedirectToClaim(mkUser({ role: "admin", spreadsheetId: "" }))).toBe(false);
  });

  it("강등은 hasOwnSheet 와 무관 — 시트가 없어도 등록 행이면 통과(루프 방지 계약)", () => {
    // BLOCKER 수정 후: 판정 기준은 "행 존재" 하나뿐. hasOwnSheet 는 라우팅 계약에서 빠졌다
    // (여전히 아레나·표시 로직에서 쓰이므로 함수 자체는 유지).
    const sheetless = [
      mkUser({ spreadsheetId: "" }),
      mkUser({ spreadsheetId: "", status: "archived" }),
      mkUser({ role: "trainer", spreadsheetId: "" }),
    ];
    for (const c of sheetless) {
      expect(hasOwnSheet(c)).toBe(false); // 시트는 없다
      expect(shouldRedirectToClaim(c)).toBe(false); // 그래도 강등하지 않는다
    }
    // 강등되는 유일한 경우 = 행 자체가 없음.
    expect(shouldRedirectToClaim(null)).toBe(true);
  });

  it("보관+시트 보유자는 재참가를 원하면 /claim 을 직접 열 수 있다(강제 이동만 제거)", () => {
    // 라우팅은 통과시키되 클레임 기능 자체는 유지(claimAccount 는 archived 를
    // short-circuit 하지 않고 신규 기수 합류 진행 — lib/service/auth.ts rejoin §2).
    const graduate = mkUser({ cohort: "7", status: "archived" });
    expect(shouldRedirectToClaim(graduate)).toBe(false); // 강제 이동 없음
    expect(hasOwnSheet(graduate)).toBe(true); // 본인 시트로 계속 이용
  });
});
