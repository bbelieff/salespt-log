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
import { readProfileBundle } from "@/repo/sales";

/**
 * 종강총회 offset (7기+ 현행 모델): O2 = O1 + 50. ADR-0005 참조.
 * production loadMe() 는 시트 O2 를 직접 읽으므로 이 상수를 쓰지 않음 —
 * fixture 테스트(computeGraduationISO) 검증용으로만 유지.
 * 6기 이하 legacy 는 O1+57 이지만 그 시트들은 O2 직접값이 진실이라 상수화 안 함.
 */
export const GRADUATION_OFFSET_DAYS = 50;

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
}

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
  ["me-bundle-v2"], // v2: stats 필드 포함 (이전 캐시 entries 와 schema 다름)
  // 2026-05-16: TTL 600s → 1800s (30분) — quota 압박 완화.
  // PR #198 stats 도입 후 페이지 진입 시 모든 trainee 시트 fetch 필요 →
  // 콜드 캐시 60명 burst 가 Sheets API 60 reads/min/SA 한도 근접 위험.
  // TTL 늘려 cold-start 빈도 1시간당 2회 → 1회로 감소. 동시성 제한(pMapBundle)
  // 과 함께 quota 안전. trade-off: 시트 직접 수정 시 최대 30분 지연 (admin 액션
  // 후엔 invalidateTag("me-bundle") 호출하면 즉시 갱신).
  { revalidate: 1800, tags: ["me-bundle"] },
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
        cohort: bundle.cohort || u.cohort,
        name: bundle.name || u.name,
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
        cohort: u.cohortLabel ?? u.cohort,
        name: u.nameLabel ?? u.name,
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
        cohort: bundle.cohort || u.cohort,
        name: bundle.name || u.name,
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
 * enrichUsersWithDates 의 보조 — 각 사용자 시트의 8주 funnel 누적 (E4:E6) 을
 * 가져와 `stats` 필드를 추가. admin/trainer 페이지 수강생 카드 표시용.
 *
 * `readBundle` 공유 → enrichUsersWithDates 가 이미 sheet read 했으면 cache hit
 * (별도 API 호출 0회). registry cache fast-path 로 dates 만 채운 trainee 는
 * 여기서 처음 sheet fetch.
 *
 * spreadsheetId 없음 / fetch 실패 → stats 미설정 (undefined). 컴포넌트는 optional.
 */
export interface TraineeFunnelStats {
  미팅예정: number;
  미팅완료: number;
  계약: number;
}

export async function enrichUsersWithStats<T extends { spreadsheetId: string }>(
  users: T[],
): Promise<Array<T & { stats?: TraineeFunnelStats }>> {
  // pMapBundle (concurrency 5) — 콜드 캐시 시 60명 burst → 12 waves × 5 동시.
  // Sheets API 60 reads/min/SA 한도 안전 범위 (PR #198 stats 추가 후 critical).
  return pMapBundle(users, async (u) => {
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
}

export async function loadMe(email: string): Promise<MeProfile> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[me] 사용자(${email})를 찾을 수 없습니다.`);
  }
  // 단일 batchGet (B3:C3 + O1 + O2) + 60s 메모이즈.
  const bundle = await readBundle(user.spreadsheetId);
  return {
    email: user.email,
    cohort: bundle.cohort || user.cohort,
    name: bundle.name || user.name,
    courseStartISO: toISO(bundle.courseStart),
    graduationISO: toISO(bundle.graduation),
    spreadsheetId: user.spreadsheetId,
  };
}
