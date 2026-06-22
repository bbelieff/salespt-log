/**
 * 1회용 — 김종근 계정 재통합 (REVERSE of #396): jkk.masterbiz → jjamjjamipd.
 * + 아레나 A1-3 김종근 중복행(jkk) 제거(jjam 행 유지). chore/kimjongkeun-unify-jjam plan.
 *
 * 동작 (registry users 탭, A=email B=cohort C=name D=sheetId E=role F=status G=assignedTrainer):
 *  1) role=trainer, name=김종근, email=jkk 행 → A열 jjam 으로.
 *  2) cohort=A1-3, name=김종근, email=jkk 행 삭제(같은 시트 가리키는 jjam 행은 유지).
 *  3) 전체 G열 콤마토큰 중 정확히 "jkk.masterbiz@gmail.com" → "jjamjjamipd@gmail.com" + dedupe.
 *  4) 검증: 적용 후 레지스트리에 jkk 0건, 김종근 행이 정확히 2행(트레이너 1 + A1-3 1).
 * 멱등(이미 jjam이면 skip). 변경 셀만 update(§2.5). 항상 백업 dump. 삭제는 맨 마지막 단일행.
 *
 * 실행: node scripts/unify-kimjongkeun-jjam-2026-06-22.mjs          # 드라이런(쓰기 없음)
 *       node scripts/unify-kimjongkeun-jjam-2026-06-22.mjs --apply  # 실제 적용(belie 승인 후)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const OLD = "jkk.masterbiz@gmail.com"; // 제거 대상
const NEW = "jjamjjamipd@gmail.com"; // 통합 대상
const APPLY = process.argv.includes("--apply");

function loadEnvFile() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8").replace(/\r/g, "");
    const out = {};
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
    return out;
  }
  return {};
}
const fileEnv = loadEnvFile();
const env = (k) => process.env[k] || fileEnv[k] || "";

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("자격(SHEETS_REGISTRY_ID / SA)을 찾지 못했습니다.");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets",
]);
const sheets = google.sheets({ version: "v4", auth });
const norm = (s) => String(s ?? "").trim().toLowerCase();

const meta = await sheets.spreadsheets.get({
  spreadsheetId: REGISTRY_ID,
  fields: "sheets(properties(sheetId,title))",
});
const tabGid = (meta.data.sheets ?? []).find((s) => s.properties?.title === TAB)?.properties?.sheetId;
if (tabGid === undefined) {
  console.error(`'${TAB}' 탭을 찾지 못했습니다.`);
  process.exit(1);
}

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:R`,
});
const rows = res.data.values ?? [];

const backupPath = `scripts/_backup-users-kimjongkeun-jjam-${APPLY ? "preapply" : "dryrun"}.json`;
writeFileSync(backupPath, JSON.stringify(rows, null, 2));
console.log(`백업 저장: ${backupPath} (${rows.length}행)`);

const edits = [];
let deleteRowNum = null;
const kimRows = [];

rows.forEach((r, i) => {
  const rowNum = i + 2;
  const email = norm(r[0]);
  const cohort = String(r[1] ?? "").trim();
  const name = String(r[2] ?? "").trim();
  const role = String(r[4] ?? "").trim();
  const status = String(r[5] ?? "").trim();
  const g = String(r[6] ?? "");

  if (name === "김종근")
    kimRows.push({ rowNum, email: r[0] ?? "", cohort, name, sheetId: r[3] ?? "", role, status });

  // 1) 트레이너 행 jkk → jjam
  if (name === "김종근" && role.toUpperCase() === "TRAINER" && email === norm(OLD))
    edits.push({ rowNum, col: "A", before: r[0], after: NEW, why: "트레이너 이메일 역통합" });
  // 2) A1-3 김종근 jkk 행 삭제 (jjam 행 유지)
  if (name === "김종근" && /^A\d+-3/.test(cohort) && email === norm(OLD))
    deleteRowNum = rowNum;
  // 3) G열 토큰 jkk → jjam + dedupe
  if (g) {
    const toks = g.split(",").map((t) => t.trim()).filter(Boolean);
    if (toks.some((t) => norm(t) === norm(OLD))) {
      const replaced = toks.map((t) => (norm(t) === norm(OLD) ? NEW : t));
      const seen = new Set();
      const deduped = replaced.filter((t) => {
        const k = norm(t);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const next = deduped.join(",");
      if (next !== g) edits.push({ rowNum, col: "G", before: g, after: next, why: "담당트레이너 토큰 치환+dedup" });
    }
  }
});

console.log("\n=== 김종근 행 현황 ===");
kimRows.forEach((k) =>
  console.log(`  row${k.rowNum}: email=${k.email || "(빈칸)"} | ${k.cohort} | ${k.role} | ${k.status} | sheet=${k.sheetId || "없음"}`),
);
const gEdits = edits.filter((e) => e.col === "G");
console.log(`\n=== 계획된 변경 (${edits.length}건 + 행삭제 ${deleteRowNum ? 1 : 0}) ===`);
edits.filter((e) => e.col === "A").forEach((e) =>
  console.log(`  [A] row${e.rowNum}: "${e.before}" → "${e.after}"  (${e.why})`),
);
if (deleteRowNum) console.log(`  [삭제] row${deleteRowNum} (A1-3 김종근 jkk 중복)`);
console.log(`  [G] 담당트레이너 토큰 치환 ${gEdits.length}행:`);
gEdits.forEach((e) => console.log(`     row${e.rowNum}: "${e.before}" → "${e.after}"`));

// 검증 시뮬레이션 — 적용 후 상태 예측
const afterDeleteKim = kimRows.filter((k) => k.rowNum !== deleteRowNum).length;
const jkkRemainAfter = rows.filter((r, i) => {
  const rowNum = i + 2;
  if (rowNum === deleteRowNum) return false;
  const aEdit = edits.find((e) => e.rowNum === rowNum && e.col === "A");
  const gEdit = edits.find((e) => e.rowNum === rowNum && e.col === "G");
  const a = aEdit ? aEdit.after : String(r[0] ?? "");
  const g = gEdit ? gEdit.after : String(r[6] ?? "");
  return norm(a) === norm(OLD) || g.split(",").some((t) => norm(t) === norm(OLD));
}).length;
console.log(`\n=== 검증(예측) === 김종근 행: ${afterDeleteKim} (목표 2) | 잔존 jkk: ${jkkRemainAfter} (목표 0)`);

if (edits.length === 0 && !deleteRowNum) {
  console.log("\n변경 없음 (이미 역통합됨 — 멱등 skip).");
  process.exit(0);
}
if (!APPLY) {
  console.log("\n*** 드라이런 — 쓰기 없음. 실제 적용: --apply ***");
  process.exit(0);
}

const data = edits.map((e) => ({ range: `'${TAB}'!${e.col}${e.rowNum}`, values: [[e.after]] }));
if (data.length) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: { valueInputOption: "RAW", data },
  });
  console.log(`\n값 업데이트 ${data.length}건 적용.`);
}
if (deleteRowNum) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: tabGid, dimension: "ROWS", startIndex: deleteRowNum - 1, endIndex: deleteRowNum },
          },
        },
      ],
    },
  });
  console.log(`A1-3 김종근 jkk 행(row${deleteRowNum}) 삭제 완료.`);
}
console.log("\n완료. 캐시 무효화(또는 60s) 후 로그인/담당 확인 권장.");
