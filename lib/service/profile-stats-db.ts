/**
 * Layer: service — `readProfileBundle.stats` 의 DB 재현 (BBE-64, R7 Phase 3 #15).
 *
 * 대체 대상 = `lib/repo/sales.ts:sumFunnelDataRows`(01 영업관리!E~N 8주 블록 합산).
 * **cohort/name/courseStart/graduation 는 DB 대응값이 없어 대체하지 않는다** — 이 파일은
 * `stats`(미팅예정/미팅완료/계약) 만 다룬다. `enrichUsersWithDates` 는 그대로 둔다.
 *
 * 실측(설치 수식 코드, lib/repo/setup-formulas.ts, ground-truth):
 *   H(미팅예정)= 01 영업관리 raw 주간 입력(컨택관리 폼) — sales.meetingReservation 합.
 *   L(미팅완료)= COUNTIFS(04!J,"계약",AO,"<>이월") + COUNTIFS(04!J,"완료",AO,"<>이월").
 *   N(계약)    = COUNTIFS(04!J,"계약",AO,"<>이월").  ⚠️ 계약여부(K) 아님 — 실제 N열 수식은
 *     상태(J)="계약" 을 직접 카운트한다(계약여부는 J 와 "동기화용" 호환 필드, meeting.ts:79
 *     주석). 상태를 쓰는 게 시트 수식과 1:1 대응.
 * `lib/service/dashboard-aggregates.ts` 의 `weeklyContractsFromDb` 가 비슷한 계산을 이미
 * 하지만 **AO(이월) 제외가 빠져 있어 재사용하지 않는다**(그림자 대조 전용 코드, 별도 확인 필요
 * — 이 PR 범위 밖). `DONE`/`CARRYOVER` 술어만 재사용하고, 윈도우·이월 처리는 여기서 새로 한다.
 */
import type { Meeting } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import { readProfileStatsRowsFromDbBatch } from "@/repo/db/profile-stats";
import { DONE, CARRYOVER } from "./dashboard-aggregates";
import { weekIndexOf } from "@/util/week";
import { STATS_WEEKS } from "@/config/cohort-dates";
import type { TraineeFunnelStats } from "./me";

/** "YYYY-MM-DD" → 로컬 자정 Date. dashboard-aggregates.ts의 parseISO 와 동일 규칙
 * (UTC 파싱 혼용 시 경계일 off-by-one — 그 파일 헤더 주석 경고 재확인 후 여기도 동일 적용). */
function parseISOLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function inStatsWindow(dateISO: string, courseStart: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false; // fail-closed(날짜 파싱 불가 = 제외)
  const w = weekIndexOf(parseISOLocal(dateISO), courseStart);
  return w >= 1 && w <= STATS_WEEKS;
}

/**
 * 순수 함수 — DB 원본 행 → TraineeFunnelStats. 채널 구분 없이 8주 창 전체 합산
 * (시트 N/L 열도 채널별 셀을 8주×전 채널 통째로 합산하므로 채널 필터 불필요 — 실측 확인).
 */
export function traineeFunnelStatsFromDbRows(
  salesRows: DbSalesRow[],
  meetings: Meeting[],
  courseStart: Date,
): TraineeFunnelStats {
  let 미팅예정 = 0;
  for (const r of salesRows) {
    if (inStatsWindow(r.date, courseStart)) 미팅예정 += r.meetingReservation;
  }

  let 미팅완료 = 0;
  let 계약 = 0;
  for (const m of meetings) {
    if (CARRYOVER(m)) continue; // AO<>이월 (설치 수식과 동일)
    if (!inStatsWindow(m.미팅날짜, courseStart)) continue;
    if (DONE(m.상태)) 미팅완료 += 1; // 상태∈{완료,계약}
    if (m.상태 === "계약") 계약 += 1; // 상태="계약" — 계약여부(K) 아님, N열 수식 그대로
  }

  return { 미팅예정, 미팅완료, 계약 };
}

/**
 * `enrichUsersWithStats` 의 DB-파일럿 배치 경로. 호출부가 이미 `isDbReadPilot`+`dbEnabled()`
 * 로 걸러낸 사용자만 넘겨야 한다(이 함수는 게이트를 다시 걸지 않음). 실패 시 throw —
 * 호출부가 파일럿 배치 전체를 sheet 경로로 폴백한다(개별 재시도 없음, loadDashboard 와 동일
 * all-or-nothing 정책).
 *
 * **입력과 같은 길이·순서의 배열을 반환한다** — `spreadsheetId` 로 키를 잡지 않는다.
 * 적대적 리뷰(2026-08-06)에서 확인된 실제 버그: 부부/멀티계정은 시트를 공유해 같은
 * `spreadsheetId` 를 쓰지만(`lib/repo/users-claim.ts` "시트를 공유. spreadsheetId 는
 * 첫 등록 row 의 값을 재사용") 각자의 `courseStartISO` 캐시는 독립적으로 어긋날 수 있다
 * (`/captain` 화면의 `listArenaCohortMembers` 는 이런 중복 행을 거르지 않음, `/admin/users`·
 * `/trainer` 의 `listDistinctUsers` 와 다름). `spreadsheetId` 로 Map 을 키 잡으면 두 번째
 * 사용자가 첫 번째 결과를 조용히 덮어써 한쪽이 잘못된(=missing 아닌 wrong) 8주 창 통계를
 * 받는다. 배열 반환 + 호출부의 index 기반 병합(me.ts)이면 이 충돌이 원천적으로 불가능하다.
 */
export async function profileStatsFromDb(
  users: Array<{ spreadsheetId: string; courseStart: Date }>,
): Promise<TraineeFunnelStats[]> {
  if (users.length === 0) return [];

  const rowsById = await readProfileStatsRowsFromDbBatch(users.map((u) => u.spreadsheetId));
  return users.map((u) => {
    const rows = rowsById.get(u.spreadsheetId) ?? { salesRows: [], meetings: [] };
    return traineeFunnelStatsFromDbRows(rows.salesRows, rows.meetings, u.courseStart);
  });
}
