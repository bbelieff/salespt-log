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
 * spreadsheetId → bundle(profile + dates) 캐시 — 60초.
 * 시트 B3/C3/O1/O2 변경은 매우 드물고(수강 시작 시 1회) 페이지 전환 시 매번
 * 다시 읽으면 헤더 표시 지연 주범. 60초 stale 허용.
 */
const cachedReadBundle = unstable_cache(
  async (spreadsheetId: string) => readProfileBundle(spreadsheetId),
  ["me-bundle"],
  { revalidate: 60, tags: ["me-bundle"] },
);

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
      const bundle = await cachedReadBundle(u.spreadsheetId);
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
  T extends { cohort: string; name: string; spreadsheetId: string },
>(users: T[]): Promise<Array<T & { courseStartISO: string; graduationISO: string }>> {
  const tasks = users.map(async (u) => {
    const defaults = { ...u, courseStartISO: "", graduationISO: "" };
    const who = ("email" in u ? (u as { email: string }).email : "?");
    if (!u.spreadsheetId) {
      // Hashimoto 가드: silent skip 금지 — registry 매핑 누락은 명시적으로 로그.
      console.warn(
        `[me] enrichUsersWithDates skip — spreadsheetId 없음 (email=${who}, cohort=${u.cohort})`,
      );
      return defaults;
    }
    try {
      const bundle = await cachedReadBundle(u.spreadsheetId);
      return {
        ...u,
        cohort: bundle.cohort || u.cohort,
        name: bundle.name || u.name,
        courseStartISO: toISO(bundle.courseStart),
        graduationISO: toISO(bundle.graduation),
      };
    } catch (e) {
      // 시트 접근/파싱 실패 — defaults 반환하되, 원인을 로그에 남겨야
      // "왜 배너가 안 보이지?" 질문을 두 번 듣지 않는다 (CLAUDE.md §0).
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
  const bundle = await cachedReadBundle(user.spreadsheetId);
  return {
    email: user.email,
    cohort: bundle.cohort || user.cohort,
    name: bundle.name || user.name,
    courseStartISO: toISO(bundle.courseStart),
    graduationISO: toISO(bundle.graduation),
  };
}
