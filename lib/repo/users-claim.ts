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
 *   3. 다른 email 로 점유된 row 있음 → 새 row append (같은 sheetId 공유).
 *   4. 매칭 row 자체가 없음 → 인자대로 새 row append (완전 신규).
 *
 * 트레이너 모드(cohort=T)도 동일 로직 — 단 sheetId 는 항상 "" (트레이너는
 * 본인 시트 없음).
 */
import { registry } from "@/config";
import { User } from "@/types";
import { readRange, appendRows, sheetsClient } from "./sheets-client";
import { invalidateRegistry } from "./users";

const DATA_RANGE = (tab: string) => `${tab}!A2:L`;

export async function claimRegistry(
  email: string,
  cohort: string,
  name: string,
  spreadsheetId: string,
  role: User["role"] = "trainee",
  status: User["status"] = "active",
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
    const n = String(r[2] ?? "").trim();
    if (c !== cohortNorm || n !== cleanName) continue;
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

  // 2) admin prep row 갱신.
  const prep = matchedRows.find((r) => r.emailLc === "");
  if (prep) {
    const sheetRow = prep.rowIdx + 2;
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${reg.tab}!A${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[email]] },
    });
    invalidateRegistry();
    return;
  }

  // 3) 시트 공유 추가 계정 — sheetId 는 기존 row 재사용.
  if (matchedRows.length > 0) {
    const sharedSheetId = matchedRows[0]!.sheetId || spreadsheetId;
    await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
      [email, cohortNorm, cleanName, sharedSheetId, role, status, "", "", "", "", "", ""],
    ]);
    invalidateRegistry();
    return;
  }

  // 4) 완전 신규.
  await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
    [email, cohortNorm, cleanName, spreadsheetId, role, status, "", "", "", "", "", ""],
  ]);
  invalidateRegistry();
}
