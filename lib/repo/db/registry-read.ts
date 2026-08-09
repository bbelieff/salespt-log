/**
 * Layer: repo — 레지스트리(users/cohorts) **읽기** DB 전환 (BBE-56, R7 Phase 1).
 *
 * 설계 원칙: 시트 행과 **똑같은 모양(열 순서 배열)** 으로 돌려준다.
 *   users = A~T · cohorts = A~J. 그래야 `parseRow`·`pickPreferredUser`·`listCohorts` 등
 *   하위 파싱·우선순위 로직을 **한 줄도 바꾸지 않고** 재사용한다(장애 반경 최소화).
 *   쿼리를 함수별로 새로 짜면 그 수만큼 새 버그 표면이 생긴다 — 카드가 경고한
 *   "로그인 경로가 걸려 있어 장애 반경이 크다" 에 대한 대응.
 *
 * 게이트: BBE-57(course-dates.ts)이 확립한 **기본 OFF 전역 env 스위치**를 그대로 따른다.
 *   기수 allowlist(daily-source.ts)가 아니라 전역인 이유 = 레지스트리는 기수 무관 전역 테이블.
 *
 * ⚠️ **폴백이 이 파일의 핵심 안전장치**: DB 가 실패하거나 **0행**을 주면 null 을 반환해
 *   호출부가 시트로 되돌아간다. 0행도 폴백인 이유 — 마이그레이션·backfill 미적용 상태에서
 *   "성공적으로 아무도 못 읽음"이 되면 **전 사용자 로그인 불가**가 된다(BBE-85 미완 상태에서
 *   실재하는 시나리오). 레지스트리가 0명인 정상 운영은 존재하지 않으므로 0행 = 이상 신호.
 */
import { dbEnabled, getDbPool } from "./client";

/**
 * 레지스트리 읽기 게이트 — 기본 OFF. `REGISTRY_DB_READ=1` 로만 켠다.
 * DATABASE_URL 은 다른 파일럿 기능 때문에 이미 배포 환경에 있으므로 `dbEnabled()` 만으로
 * 켜지면 카나리아가 없는 것과 같다(BBE-57 적대리뷰 교훈).
 */
export function registryDbReadEnabled(): boolean {
  return dbEnabled() && process.env.REGISTRY_DB_READ === "1";
}

/** users 테이블 → 시트 A~T 열 순서. sort_order(M)는 시트가 문자열로 들고 있어 String() 통일. */
const USER_SELECT = `select
    email, cohort, name, spreadsheet_id, role, status, assigned_trainer, team,
    cohort_label, name_label, course_start_iso, graduation_iso, sort_order,
    drive_parent_path, feedback_folder_id, drive_link_status, memo, captain_of,
    gcal_token, gcal_settings
  from users
  order by created_at, cohort, name, email`;

const COHORT_SELECT = `select
    label, status, note, type, template_sheet_id, root_folder_id,
    roster_sheet_id, sheets_folder_id, company_parent_folder_id, season_start_iso
  from cohorts
  order by created_at, label`;

/** DB 실패·0행을 한 곳에서 폴백 신호(null)로 바꾼다 — 호출부는 `?? 시트읽기` 한 줄이면 된다. */
async function readRows(sql: string, label: string): Promise<string[][] | null> {
  try {
    const res = await getDbPool().query(sql);
    const rows = (res.rows as Record<string, unknown>[]).map((r) =>
      Object.values(r).map((v) => (v === null || v === undefined ? "" : String(v))),
    );
    if (rows.length === 0) {
      console.warn(`[registry-read] ${label} 0행 — 시트로 폴백(마이그레이션·backfill 미적용 의심)`);
      return null;
    }
    return rows;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "unknown").replace(
      /postgres(ql)?:\/\/\S+/gi,
      "[DATABASE_URL]",
    );
    console.warn(`[registry-read] ${label} 실패 — 시트로 폴백: ${msg}`);
    return null;
  }
}

/** 레지스트리 users 전량(시트 A~T 모양). 게이트 OFF·실패·0행이면 null(=시트 쓰라는 신호). */
export async function readUserRowsFromDb(): Promise<string[][] | null> {
  if (!registryDbReadEnabled()) return null;
  return readRows(USER_SELECT, "users");
}

/** 레지스트리 cohorts 전량(시트 A~J 모양). 게이트 OFF·실패·0행이면 null. */
export async function readCohortRowsFromDb(): Promise<string[][] | null> {
  if (!registryDbReadEnabled()) return null;
  return readRows(COHORT_SELECT, "cohorts");
}
