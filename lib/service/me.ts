/**
 * Layer: service — 사용자 프로필 + 수강 일정 (헤더 표시용).
 *
 * SSOT:
 *  - 마스터 레지스트리 users 탭 → email/spreadsheetId 매핑.
 *  - 사용자 개인 시트 01 영업관리!B3:C3 → 기수/이름 (표시값 SSOT).
 *  - 사용자 개인 시트 01 영업관리!O1 → 수강시작일 (1주차 시작, 금요일).
 *  - **사용자 개인 시트 01 영업관리!O2 → 종강총회일 (= 수료일, 토요일)**
 *    시트는 보통 `=O1+57` 수식이거나 직접 입력. 코드는 그대로 읽기만.
 *
 * 사용처:
 *  - TopHeader 컴포넌트 — 모든 탭 상단 "{기수} {이름} 대표님" 표시
 *  - DDayBadge — 종강총회일(O2)까지 남은 일수 카운트다운 (D-N = O2 − today)
 */
import { unstable_cache } from "next/cache";
import { findUserByEmail } from "@/repo/users";
import { readProfileBundle } from "@/repo/sales";

/**
 * 참고 상수: 시트 O2가 보통 `=O1+57` 수식인 경우의 offset.
 * 코드는 O2를 직접 읽으므로 이 값을 사용하지 않지만, fixture 테스트에서 검증용으로 유지.
 */
export const GRADUATION_OFFSET_DAYS = 57;

export interface MeProfile {
  email: string;
  cohort: string; // 예: "6기" (시트 B3, formatCohort 정규화)
  name: string; // 예: "김믿음" (시트 C3)
  /** 수강시작일 (YYYY-MM-DD) — O1 셀. 1주차 시작 (금요일). */
  courseStartISO: string;
  /** 종강총회일 = 수료일 (YYYY-MM-DD) — **O2 직접 읽기** (시트 수식 또는 직접 입력). */
  graduationISO: string;
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
    };
  },
  ["me-bundle"],
  { revalidate: 600, tags: ["me-bundle"] },
);

/** cachedReadBundle 결과를 Date 포함 형태로 복원. */
async function readBundle(spreadsheetId: string): Promise<{
  cohort: string;
  name: string;
  courseStart: Date;
  graduation: Date;
}> {
  const b = await cachedReadBundle(spreadsheetId);
  return {
    cohort: b.cohort,
    name: b.name,
    courseStart: new Date(b.courseStartMs),
    graduation: new Date(b.graduationMs),
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
  const tasks = users.map(async (u) => {
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
  return Promise.all(tasks);
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
  const tasks = users.map(async (u) => {
    const defaults = { ...u, courseStartISO: "", graduationISO: "" };
    const who = ("email" in u ? (u as { email: string }).email : "?");

    // PR B-1: registry cached 컬럼 (cohortLabel/nameLabel/courseStartISO/graduationISO)
    // 4개 모두 채워져 있으면 시트 fetch 0회 — 평시 목표.
    // 하나라도 빈 값이면 시트 fetch fallback (점진 마이그레이션).
    const cachedComplete =
      (u.cohortLabel ?? "").trim() !== "" &&
      (u.nameLabel ?? "").trim() !== "" &&
      (u.courseStartISO ?? "").trim() !== "" &&
      (u.graduationISO ?? "").trim() !== "";
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
  return Promise.all(tasks);
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
  };
}
