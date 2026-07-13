/**
 * Layer: repo — Admin 사전 등록 (prep row) — users.ts 에서 분리 (500줄 cap).
 *
 * 사용처: /admin/users 의 "신규 수강생 사전 등록" 폼 → POST /api/admin/add-trainee-prep.
 * 효과:
 *   - 시트 URL 받아서 spreadsheetId 추출 + (cohort, name) prep row 생성.
 *   - 본인이 /claim 시 (cohort, name) 매칭 → email 만 채워서 즉시 active.
 *   - Drive 시트 이름 일치 의존성 없음 — admin 이 명시적으로 매핑.
 *
 * PR B-2 (2026-05-13):
 *   prep 시점에 readProfileBundle 로 시트 B3/C3/O1/O2 까지 단일 batchGet 으로
 *   읽어 registry I~L 캐시(cohort_label/name_label/course_start_iso/graduation_iso)
 *   에 같이 박는다. 평시 enrichUsersWithDates 가 시트 fetch 0회 달성하는 핵심.
 *   시트 read 실패 시 빈값으로 stamp — 이후 admin "[🔄 동기화]" (PR B-3) 가 backfill.
 */
import { registry } from "@/config";
import { readRange, sheetsClient } from "./sheets-client";
import { invalidateRegistry } from "./users";
import { nextRegistryRowNumber } from "./users-claim";
import { readProfileBundle } from "./sales";

// 밀린(빈 A열) 행도 행수에 포함되도록 R열까지 읽는다 — 결정적 append 좌표
// 계산이 M 밖으로 밀린 옛 행을 빠짐없이 세야 덮어쓰기 사고가 없다(claim-append-columns 파리티).
const DATA_RANGE = (tab: string) => `${tab}!A2:R`;

/**
 * 시트 URL / open URL / raw ID 어떤 형태든 spreadsheetId 추출.
 * `https://docs.google.com/spreadsheets/d/{ID}/edit?usp=sharing` 같은 URL OK.
 * 매칭 실패면 입력값 그대로 반환 (호출 측이 길이·문자 검증).
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1]!;
  return trimmed;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface CachedLabels {
  cohortLabel: string;
  nameLabel: string;
  courseStartISO: string;
  graduationISO: string;
}

const EMPTY_CACHED: CachedLabels = {
  cohortLabel: "",
  nameLabel: "",
  courseStartISO: "",
  graduationISO: "",
};

/**
 * 시트 B3/C3/O1/O2 → registry I~L 캐시용 라벨로 변환.
 * 실패해도 throw 하지 않음 — prep row 생성은 진행하고 빈값 stamp.
 * (admin 이 시트 권한 부여 전 / 새 시트 빈 상태 / 일시 API 실패 → 모두 흡수)
 */
async function readCachedFromSheet(spreadsheetId: string): Promise<CachedLabels> {
  try {
    const b = await readProfileBundle(spreadsheetId);
    return {
      cohortLabel: b.cohort,
      nameLabel: b.name,
      courseStartISO: toISO(b.courseStart),
      graduationISO: toISO(b.graduation),
    };
  } catch (e) {
    console.warn(
      `[users-prep] cached 컬럼 fetch 실패 (sheet=${spreadsheetId}) — 빈값으로 stamp. ` +
        `B-3 sync 버튼에서 backfill 가능.`,
      e instanceof Error ? e.message : e,
    );
    return EMPTY_CACHED;
  }
}

/**
 * prep row 의 **고정폭(A~Q, 17열) 값 배열** — 순수, 테스트 대상.
 * 항상 A열(email="")부터 정렬한다. 열밀림(J~ 로 밀려 적재)의 재발을 이 배열 형태가 막고,
 * 신규 write 는 결정적 `A{n}` 좌표로 내려찍는다(아래). 컬럼 SSOT = sheet-structure.md §6.
 */
export function buildPrepRowValues(input: {
  cohort: string;
  name: string;
  spreadsheetId: string;
  assignedTrainer?: string;
  feedbackFolderId?: string;
  memo?: string;
  cached: CachedLabels;
}): string[] {
  const cohortNorm = String(input.cohort).replace(/기\s*$/, "").trim();
  return [
    "", //                                A email — self-claim 시 채워짐
    cohortNorm, //                        B cohort
    input.name.trim(), //                 C name
    input.spreadsheetId, //               D spreadsheetId
    "trainee", //                         E role
    "active", //                          F status — 본인 매칭 시 즉시 활성
    (input.assignedTrainer ?? "").trim(), // G assignedTrainer
    "", //                                H team
    input.cached.cohortLabel, //          I
    input.cached.nameLabel, //            J
    input.cached.courseStartISO, //       K
    input.cached.graduationISO, //        L
    "0", //                               M sortOrder — admin 드래그로 부여(PR C-1)
    "", //                                N drive_parent_path
    (input.feedbackFolderId ?? "").trim(), // O feedback_folder_id
    "", //                                P drive_link_status
    (input.memo ?? "").trim(), //         Q memo
  ];
}

/**
 * (cohort, name) 매칭 prep row 의 **데이터행 인덱스**(0-base) — 없으면 -1. 순수, 테스트 대상.
 * 매칭은 B(cohort)·C(name)만 본다. **열밀림 행은 B가 비어 매칭 실패** → 옛 append 방식에선
 * 재제출마다 새 행이 쌓였다(멱등 부재의 근인). A열 정렬 write 로 바뀌면 이 매칭이 정상 동작해
 * 재제출이 update(중복 미생성)로 흡수된다.
 */
export function findPrepRowIndex(
  rows: unknown[][],
  cohort: string,
  name: string,
): number {
  // 양쪽 다 "기" 정규화 — 인자가 "8"이든 "8기"든 동일 매칭(오용 방지).
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = String(name).trim();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "").trim();
    if (c === cohortNorm && n === cleanName) return i;
  }
  return -1;
}

/**
 * (cohort, name) row 가 있으면 D(spreadsheetId) + I~L(cached labels) 동시 update(중복 미생성),
 * 없으면 신규 row 를 **결정적 `A{n}` 좌표**로 기록.
 *  - email 은 빈 채로 둠 (self-claim 시 채워짐). status="active".
 *  - update 시 기존 row 의 E~H (role/status/assignedTrainer/team) 는 절대 건드리지 않음.
 *  - **신규는 values.append(테이블 자동감지) 금지** — 빈 A열 prep 행이 있으면 새 행을 J열~로
 *    미는 버그 재발(claim-append-columns 2026-06-14 에 claim 경로가 겪은 것과 동일). 대신
 *    `A{nextRegistryRowNumber(rows.length)}` 로 update → 항상 A열부터, 밀림·중복 없음.
 */
export async function addTraineePrepRow(
  cohort: string,
  name: string,
  spreadsheetId: string,
  assignedTrainer = "",
  feedbackFolderId = "",
  memo = "",
): Promise<{ created: boolean }> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  const ffid = feedbackFolderId.trim();
  const memoVal = memo.trim();
  // 시트 메타 1회 fetch (실패해도 빈값으로 진행). update/write 양쪽에서 사용.
  const cached = await readCachedFromSheet(spreadsheetId);

  const idx = findPrepRowIndex(rows, cohortNorm, cleanName);
  if (idx >= 0) {
    // 이미 존재 → 새 행 만들지 않음(멱등). D + I~L(+O,Q) 만 정확히 타격.
    const sheetRow = idx + 2;
    // registry batchUpdate → RAW (PR D). ISO 날짜가 자동 시리얼화되는 사고 방지.
    const data: { range: string; values: string[][] }[] = [
      { range: `${reg.tab}!D${sheetRow}`, values: [[spreadsheetId]] },
      {
        range: `${reg.tab}!I${sheetRow}:L${sheetRow}`,
        values: [[
          cached.cohortLabel,
          cached.nameLabel,
          cached.courseStartISO,
          cached.graduationISO,
        ]],
      },
    ];
    // 아레나 업체관리 폴더 id → O(feedback_folder_id) stamp (주어진 경우만).
    if (ffid) data.push({ range: `${reg.tab}!O${sheetRow}`, values: [[ffid]] });
    // 회장/입금 메모 → Q(memo) stamp (주어진 경우만).
    if (memoVal) data.push({ range: `${reg.tab}!Q${sheetRow}`, values: [[memoVal]] });
    await sheetsClient().spreadsheets.values.batchUpdate({
      spreadsheetId: reg.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
    invalidateRegistry();
    return { created: false };
  }

  // 신규 → 결정적 A{n} 좌표로 고정폭(A~Q) 기록 (values.append 밀림 방지).
  const values = buildPrepRowValues({
    cohort,
    name,
    spreadsheetId,
    assignedTrainer,
    feedbackFolderId: ffid,
    memo: memoVal,
    cached,
  });
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: reg.spreadsheetId,
    range: `${reg.tab}!A${nextRegistryRowNumber(rows.length)}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
  invalidateRegistry();
  return { created: true };
}
