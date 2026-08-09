/**
 * Layer: service — 사용자 프로필 + 수강 일정 (헤더 표시용).
 *
 * SSOT:
 *  - 마스터 레지스트리 users 탭 → email/spreadsheetId 매핑.
 *  - 사용자 개인 시트 01 영업관리!B3:C3 → 기수/이름 (표시값 SSOT).
 *  - 사용자 개인 시트 01 영업관리!O1 → 수강시작일 (1주차 시작, 금요일).
 *  - **사용자 개인 시트 01 영업관리!O2 → 종강총회일 (= 수료일, 토요일)**
 *    7기+: O2 = `=O1+50`. 6기 legacy: `=O1+57` (ADR-0005). 코드는 그대로 읽기만.
 *
 * 사용처:
 *  - TopHeader 컴포넌트 — 모든 탭 상단 "{기수} {이름} 대표님" 표시
 *  - DDayBadge — 종강총회일(O2)까지 남은 일수 카운트다운 (D-N = O2 − today)
 */
import { unstable_cache } from "next/cache";
import { findUserByEmail } from "@/repo/users";
import {
  findActiveArenaRowByEmail,
  findArchivedRowByEmail,
  resolveOwnArenaSheetId,
} from "@/repo/users-arena";
import { readProfileBundle } from "@/repo/sales";
import { isDbReadPilot } from "@/service/daily-source";
import { dbEnabled } from "@/repo/db/client";
import { profileStatsFromDb } from "./profile-stats-db";

/**
 * 종강총회 offset (7기+ 현행 모델): O2 = O1 + 50. ADR-0005 참조.
 * production loadMe() 는 시트 O2 를 직접 읽으므로 이 상수를 쓰지 않음 —
 * fixture 테스트(computeGraduationISO) 검증용으로만 유지.
 * 정본은 @/config/cohort-dates (R4 W1-0) — 기존 소비처 위해 재수출.
 */
export { GRADUATION_OFFSET_DAYS } from "@/config/cohort-dates";
import { GRADUATION_OFFSET_DAYS } from "@/config/cohort-dates";

export interface MeProfile {
  email: string;
  cohort: string; // 예: "6기" (시트 B3, formatCohort 정규화)
  name: string; // 예: "김믿음" (시트 C3)
  /** 수강시작일 (YYYY-MM-DD) — O1 셀. 1주차 시작 (금요일). */
  courseStartISO: string;
  /** 종강총회일 = 수료일 (YYYY-MM-DD) — **O2 직접 읽기** (시트 수식 또는 직접 입력). */
  graduationISO: string;
  /** 사용자 개인 시트 ID — TopHeader 의 이름 → 구글 시트 링크용. 미등록(admin) 시 "". */
  spreadsheetId: string;
  /** 01 피드백업체 폴더 ID (registry O). 빈값 = 미연결. */
  feedbackFolderId?: string;
  /** Drive 연결 상태: "ok" / "" / "error" (registry P). */
  driveLinkStatus?: string;
  /** 아레나 회장이 맡은 cohort (registry R, 정규화). 빈값=일반. "기수임원" 진입점 노출용. */
  captainOf?: string;
  /** 이전 기수(archived) 일지 — "이전 N기 일지 보기(읽기전용)" 링크 (carryover §1). */
  archivedCohort?: string;
  archivedSpreadsheetId?: string;
  /** 수강생출신 트레이너의 본인 아레나 시트 ID — "내 아레나 일지" 토글 노출용(P14).
   *  trainer 행 + 이름 일치 아레나 trainee 행 있을 때만. 빈값=일반 트레이너. */
  ownArenaSheetId?: string;
}

/** 레지스트리 cohort 가 아레나(A시즌-...)면 표시 cohort 를 시트 B3/캐시로 덮지 않는다
 * (아레나는 레지스트리 A1-N 이 SSOT — 시트 B3 에 옛 기수 "4"/"3" 잔존 시 오분류 방지,
 * arena-cohort-display). 날짜는 시트값 유지, 기수·부부명은 보호. */
const isArenaReg = (c: string) => /^A\d+-/.test(String(c ?? "").trim());

/** 부부 괄호명("정유영(조성도)") — 시트 C3 단일명으로 덮으면 동반자명이 잘리므로 보호.
 * 아레나 행이거나 괄호 부부명이면 레지스트리 name 유지. */
const isCoupleName = (n: string) => String(n ?? "").includes("(");

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  return next;
}

/**
 * 테스트용 export — 시트 O2가 `=O1+57` 가정에서 graduation 계산.
 * 실제 loadMe()는 O2를 직접 읽으므로 이 함수를 사용하지 않음.
 */
export function computeGraduationISO(courseStartISO: string): string {
  const [y, m, d] = courseStartISO.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const start = new Date(y, m - 1, d);
  return toISO(addDays(start, GRADUATION_OFFSET_DAYS));
}

/**
 * spreadsheetId → bundle(profile + dates) 캐시 — 10분 (600초).
 * 시트 B3/C3/O1/O2 변경은 매우 드물고(수강 시작 시 1회) 페이지 전환 시 매번
 * 다시 읽으면 헤더 표시 지연 주범 + Sheets API quota (60 reads/min/user) 압박.
 *
 * **2026-05-13 quota 사고**: /admin/users 진입 시 23 trainee 시트 read.
 * cache 60s + admin 새로고침 빈번 + PM2 restart 시 cache 비움 → 분당 60 read
 * 한도 초과 → 500 "Quota exceeded for Read requests per minute per user".
 * 캐시 시간 60s → 600s 로 늘려 quota 압박 1/10 감소.
 * trade-off: 시트 B3/C3/O1/O2 직접 수정 시 최대 10분 지연 반영. admin prep 후
 * 거의 변경 안 되는 데이터라 실용상 무관. 즉시 반영 필요한 화면은 명시적
 * `revalidateTag("me-bundle")` 호출 가능.
 *
 * **2026-05-13 사고 fix (앞)**: unstable_cache 가 결과를 JSON 직렬화 → Date 객체가
 * ISO string 으로 복원됨 → cache hit 시 `bundle.courseStart` 가 string →
 * 호출자(`toISO`)가 `string.getFullYear()` 호출 → "a.getFullYear is not a
 * function" 500 에러. cache 내부에서 number(ms) 만 저장하고 호출 부에서 Date 로
 * 복원. JSON 직렬화 안전한 primitive 만 캐시.
 */
const cachedReadBundle = unstable_cache(
  async (spreadsheetId: string) => {
    const b = await readProfileBundle(spreadsheetId);
    return {
      cohort: b.cohort,
      name: b.name,
      courseStartMs: b.courseStart.getTime(),
      graduationMs: b.graduation.getTime(),
      // 2026-05-16: stats(E4:E6) 추가 — admin/trainer 카드의 "예정·완료·계약" 표시용.
      stats: b.stats,
    };
  },
  ["me-bundle-v3"], // v3: stats 를 E4:E6 → E~N 데이터 컬럼 합산으로 변경 (전원 0 사고 fix)
  // 2026-05-19: TTL 1800s(30분) → 600s(10분). 수강생관리 카드 합계(E4:E6 미팅
  // 누적)가 최대 30분 늦게 반영돼 "연동 안 됨" 처럼 보이던 사용자 보고. 10분으로
  // 단축. 콜드스타트 quota burst 는 PR #244/#245 의 429 retry(backoff) + pMapBundle
  // 동시성 제한으로 흡수. 즉시 반영 필요 시 invalidateTag("me-bundle").
  { revalidate: 600, tags: ["me-bundle"] },
);

/**
 * 시트 시퀀스 fetch 동시성 제한 (2026-05-16) — Sheets API quota 60 reads/min/SA
 * 한도 보호. concurrency 5 → 60명 cold-start 시 ~12 waves × 5 동시 = 부드러운 rate.
 * Promise.all 60 동시 burst 는 한도 즉시 hit → 503 retry 폭주 사고 가능.
 *
 * 결과 순서는 입력 순서 보존 (results[i] 배열 위치).
 */
async function pMapBundle<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );
  return results;
}

/** cachedReadBundle 결과를 Date 포함 형태로 복원. */
async function readBundle(spreadsheetId: string): Promise<{
  cohort: string;
  name: string;
  courseStart: Date;
  graduation: Date;
  stats: { 미팅예정: number; 미팅완료: number; 계약: number };
}> {
  const b = await cachedReadBundle(spreadsheetId);
  return {
    cohort: b.cohort,
    name: b.name,
    courseStart: new Date(b.courseStartMs),
    graduation: new Date(b.graduationMs),
    // 옛 캐시 entries 호환 — stats 없으면 0 으로 fallback.
    stats: b.stats ?? { 미팅예정: 0, 미팅완료: 0, 계약: 0 },
  };
}

/**
 * 사용자 목록을 받아 각자의 개인 시트 B3/C3 에서 cohort/name 을 읽어 덮어쓴다.
 *
 * 이유: 마스터 레지스트리(users 탭)의 cohort 컬럼은 self-claim 또는 admin
 * 수동 입력으로 채워져 종종 표기 불일치(예: "PRM5" vs "5", "6기" vs "6")가 생긴다.
 * **개인 시트 B3 가 SSOT** — 표시 라벨은 시트 값을 따른다.
 *
 * 동작:
 *   - spreadsheetId 없는 row (trainer with cohort="T", admin) → 그대로 통과.
 *   - 시트 읽기 실패 (권한/삭제) → registry 값 유지, 에러 로그.
 *   - 시트 B3 가 빈 문자열 → registry 값 fallback.
 *
 * 비용: 사용자 N 명 × cachedReadBundle(60s 캐시) = 첫 호출만 N roundtrip,
 * 이후 60초 동안 0 roundtrip. 병렬 호출.
 */
export async function enrichUsersWithSheetCohort<T extends { cohort: string; name: string; spreadsheetId: string }>(
  users: T[],
): Promise<T[]> {
  // pMapBundle (concurrency 5) — 60명 cold-start 시에도 Sheets quota burst 방지.
  return pMapBundle(users, async (u) => {
    if (!u.spreadsheetId) return u;
    try {
      const bundle = await readBundle(u.spreadsheetId);
      return {
        ...u,
        cohort: isArenaReg(u.cohort) ? u.cohort : bundle.cohort || u.cohort,
        name:
          isArenaReg(u.cohort) || isCoupleName(u.name)
            ? u.name
            : bundle.name || u.name,
      };
    } catch (e) {
      // 시트 접근 실패 — registry 값 그대로 사용.
      console.warn(
        `[me] enrich 실패 (spreadsheetId=${u.spreadsheetId}, email=${("email" in u ? (u as { email: string }).email : "?")}):`,
        e instanceof Error ? e.message : e,
      );
      return u;
    }
  });
}

/**
 * enrichUsersWithSheetCohort 의 확장 — cohort/name 외 시작일/종강일(O1/O2)
 * 까지 채움. 수강생관리 화면(/admin/users)이 한 줄 카드에 모든 정보를 표시할 때
 * 사용. 동일하게 cachedReadBundle 재활용 (별도 API 호출 없음).
 */
export interface EnrichedUserWithDates {
  cohort: string;
  name: string;
  spreadsheetId: string;
  courseStartISO: string;
  graduationISO: string;
}

export async function enrichUsersWithDates<
  T extends {
    cohort: string;
    name: string;
    spreadsheetId: string;
    cohortLabel?: string;
    nameLabel?: string;
    courseStartISO?: string;
    graduationISO?: string;
  },
>(users: T[]): Promise<Array<T & { courseStartISO: string; graduationISO: string }>> {
  // pMapBundle (concurrency 5) — Sheets quota 보호 (PR #198 stats 추가 이후 더 중요).
  return pMapBundle(users, async (u) => {
    const defaults = { ...u, courseStartISO: "", graduationISO: "" };
    const who = ("email" in u ? (u as { email: string }).email : "?");

    // PR B-1: registry cached 컬럼 (cohortLabel/nameLabel/courseStartISO/graduationISO)
    // 4개 모두 채워져 있으면 시트 fetch 0회 — 평시 목표.
    // 하나라도 빈 값이거나 K/L 이 ISO 형식이 아니면 fallback (점진 마이그레이션).
    // PR D (2026-05-14): K/L 이 "46122" 같은 시리얼 number 문자열이면 cached 인정 X
    // → 시트 fetch fallback. admin 이 [🔄 동기화] 누르면 정상 ISO 로 backfill.
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    const cachedComplete =
      (u.cohortLabel ?? "").trim() !== "" &&
      (u.nameLabel ?? "").trim() !== "" &&
      ISO_DATE.test((u.courseStartISO ?? "").trim()) &&
      ISO_DATE.test((u.graduationISO ?? "").trim());
    if (cachedComplete) {
      return {
        ...u,
        cohort: isArenaReg(u.cohort) ? u.cohort : u.cohortLabel ?? u.cohort,
        name:
          isArenaReg(u.cohort) || isCoupleName(u.name)
            ? u.name
            : u.nameLabel ?? u.name,
        courseStartISO: u.courseStartISO ?? "",
        graduationISO: u.graduationISO ?? "",
      };
    }

    if (!u.spreadsheetId) {
      console.warn(
        `[me] enrichUsersWithDates skip — spreadsheetId 없음 (email=${who}, cohort=${u.cohort})`,
      );
      return defaults;
    }
    try {
      const bundle = await readBundle(u.spreadsheetId);
      return {
        ...u,
        cohort: isArenaReg(u.cohort) ? u.cohort : bundle.cohort || u.cohort,
        name:
          isArenaReg(u.cohort) || isCoupleName(u.name)
            ? u.name
            : bundle.name || u.name,
        courseStartISO: toISO(bundle.courseStart),
        graduationISO: toISO(bundle.graduation),
      };
    } catch (e) {
      console.warn(
        `[me] enrichUsersWithDates 실패 (email=${who}, sheet=${u.spreadsheetId}, cohort=${u.cohort}):`,
        e instanceof Error ? e.message : e,
      );
      return defaults;
    }
  });
}

/**
 * enrichUsersWithDates 의 보조 — 각 사용자의 8주 funnel 누적을 가져와 `stats` 필드를
 * 추가. admin/trainer/captain 화면 수강생 카드 표시용 (BBE-64).
 *
 * **파일럿 기수는 DB 배치 조회**(시트 batchGet 0회), **비파일럿은 기존 시트 경로 완전
 * 불변**(`readBundle` 그대로 — R2/R3 전 트랙 공통 불변식). 리스트가 파일럿·비파일럿을
 * 섞어 받으므로 먼저 분리한 뒤, 파일럿은 배치 DB 1회, 비파일럿은 기존 `pMapBundle`+
 * `readBundle` 로 처리하고 **원래 입력 순서를 보존**해 합친다.
 *
 * 파일럿 판정에 `courseStartISO`(ISO 형식)가 필요하다 — 호출부 3곳(admin/users·
 * trainer·captain) 은 전부 `enrichUsersWithDates` 를 먼저 호출해 이 필드를 채운
 * 뒤 결과를 그대로 넘기므로 항상 충족된다. 없거나 형식이 어긋나면(예: 이 함수를
 * dates 없이 단독 호출하는 새 호출부) 안전하게 시트 경로로 떨어진다(최적화만 놓침,
 * 정합은 그대로).
 *
 * DB 배치 실패 시 **그 파일럿 배치 전체**를 시트 경로로 폴백(개별 재시도 없음 —
 * loadDashboard 의 all-or-nothing 폴백과 동일 결 — 부분 재시도는 검증되지 않은 새
 * 영역이라 이 PR 범위 밖).
 *
 * spreadsheetId 없음 / 조회 실패 → stats 미설정 (undefined). 컴포넌트는 optional.
 */
export interface TraineeFunnelStats {
  미팅예정: number;
  미팅완료: number;
  계약: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → 로컬 자정 Date. profile-stats-db.ts/dashboard-aggregates.ts 와 동일 규칙. */
function parseISOLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export async function enrichUsersWithStats<
  T extends { spreadsheetId: string; cohort: string; courseStartISO?: string },
>(users: T[]): Promise<Array<T & { stats?: TraineeFunnelStats }>> {
  const dbOn = dbEnabled();
  const pilot: T[] = [];
  const sheetPath: T[] = [];
  for (const u of users) {
    const pilotEligible =
      u.spreadsheetId &&
      dbOn &&
      isDbReadPilot(u.cohort) &&
      ISO_DATE_RE.test((u.courseStartISO ?? "").trim());
    if (pilotEligible) pilot.push(u);
    else sheetPath.push(u);
  }

  // index 로 병합 — spreadsheetId 로 Map 을 키 잡지 않는다. 부부/멀티계정은 시트를 공유해
  // 같은 spreadsheetId 를 쓰므로(users-claim.ts) 문자열 키 Map 은 한쪽 결과가 다른 쪽을
  // 덮어써 잘못된 통계를 보여줄 수 있다(적대적 리뷰 2026-08-06 확인, tests/service/me.test.ts
  // "부부/멀티계정 spreadsheetId 공유" 테스트로 고정).
  let dbStats: TraineeFunnelStats[] = [];
  if (pilot.length > 0) {
    try {
      dbStats = await profileStatsFromDb(
        pilot.map((u) => ({
          spreadsheetId: u.spreadsheetId,
          courseStart: parseISOLocal(u.courseStartISO!.trim()),
        })),
      );
    } catch (e) {
      console.warn(
        `[me] profileStatsFromDb 배치 실패(${pilot.length}명) — 전원 sheet 경로로 폴백:`,
        e instanceof Error ? e.message : e,
      );
      sheetPath.push(...pilot);
      pilot.length = 0;
    }
  }

  // pMapBundle (concurrency 5) — 콜드 캐시 시 60명 burst → 12 waves × 5 동시.
  // Sheets API 60 reads/min/SA 한도 안전 범위. 이제 비파일럿 subset 만 지난다.
  const sheetResults = await pMapBundle(sheetPath, async (u) => {
    if (!u.spreadsheetId) return u;
    const who = "email" in u ? (u as { email: string }).email : "?";
    try {
      const bundle = await readBundle(u.spreadsheetId);
      return { ...u, stats: bundle.stats };
    } catch (e) {
      console.warn(
        `[me] enrichUsersWithStats 실패 (email=${who}, sheet=${u.spreadsheetId}):`,
        e instanceof Error ? e.message : e,
      );
      return u;
    }
  });

  // 원래 입력 순서 보존 — 객체 identity 기반(spreadsheetId 는 트레이너/admin 행에서 ""로,
  // 부부/멀티계정 행에서 공유 값으로 중복될 수 있어 문자열 키 Map 은 둘 다 충돌 위험).
  const pilotResultByRef = new Map(pilot.map((u, i) => [u, { ...u, stats: dbStats[i] }]));
  const sheetResultByRef = new Map(sheetPath.map((u, i) => [u, sheetResults[i]!]));
  return users.map((u) => pilotResultByRef.get(u) ?? sheetResultByRef.get(u) ?? u);
}

/**
 * @param arenaSelf "내 아레나 일지" 보기 여부 — 라우트가 쿠키(isArenaSelfView)를 읽어
 *   주입(service 는 next/headers·next-auth 의존 X, dashboard override 패턴과 동일).
 */
export async function loadMe(
  email: string,
  arenaSelf = false,
): Promise<MeProfile> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[me] 사용자(${email})를 찾을 수 없습니다.`);
  }
  // 단일 batchGet (B3:C3 + O1 + O2) + 60s 메모이즈.
  // ⚠️ 트레이너/admin 행은 spreadsheetId 가 빈 값 → readBundle("") 가 404 throw →
  //    loadMe throw → /api/me 500 → '내 아레나 일지' 토글 미노출. 빈값/실패 시 null 로 강등.
  let bundle: Awaited<ReturnType<typeof readBundle>> | null = null;
  if (user.spreadsheetId) {
    try {
      bundle = await readBundle(user.spreadsheetId);
    } catch {
      bundle = null;
    }
  }
  // 이전 기수(archived) 일지 링크 — 같은 레지스트리 캐시 read 라 비용 미미 (carryover §1).
  let archived: { cohort: string; spreadsheetId: string } | null = null;
  try {
    archived = await findArchivedRowByEmail(email);
  } catch {
    archived = null;
  }
  // 수강생출신 트레이너 — 본인 아레나 시트 "내 아레나 일지" 토글용(P14).
  // 본인 이메일의 활성 아레나 행 우선(중복/동명이인 안전), 없으면 이름 매칭 폴백.
  let ownArenaSheetId: string | undefined;
  if (user.role === "trainer") {
    try {
      // dashboard resolveArenaOverride 와 동일 resolver(divergence 방지).
      ownArenaSheetId =
        (await resolveOwnArenaSheetId(email, user.name)) ?? undefined;
    } catch {
      ownArenaSheetId = undefined;
    }
  }
  // 회장(captain_of)은 아레나 행에 있다. 선호 행(예: 수강생출신 트레이너의 T 행)이
  // captain_of 가 비면 아레나 행에서 surface — 안 그러면 회장 기능이 안 보임(§B).
  let captainOf = user.captainOf;
  if (!captainOf) {
    try {
      const arenaRow = await findActiveArenaRowByEmail(email);
      captainOf = arenaRow?.captainOf ?? "";
    } catch {
      /* keep "" */
    }
  }
  // 수강생출신 트레이너가 "내 아레나 일지" 보기일 때는 프로필(시작일·종강·주차·기수·이름)을
  // 본인 아레나 시트 기준으로 — trainer 행은 시트가 빈값(bundle=null)이라 헤더가
  // undefined/undefined 시작·NaN주차·₩0 으로 뜨던 버그. dashboard override(P14)와 짝.
  if (arenaSelf && ownArenaSheetId) {
    try {
      bundle = await readBundle(ownArenaSheetId);
    } catch {
      /* 실패 시 기존 bundle 유지 */
    }
  }
  return {
    email: user.email,
    cohort: isArenaReg(user.cohort) ? user.cohort : bundle?.cohort || user.cohort,
    name: bundle?.name || user.name,
    courseStartISO: bundle ? toISO(bundle.courseStart) : "",
    graduationISO: bundle ? toISO(bundle.graduation) : "",
    spreadsheetId: user.spreadsheetId,
    feedbackFolderId: user.feedbackFolderId,
    driveLinkStatus: user.driveLinkStatus,
    captainOf,
    archivedCohort: archived?.cohort,
    archivedSpreadsheetId: archived?.spreadsheetId,
    ownArenaSheetId,
  };
}
