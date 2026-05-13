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
import { readRange, appendRows, sheetsClient } from "./sheets-client";
import { invalidateRegistry } from "./users";
import { readProfileBundle } from "./sales";

const DATA_RANGE = (tab: string) => `${tab}!A2:L`;

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

interface CachedLabels {
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
 * (cohort, name) row 가 있으면 D(spreadsheetId) + I~L(cached labels) 동시 update,
 * 없으면 신규 append (12 컬럼).
 *  - email 은 빈 채로 둠 (self-claim 시 채워짐).
 *  - status="active" — 본인 매칭 시 즉시 활성.
 *  - 기존 row 의 E~H (role/status/assignedTrainer/team) 는 절대 건드리지 않음
 *    → batchUpdate 로 D 와 I~L 만 정확히 타격.
 */
export async function addTraineePrepRow(
  cohort: string,
  name: string,
  spreadsheetId: string,
  assignedTrainer = "",
): Promise<{ created: boolean }> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  // 시트 메타 1회 fetch (실패해도 빈값으로 진행). update/append 양쪽에서 사용.
  const cached = await readCachedFromSheet(spreadsheetId);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "").trim();
    if (c === cohortNorm && n === cleanName) {
      const sheetRow = i + 2;
      await sheetsClient().spreadsheets.values.batchUpdate({
        spreadsheetId: reg.spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
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
          ],
        },
      });
      invalidateRegistry();
      return { created: false };
    }
  }
  await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
    [
      "",
      cohortNorm,
      cleanName,
      spreadsheetId,
      "trainee",
      "active",
      assignedTrainer,
      "",
      cached.cohortLabel,
      cached.nameLabel,
      cached.courseStartISO,
      cached.graduationISO,
    ],
  ]);
  invalidateRegistry();
  return { created: true };
}
