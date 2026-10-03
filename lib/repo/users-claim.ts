/**
 * Layer: repo — Self-claim 등록 로직 (users.ts 에서 분리, 500줄 cap).
 *
 * 멀티 어카운트 per 시트 (2026-05-12):
 *   같은 (cohort, name) 에 여러 email 등록 허용. 직원·파트너가 같은 수강생
 *   시트를 공유. spreadsheetId 는 첫 등록 row 의 값을 재사용.
 *
 * 결정 흐름 — (cohort, name) 매칭 row 들을 스캔:
 *   1. 같은 email row 있음 → 이미 등록됨, 멱등 skip.
 *   2. email 빈 prep row (admin 사전 등록) → 그 row 의 A 컬럼만 채움.
 *      (I~L 캐시는 addTraineePrepRow 가 이미 stamp 했으므로 건드리지 않음.)
 *   3. 다른 email 로 점유된 row 있음 → 새 row append (같은 sheetId 공유,
 *      cached I~L 도 함께 stamp — PR B-2).
 *   4. 매칭 row 자체가 없음 → 인자대로 새 row append (완전 신규, cached I~L 포함).
 *
 * 트레이너 모드(cohort=T)도 동일 로직 — 단 sheetId 는 항상 "" (트레이너는
 * 본인 시트 없음). cached 는 빈값.
 */
import { registry } from "@/config";
import { User } from "@/types";
import { readRange, sheetsClient } from "./sheets-client";
import { nextRegistryRowNumber } from "./registry-row";
import { invalidateRegistry } from "./users";
import { nameMatches } from "./name-match";
import {
  mirrorUserRekey,
  mirrorUserRow,
  registryRowFromSheetRow,
} from "./db/registry-mirror";

// A2:R — 전체 폭. 결정적 append 행번호(rows.length) 계산이 M 밖으로 밀린 행도
// 빠짐없이 세도록(claim-append-columns). 매칭은 A~D 만 사용.
const DATA_RANGE = (tab: string) => `${tab}!A2:R`;

/**
 * PR B-2: registry I~L 캐시 컬럼 값 (호출자가 시트 fetch 후 미리 변환해 넘김).
 * 모두 빈 문자열이면 캐시 stamp 안 함 (= 빈값 stamp 와 동일 — append 행에는
 * 무조건 12 컬럼 들어가야 함). 시트 read 실패 시 호출자가 EMPTY 전달.
 */
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

// 기존 import 경로 호환을 유지하되 계산 정본은 순환 참조 없는 registry-row.ts에 둔다.
export { nextRegistryRowNumber };

/** spreadsheetId 가 이미 아레나(A시즌-기수, ^A\d+-) cohort 행으로 등록돼 있으면 그
 *  {cohort, name} 반환. 숫자 기수 클레임이 아레나 시트에 중복 행 만드는 것 차단용
 *  (arena-numeric-duplicate-claim-guard). 클레임 직전 정확성 위해 fresh read. */
export async function findArenaRowBySheetId(
  spreadsheetId: string,
): Promise<{ cohort: string; name: string } | null> {
  if (!spreadsheetId) return null;
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  for (const r of rows) {
    const sid = String(r[3] ?? "").trim();
    const cohort = String(r[1] ?? "").trim();
    if (sid === spreadsheetId && /^A\d+-/.test(cohort)) {
      return { cohort, name: String(r[2] ?? "").trim() };
    }
  }
  return null;
}

/** registry 행을 **결정적 좌표**(`A{n}`)로 기록 — values.append 의 table-detection
 * 이 빈 A열 prep 행 때문에 새 행을 H열~로 미는 버그 방지(claim-append-columns 2026-06-14).
 * 항상 A열부터 정렬해 findUserByEmail(A열 조회)이 찾을 수 있게 한다. */
async function appendRegistryRow(
  spreadsheetId: string,
  tab: string,
  existingDataRows: number,
  row: unknown[],
): Promise<void> {
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${nextRegistryRowNumber(existingDataRows)}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export async function claimRegistry(
  email: string,
  cohort: string,
  name: string,
  spreadsheetId: string,
  role: User["role"] = "trainee",
  status: User["status"] = "active",
  cached: CachedLabels = EMPTY_CACHED,
): Promise<void> {
  const reg = registry();
  // 쓰기 직전 → 캐시 우회 (직접 readRange).
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  const lcEmail = email.toLowerCase();

  // 같은 (cohort, name) row 전부 수집.
  const matchedRows: { rowIdx: number; emailLc: string; sheetId: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "");
    // 부부면 저장 "류서하(심나영)" 이 입력 "류서하"/"심나영" 둘 다 매칭 → prep row 채워 active.
    if (c !== cohortNorm || !nameMatches(n, cleanName)) continue;
    matchedRows.push({
      rowIdx: i,
      emailLc: String(r[0] ?? "").trim().toLowerCase(),
      sheetId: String(r[3] ?? "").trim(),
    });
  }

  // 1) 멱등.
  if (matchedRows.some((r) => r.emailLc === lcEmail)) {
    invalidateRegistry();
    return;
  }

  // 2) admin prep row 갱신 — A(email) 만 채움.
  // I~L 캐시는 prep 시 stamp 됐거나 빈값. 빈값이면 PR B-3 sync 버튼이 backfill.
  // 여기서 다시 시트 fetch 해서 메우면 claim 경로가 무거워지므로 별도 처리.
  const prep = matchedRows.find((r) => r.emailLc === "");
  if (prep) {
    const sheetRow = prep.rowIdx + 2;
    // registry 쓰기 → RAW (PR D).
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${reg.tab}!A${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[email]] },
    });
    invalidateRegistry();
    // DB 미러(BBE-55) — prep 행은 email="" 로 적재돼 있어 자연키가 바뀐다(rekey).
    const prepRow = rows[prep.rowIdx] ?? [];
    mirrorUserRekey(
      { email: "", cohort: String(prepRow[1] ?? "").trim(), name: String(prepRow[2] ?? "").trim() },
      registryRowFromSheetRow(prepRow, { email }),
    );
    return;
  }

  // 3) 시트 공유 추가 계정 — sheetId 는 기존 row 재사용. cached 도 같이 박음.
  //    sortOrder(M) 은 0 (미정렬) — admin 이 드래그로 직접 부여.
  if (matchedRows.length > 0) {
    const sharedSheetId = matchedRows[0]!.sheetId || spreadsheetId;
    const row = [
      email, cohortNorm, cleanName, sharedSheetId, role, status,
      "", "", cached.cohortLabel, cached.nameLabel,
      cached.courseStartISO, cached.graduationISO, "0",
    ];
    await appendRegistryRow(reg.spreadsheetId, reg.tab, rows.length, row);
    invalidateRegistry();
    mirrorUserRow(registryRowFromSheetRow(row));
    return;
  }

  // 4) 완전 신규 — cached 포함 13 컬럼.
  const row = [
    email, cohortNorm, cleanName, spreadsheetId, role, status,
    "", "", cached.cohortLabel, cached.nameLabel,
    cached.courseStartISO, cached.graduationISO, "0",
  ];
  await appendRegistryRow(reg.spreadsheetId, reg.tab, rows.length, row);
  invalidateRegistry();
  mirrorUserRow(registryRowFromSheetRow(row));
}
