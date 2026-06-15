/**
 * 1회용 — 김종근 계정 통합 (jjamjjamipd@gmail.com → jkk.masterbiz@gmail.com).
 * merge-kimjongkeun-jkk-email plan 참조.
 *
 * 동작 (registry users 탭, A=email B=cohort C=name D=sheetId E=role F=status G=assignedTrainer):
 *  1) 활성 트레이너 행(email=jjamjjamipd) A열 → jkk.masterbiz.
 *  2) 보관 트레이너 행(email=jkk.masterbiz, status=archived) 행 삭제(중복 정리).
 *  3) A1-3 김종근 아레나 행(email 빈칸 + cohort A1-3 + name 김종근) A열 → jkk.masterbiz.
 *  4) 전체 G열 콤마토큰 중 정확히 "jjamjjamipd@gmail.com" → "jkk.masterbiz@gmail.com".
 * 멱등(이미 jkk면 skip). 변경 셀만 update(§2.5). 항상 백업 dump.
 *
 * 실행: node scripts/merge-kimjongkeun-jkk-email.mjs            # 드라이런(쓰기 없음)
 *       node scripts/merge-kimjongkeun-jkk-email.mjs --apply    # 실제 적용
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";

const OLD = "jjamjjamipd@gmail.com";
const NEW = "jkk.masterbiz@gmail.com";
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

// users 탭 gid (행 삭제용)
const meta = await sheets.spreadsheets.get({
  spreadsheetId: REGISTRY_ID,
  fields: "sheets(properties(sheetId,title))",
});
const tabGid = (meta.data.sheets ?? []).find((s) => s.properties?.title === TAB)
  ?.properties?.sheetId;
if (tabGid === undefined) {
  console.error(`'${TAB}' 탭을 찾지 못했습니다.`);
  process.exit(1);
}

// 전체 읽기 (A2:R)
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:R`,
});
const rows = res.data.values ?? [];

// 백업 dump (항상)
const stamp = env("BACKUP_STAMP") || "manual";
const backupPath = `scripts/_backup-users-${stamp}.json`;
writeFileSync(backupPath, JSON.stringify(rows, null, 2));
console.log(`백업 저장: ${backupPath} (${rows.length}행)`);

// ── 분석 ─────────────────────────────────────────────
const edits = []; // { rowNum, col('A'/'G'), before, after }
let deleteRowNum = null; // 1-based 시트 행번호
const kimRows = [];

rows.forEach((r, i) => {
  const rowNum = i + 2; // A2 가 i=0
  const email = norm(r[0]);
  const cohort = String(r[1] ?? "").trim();
  const name = String(r[2] ?? "").trim();
  const role = String(r[4] ?? "").trim();
  const status = String(r[5] ?? "").trim();
  const g = String(r[6] ?? "");

  if (name === "김종근") {
    kimRows.push({ rowNum, email: r[0] ?? "", cohort, name, sheetId: r[3] ?? "", role, status });
  }

  // 1) 활성 트레이너 jjamjjamipd → jkk
  if (email === norm(OLD) && role.toUpperCase() === "TRAINER") {
    edits.push({ rowNum, col: "A", before: r[0], after: NEW, why: "활성 트레이너 이메일 통합" });
  }
  // 2) 보관 jkk 트레이너 행 삭제
  if (email === norm(NEW) && role.toUpperCase() === "TRAINER" && status === "archived") {
    deleteRowNum = rowNum;
  }
  // 3) A1-3 김종근 아레나 prep 행 email 채우기
  if (name === "김종근" && /^A\d+-3/.test(cohort) && email === "") {
    edits.push({ rowNum, col: "A", before: r[0] ?? "(빈칸)", after: NEW, why: "A1-3 아레나 행 이메일" });
  }
  // 4) G열 토큰 치환 (정확 일치 토큰만) + dedup(통합으로 jkk 중복 방지)
  if (g) {
    const toks = g.split(",").map((t) => t.trim()).filter(Boolean);
    if (toks.some((t) => norm(t) === norm(OLD))) {
      const replaced = toks.map((t) => (norm(t) === norm(OLD) ? NEW : t));
      const seen = new Set();
      const deduped = replaced.filter((t) => {
        const k = norm(t);
        if (seen.has(k)) return false; // 이미 jkk 있던 행 → 중복 제거(통합)
        seen.add(k);
        return true;
      });
      const next = deduped.join(","); // 기존 스타일(공백 없는 콤마) 보존
      if (next !== g) edits.push({ rowNum, col: "G", before: g, after: next, why: "담당트레이너 토큰 치환+dedup" });
    }
  }
});

// ── 리포트 ────────────────────────────────────────────
console.log("\n=== 김종근 행 현황 ===");
kimRows.forEach((k) =>
  console.log(`  row${k.rowNum}: email=${k.email || "(빈칸)"} | ${k.cohort} | ${k.role} | ${k.status} | sheet=${k.sheetId ? "있음" : "없음"}`),
);
const gEdits = edits.filter((e) => e.col === "G");
console.log(`\n=== 계획된 변경 (${edits.length}건 + 행삭제 ${deleteRowNum ? 1 : 0}) ===`);
edits.filter((e) => e.col === "A").forEach((e) =>
  console.log(`  [A] row${e.rowNum}: "${e.before}" → "${e.after}"  (${e.why})`),
);
if (deleteRowNum) console.log(`  [삭제] row${deleteRowNum} (보관 jkk 트레이너 중복)`);
console.log(`  [G] 담당트레이너 토큰 치환 ${gEdits.length}행:`);
gEdits.forEach((e) => console.log(`     row${e.rowNum}: "${e.before}" → "${e.after}"`));

if (edits.length === 0 && !deleteRowNum) {
  console.log("\n변경 없음 (이미 통합됨 — 멱등 skip).");
  process.exit(0);
}

if (!APPLY) {
  console.log("\n*** 드라이런 — 쓰기 없음. 실제 적용: --apply ***");
  process.exit(0);
}

// ── 적용 ──────────────────────────────────────────────
// (a) 값 업데이트(A/G) — batchUpdate values. 행 삭제 전에 먼저(인덱스 안정).
const data = edits.map((e) => ({
  range: `'${TAB}'!${e.col}${e.rowNum}`,
  values: [[e.after]],
}));
if (data.length) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: { valueInputOption: "RAW", data },
  });
  console.log(`\n값 업데이트 ${data.length}건 적용.`);
}
// (b) 보관 jkk 행 삭제 (맨 마지막 — 단일 행 deleteDimension)
if (deleteRowNum) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: REGISTRY_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: tabGid,
              dimension: "ROWS",
              startIndex: deleteRowNum - 1, // 0-based, inclusive
              endIndex: deleteRowNum, // exclusive
            },
          },
        },
      ],
    },
  });
  console.log(`보관 jkk 트레이너 행(row${deleteRowNum}) 삭제 완료.`);
}
console.log("\n완료. invalidateRegistry/캐시 무효화 후 확인 권장.");
