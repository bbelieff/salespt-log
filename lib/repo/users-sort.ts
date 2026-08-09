/**
 * Layer: repo — Registry M 컬럼(sort_order) 일괄 update (users.ts 에서 분리, 500줄 cap).
 *
 * PR C-1 (2026-05-13). admin 드래그 정렬 결과를 받아 박스 내 카드들에 1..N 의
 * sortOrder 를 일괄 반영. /admin/users + /admin/trainers 공용.
 *
 * 설계: 호출자(API route)가 email → order 매핑을 통째로 넘김. 박스 단위 의미는
 * 호출자가 알고 있고 (drag 한 박스의 멤버 emails 만), 여기는 row 매칭 + M 컬럼
 * batchUpdate 만. 다른 컬럼은 절대 건드리지 않음.
 *
 * **synth admin 자동 row 생성 (2026-05-14)**: ADMIN_EMAILS 멤버인데 registry
 * row 가 없으면 드래그 정렬이 silent skip 되던 사고 ("김믿음 핸들 안 먹힘" 3회
 * 반복 보고). row 없는 admin 은 trainer row 를 append (M 에 sortOrder 포함) →
 * 이후 모든 row 기반 작업 (assign/dept/remove/sort) 이 일관되게 동작.
 *
 * 청크: PR B-3 migrate 와 동일하게 100 row/call.
 */
import { registry, adminNames } from "@/config";
import { readRange, sheetsClient } from "./sheets-client";
import { nextRegistryRowNumber } from "./registry-row";
import { invalidateRegistry, isAdminSynthCandidate } from "./users";
import { mirrorUserCells, mirrorUserRow, registryRowFromUser } from "./db/registry-mirror";

const DATA_RANGE = (tab: string) => `${tab}!A2:M`;
const CHUNK_SIZE = 100;

export async function setUserSortOrders(
  orders: { email: string; sortOrder: number }[],
): Promise<{ updated: number; skipped: number; created: number }> {
  if (orders.length === 0) return { updated: 0, skipped: 0, created: 0 };
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const emailToRow = new Map<string, number>();
  // 자연키(email,cohort,name) DB 미러용 — 같은 스캔에서 B·C 도 같이 기억한다.
  const emailToKey = new Map<string, { cohort: string; name: string }>();
  for (let i = 0; i < rows.length; i++) {
    const e = String(rows[i]?.[0] ?? "").trim().toLowerCase();
    if (e) {
      emailToRow.set(e, i + 2); // header offset
      emailToKey.set(e, {
        cohort: String(rows[i]?.[1] ?? "").trim(),
        name: String(rows[i]?.[2] ?? "").trim(),
      });
    }
  }

  const nameMap = adminNames();
  const updates: { range: string; values: unknown[][] }[] = [];
  // synth admin (registry row 없는 ADMIN_EMAILS 멤버) → 새 trainer row append.
  // 드래그 정렬이 row 기반이라 row 없으면 정렬이 저장 안 되던 사고 (2026-05-14).
  const appendData: (string | number | boolean)[][] = [];
  const mirrorCellTargets: {
    email: string; cohort: string; name: string; sortOrder: number;
  }[] = [];
  let skipped = 0;

  for (const o of orders) {
    const lc = o.email.toLowerCase();
    if (!Number.isFinite(o.sortOrder) || o.sortOrder < 0) {
      skipped++;
      continue;
    }
    const sheetRow = emailToRow.get(lc);
    if (sheetRow) {
      // 기존 row → M 컬럼만 update.
      updates.push({
        range: `${reg.tab}!M${sheetRow}`,
        values: [[String(Math.floor(o.sortOrder))]],
      });
      const k = emailToKey.get(lc);
      mirrorCellTargets.push({
        email: lc,
        cohort: k?.cohort ?? "",
        name: k?.name ?? "",
        sortOrder: Math.floor(o.sortOrder),
      });
    } else if (isAdminSynthCandidate(lc)) {
      // synth admin → 새 trainer row append. M 에 sortOrder 포함 (별도 update 불필요).
      // cohort="T" (담당 가능 트레이너 — "관리" 아님), role="trainer".
      // setTrainerDepartment 의 synth append 와 동일 스키마 + M 컬럼.
      const fallbackName = nameMap[lc] ?? lc.split("@")[0] ?? lc;
      appendData.push([
        lc,
        "T",
        fallbackName,
        "",
        "trainer",
        "active",
        "",
        "",
        "",
        "",
        "",
        "",
        String(Math.floor(o.sortOrder)),
      ]);
    } else {
      // 등록 안 된 일반 email — skip (트레이니도 admin 도 아닌데 들어온 경우).
      skipped++;
    }
  }

  if (appendData.length > 0) {
    // 결정적 좌표(claim-append-columns 패턴) — values.append 열밀림 방지.
    // RAW(PR D) — 숫자 문자열 "3" 도 텍스트 그대로. parseRow 가 parseInt 복원.
    await sheetsClient().spreadsheets.values.batchUpdate({
      spreadsheetId: reg.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: appendData.map((row, i) => ({
          range: `${reg.tab}!A${nextRegistryRowNumber(rows.length + i)}`,
          values: [row],
        })),
      },
    });
  }
  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      await sheetsClient().spreadsheets.values.batchUpdate({
        spreadsheetId: reg.spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: chunk,
        },
      });
    }
  }
  if (updates.length > 0 || appendData.length > 0) {
    invalidateRegistry();
  }
  // DB 미러(BBE-55) — 시트 쓰기 성공 후 fire-and-forget.
  for (const m of mirrorCellTargets) {
    mirrorUserCells({ email: m.email, cohort: m.cohort, name: m.name }, { M: m.sortOrder });
  }
  for (const r of appendData) {
    mirrorUserRow(registryRowFromUser({
      email: String(r[0]), cohort: String(r[1]), name: String(r[2]), spreadsheetId: "",
      role: "trainer", status: "active", assignedTrainer: "", team: "",
      cohortLabel: "", nameLabel: "", courseStartISO: "", graduationISO: "",
      sortOrder: Number(r[12]) || 0,
      driveParentPath: "", feedbackFolderId: "", driveLinkStatus: "",
      memo: "", captainOf: "", gcalToken: "", gcalSettings: "",
    }));
  }
  return {
    updated: updates.length,
    skipped,
    created: appendData.length,
  };
}
