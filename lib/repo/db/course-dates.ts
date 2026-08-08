/**
 * Layer: repo — users.course_start_iso/graduation_iso 정본 이전(BBE-57, R7 Phase 1).
 *
 * 컬럼 자체는 0001_users_cohorts.sql(BBE-54)에 이미 존재하지만 100% 미배선이었다
 * (2026-08-08 실측 — grep 으로 확인, 어떤 repo 함수도 이 두 컬럼을 select/update 안 함).
 * 이 파일이 최초의 읽기/쓰기 경로. **새 마이그레이션 불필요**.
 *
 * 행 생성(row 없을 때 insert)은 이 파일의 책임이 아니다 — users 테이블 row 생성은
 * BBE-55(레지스트리 dual-write, lib/repo/db/registry.ts) 소유. 그 PR 이 머지되기 전엔
 * users 테이블이 비어 있어 아래 쓰기는 항상 0 rows affected(무해한 no-op) — BBE-55 가
 * row 를 만들기 시작하면 자동으로 살아난다. UPDATE-only 설계라 BBE-55 WIP 이 진행 중인
 * natural key 변경(email,cohort) → (email,cohort,name), 0002_users_natural_key.sql 미머지)
 * 과 충돌하지 않는다 — ON CONFLICT 타겟이 없어 unique 제약 정의와 무관.
 */
import { getDbPool, dbEnabled } from "./client";

export interface CourseDatesDbRow {
  courseStartISO: string;
  graduationISO: string;
}

/**
 * 레지스트리 레벨(users 테이블) 읽기 게이트 — sheet_rows 레벨(daily-source.ts
 * isDbReadPilot, 기수 allowlist)과 다른 모델. BBE-56 이슈 텍스트가 명시한 이유: 기수
 * allowlist 는 "그 기수 학생의 일별 지표"엔 맞지만, 레지스트리는 기수 무관 전역 테이블이라
 * 전역 스위치가 맞다. 기본 OFF — 명시적 env 로만 켠다("카나리아 필수", BBE-57 지시).
 * DATABASE_URL 이 이미 다른 파일럿 기능(sheet_rows)에 설정돼 있어도 이 스위치는 별도 —
 * dbEnabled() 만으로 자동 켜지면 사실상 카나리아가 없는 것과 같다.
 */
export function courseDateDbReadEnabled(): boolean {
  return dbEnabled() && process.env.COURSE_DATE_DB_READ === "1";
}

/**
 * 쓰기 게이트 — 읽기와 별도(적대적 리뷰 지적, 2026-08-08). dbEnabled() 만으로 쓰기가
 * 켜지면 "카나리아 필수"가 무너진다: DATABASE_URL 은 이미 다른 파일럿 기능 때문에 배포
 * 환경에 설정돼 있어서, 이 PR이 머지되는 순간 claimAccount·migrateRegistryCache 의
 * UPDATE 가 실제로 발사된다. 오늘 무해한 건 users 테이블이 0행이라는 **우연** 뿐 —
 * BBE-55(행 생성)가 머지되면 이 PR을 다시 보지 않고도 실제 데이터를 건드리기 시작한다.
 * 그래서 쓰기도 읽기처럼 명시적 opt-in 으로 독립 게이트한다.
 */
export function courseDateDbWriteEnabled(): boolean {
  return dbEnabled() && process.env.COURSE_DATE_DB_WRITE === "1";
}

/**
 * spreadsheet_id 로 조회 — email/cohort 는 호출부(lib/repo/sales.ts 의 기존 30+ 콜사이트)
 * 어디에도 없다(실측). spreadsheet_id 는 자연키가 아니다(부부·멀티계정 공유 — BBE-64 에서
 * 실제 버그로 확인). 그러나 수강기간은 **시트 1장의 물리 O1/O2 셀 값**이라 그 시트를 공유하는
 * 모든 행이 같은 값으로 수렴한다 — 값이 있는 아무 행이나(가장 최근 갱신분) 골라도 안전하다.
 * ⚠️ updated_at 은 행 전체 기준(수강기간 전용 타임스탬프 아님) — 오늘은 이 테이블에 다른
 * writer 가 없어 무해하지만, 훗날 다른 컬럼만 건드리는 writer 가 생기면 그 행이 "최신"으로
 * 오판될 수 있다. 지금은 과설계 방지(YAGNI) — 다른 writer 등장 시 재검토.
 *
 * DB 쿼리 실패(커넥션 끊김·풀 고갈 등)는 **throw 하지 않고 null 반환** — 호출부가 이 함수의
 * 실패로 시트 폴백을 잃으면 "DB 우선, 실패 시 시트" 계약이 깨진다(적대적 리뷰 HIGH 지적,
 * 2026-08-08 — 원래 코드가 시트 폴백보다 신뢰성이 낮아지는 회귀였다).
 */
export async function readCourseDatesFromDb(
  spreadsheetId: string,
): Promise<CourseDatesDbRow | null> {
  if (!dbEnabled() || !spreadsheetId) return null;
  try {
    const res = await getDbPool().query<{ course_start_iso: string; graduation_iso: string }>(
      `select course_start_iso, graduation_iso from users
       where spreadsheet_id = $1 and course_start_iso <> ''
       order by updated_at desc limit 1`,
      [spreadsheetId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { courseStartISO: row.course_start_iso, graduationISO: row.graduation_iso };
  } catch (e) {
    console.warn(`[course-dates] DB read 실패(시트 폴백으로 진행) — spreadsheetId=${spreadsheetId}`, e);
    return null;
  }
}

/**
 * (email, cohort) 로 UPDATE — 의도적으로 INSERT 안 함(위 파일 주석 참조, row 생성은 BBE-55 소유).
 * email 이 빈 문자열인 prep row 는 호출부(claimAccount)에서 애초에 나타나지 않지만 방어로 가드.
 * gradISO 빈값이면 graduation_iso 는 건드리지 않는다(COALESCE 없이 빈 문자열로 덮어쓰면 기존
 * 값을 지울 수 있음 — 적대적 리뷰 LOW 지적. cohort-pending.ts 의 CASE WHEN 보존 패턴과 동일 취지).
 * 게이트 = courseDateDbWriteEnabled()(dbEnabled() 만으론 부족 — 위 함수 주석 참조).
 */
export async function writeCourseDatesToDb(
  email: string,
  cohort: string,
  startISO: string,
  gradISO: string,
): Promise<{ skipped: boolean; updated: boolean }> {
  if (!courseDateDbWriteEnabled() || !email || !cohort || !startISO) {
    return { skipped: true, updated: false };
  }
  const res = await getDbPool().query(
    `update users set
       course_start_iso = $3,
       graduation_iso = case when $4 = '' then graduation_iso else $4 end,
       updated_at = now()
     where email = $1 and cohort = $2`,
    [email, cohort, startISO, gradISO],
  );
  return { skipped: false, updated: (res.rowCount ?? 0) > 0 };
}
