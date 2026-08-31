/**
 * 아레나 **업체관리 폴더 감사·복구** (2026-08-31, belie P0).
 *
 *   node scripts/ops/arena-company-folder.mjs --audit                 # 읽기 전용 전수 점검
 *   node scripts/ops/arena-company-folder.mjs --fix --gisu 8,9        # 계획만(기본 dry-run)
 *   node scripts/ops/arena-company-folder.mjs --fix --gisu 8,9 --execute
 *
 * ## 왜 필요한가 (2026-08-31 실측)
 * belie 신고: "8기 김현민 드라이브 연결이 안 된다". 재현해 보니 `/payment` 의
 * [다시 연결] 이 `arena_folder_missing`, 수동 URL 은 `arena_folder_mismatch` 를 냈다.
 * 원인은 권한이 아니라 **폴더가 아예 없는 것**이다 —
 * `app/api/drive-link/route.ts:findArenaCompanyFolder` 는 cohorts I열
 * (companyParentFolderId) 아래에서 `세일즈PT_A{시즌}_{기수}기 {이름}_대표님 업체관리`
 * 폴더를 찾는데, 그 폴더를 만들어 줄 주체가 없다:
 *   · `scripts/ops/arena-season2-batch.mjs` — "업체관리"·createFolder 참조 **0건**
 *     (시트 복제 + O1/O2 + SA공유 + registry append 까지만 한다)
 *   · `decideArenaAction` 은 `folderName` 을 계산까지 해두고 아무도 쓰지 않는다
 * 즉 **A2 참가자 전원이 같은 갭**에 걸린다. 이 스크립트가 갭을 세고(=audit),
 * 폴더를 만들고, 수강생 시절 `01 피드백업체` 안의 업체 폴더를 그리로 옮긴다(=fix).
 *
 * ## fix 가 하는 일 (1명당)
 *   1) `세일즈PT_A{시즌}_{기수}기 {이름}_대표님 업체관리` 를 cohorts I열 아래에 생성
 *      (admin OAuth — SA 는 drive.readonly + 용량 0 이라 생성 불가, ADR-0015)
 *   2) 수강생 시절 원본 행의 시트 부모폴더에서 `01 피드백업체` 를 찾아
 *      **그 안의 항목 전부를 새 폴더로 이동**(addParents/removeParents — 복사 아님)
 *   3) registry N(driveParentPath)·O(feedbackFolderId)·P(driveLinkStatus) 스탬프
 *      → 앱이 다음 요청부터 바로 연결된 상태로 뜬다
 *
 * ## 안전 장치
 *   - **기본 dry-run.** `--execute` 없으면 계획만 출력하고 쓰기 0.
 *   - **멱등**: 폴더가 이미 있으면 생성 skip, 이미 옮겨진 항목은 목록에 안 잡힌다.
 *   - **되돌리는 법**: 이동한 항목 id 를 전부 `MOVED` 줄로 출력한다. 되돌리려면 그
 *     id 들을 원래 `01 피드백업체` 로 다시 이동(addParents/removeParents 반대)하고
 *     새 폴더를 휴지통으로 보내면 된다. **삭제는 하지 않는다** — 원본 폴더는 빈 채로 남는다.
 *   - 실패는 그 사람만 건너뛰고 계속. 마지막에 실패 목록 출력.
 *   - 비밀값 미출력. email 마스킹. (실행 로그는 GitHub Actions 에 남는다)
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── env ───────────────────────────────────────────────────────────
function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";

const has = (n) => process.argv.includes(n);
const arg = (n, fb = "") => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fb;
};

const MODE_FIX = has("--fix");
const EXECUTE = has("--execute");
const GISU_FILTER = arg("--gisu", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SEASON_FILTER = arg("--season", "2").trim();

const REG = env("SHEETS_REGISTRY_ID");
const REG_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const COHORTS_TAB = env("SHEETS_COHORTS_TAB") || "cohorts";
const FEEDBACK_PREFIX = "01 피드백업체";

const mask = (e) => (e ? String(e).replace(/^(.{2}).*(@.*)$/, "$1***$2") : "");

// SA private key 는 경로에 따라 실개행 또는 "\n" 리터럴로 온다 — 둘 다 흡수.
function normalizePem(raw) {
  const s = String(raw || "");
  return s.includes("\\n") ? s.replace(/\\n/g, "\n") : s;
}

function saAuth(scopes) {
  return new google.auth.JWT({
    email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: normalizePem(env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")),
    scopes,
  });
}
const sheets = google.sheets({
  version: "v4",
  auth: saAuth(["https://www.googleapis.com/auth/spreadsheets"]),
});
const driveRO = google.drive({
  version: "v3",
  auth: saAuth(["https://www.googleapis.com/auth/drive.readonly"]),
});

function driveRW() {
  const refresh = env("ADMIN_DRIVE_REFRESH_TOKEN");
  if (!refresh) {
    throw new Error("ADMIN_DRIVE_REFRESH_TOKEN 미설정 — Drive 생성/이동 불가(ADR-0015)");
  }
  const o = new google.auth.OAuth2(
    env("AUTH_GOOGLE_ID") || env("GOOGLE_CLIENT_ID"),
    env("AUTH_GOOGLE_SECRET") || env("GOOGLE_CLIENT_SECRET"),
  );
  o.setCredentials({ refresh_token: refresh });
  return google.drive({ version: "v3", auth: o });
}

// ── 아레나 라벨 (lib/service/cohort-token.ts 와 동일 규칙) ─────────
function parseArena(cohort) {
  const m = String(cohort || "")
    .trim()
    .replace(/기$/, "")
    .match(/^A(\d+)-(\d+)$/);
  return m ? { season: Number(m[1]), gisu: Number(m[2]) } : null;
}
const folderNameOf = (season, gisu, name) =>
  `세일즈PT_A${season}_${gisu}기 ${String(name).trim()}_대표님 업체관리`;

// ── Drive 헬퍼 ────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/'/g, "\\'");

async function findChildFolderExact(name, parentId) {
  const res = await driveRO.files.list({
    q:
      `name = '${esc(name)}' and mimeType = 'application/vnd.google-apps.folder' ` +
      `and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? [])[0] ?? null;
}

async function findChildFolderPrefix(prefix, parentId) {
  const res = await driveRO.files.list({
    q:
      `name contains '${esc(prefix)}' and mimeType = 'application/vnd.google-apps.folder' ` +
      `and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).filter((f) => (f.name || "").startsWith(prefix));
}

async function listChildren(parentId) {
  const out = [];
  let token;
  do {
    const res = await driveRO.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 200,
      pageToken: token,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    out.push(...(res.data.files ?? []));
    token = res.data.nextPageToken || undefined;
  } while (token);
  return out;
}

async function fileMeta(id) {
  try {
    const res = await driveRO.files.get({
      fileId: id,
      fields: "id, name, parents, driveId",
      supportsAllDrives: true,
    });
    return res.data;
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

// ── 레지스트리 ────────────────────────────────────────────────────
async function readRows(tab, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REG,
    range: `${tab}!${range}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

async function main() {
  if (!REG) throw new Error("SHEETS_REGISTRY_ID 미설정");

  const cohortRows = await readRows(COHORTS_TAB, "A2:J");
  const cohorts = cohortRows
    .filter((r) => String(r[0] ?? "").trim())
    .map((r) => ({
      label: String(r[0]).trim(),
      type: r[3] === "arena" ? "arena" : "cohort",
      companyParentFolderId: String(r[8] ?? "").trim(),
    }));

  const userRows = await readRows(REG_TAB, "A2:P");
  const users = userRows.map((r, i) => ({
    rowNo: i + 2,
    email: String(r[0] ?? "").trim(),
    cohort: String(r[1] ?? "").trim(),
    name: String(r[2] ?? "").trim(),
    spreadsheetId: String(r[3] ?? "").trim(),
    status: String(r[5] ?? "").trim(),
    driveParentPath: String(r[13] ?? "").trim(),
    feedbackFolderId: String(r[14] ?? "").trim(),
  }));

  const arena = users
    .map((u) => ({ ...u, a: parseArena(u.cohort) }))
    .filter((u) => u.a && u.name);

  console.log(`레지스트리 행 ${users.length} · 아레나 행 ${arena.length}`);
  const byLabel = {};
  for (const u of arena) {
    const k = `A${u.a.season}-${u.a.gisu}`;
    byLabel[k] = (byLabel[k] ?? 0) + 1;
  }
  console.log("아레나 라벨 분포:", JSON.stringify(byLabel));
  console.log(
    "cohorts 아레나 행:",
    JSON.stringify(
      cohorts
        .filter((c) => c.type === "arena")
        .map((c) => ({ label: c.label, I열: c.companyParentFolderId ? "설정" : "빈값" })),
    ),
  );

  const targets = arena.filter(
    (u) =>
      String(u.a.season) === SEASON_FILTER &&
      (GISU_FILTER.length === 0 || GISU_FILTER.includes(String(u.a.gisu))),
  );
  const scope = GISU_FILTER.length ? `기수 [${GISU_FILTER.join(",")}]` : "전체";
  console.log(`\n대상 = 시즌 A${SEASON_FILTER} · ${scope} → ${targets.length}명\n`);

  const seasonCohort = cohorts.find((c) => c.label === `A${SEASON_FILTER}`);
  const parentId = seasonCohort?.companyParentFolderId ?? "";
  console.log(
    `cohorts A${SEASON_FILTER}: ${seasonCohort ? "있음" : "**없음**"} · ` +
      `companyParentFolderId ${parentId ? "설정됨" : "**빈값**"}`,
  );
  if (!parentId) {
    console.log("→ 업체관리 폴더를 만들 부모가 없다. cohorts 탭 I열을 먼저 채워야 한다.");
    return;
  }

  const rw = MODE_FIX && EXECUTE ? driveRW() : null;
  const report = [];
  const failed = [];

  for (const u of targets) {
    const want = folderNameOf(u.a.season, u.a.gisu, u.name);
    const row = {
      name: u.name,
      cohort: u.cohort,
      rowNo: u.rowNo,
      email: mask(u.email),
      status: u.status,
    };
    try {
      // ① 새 업체관리 폴더가 있나
      const existing = await findChildFolderExact(want, parentId);
      row.newFolder = existing ? existing.id : null;

      // ② 수강생 시절 원본 행 — 같은 이름 + 아레나 아닌 행
      const origin = users.find(
        (o) =>
          o.name === u.name && o.spreadsheetId && !parseArena(o.cohort) && o.rowNo !== u.rowNo,
      );
      row.originCohort = origin?.cohort ?? null;

      // ③ 원본 시트의 부모폴더 → 01 피드백업체
      let oldFolder = null;
      if (origin?.spreadsheetId) {
        const meta = await fileMeta(origin.spreadsheetId);
        const p = meta?.parents?.[0];
        if (p) {
          const cands = await findChildFolderPrefix(FEEDBACK_PREFIX, p);
          oldFolder = cands[0] ?? null;
        } else if (meta?.error) {
          row.originSheetError = meta.error;
        }
      }
      row.oldFolder = oldFolder ? oldFolder.id : null;
      row.oldItems = oldFolder ? (await listChildren(oldFolder.id)).length : 0;

      report.push(row);

      if (!MODE_FIX) continue;

      // ── fix ─────────────────────────────────────────────────────
      let newId = existing?.id ?? null;
      if (!newId) {
        if (!EXECUTE) {
          console.log(`PLAN  생성  "${want}"  ← 부모 ${parentId}`);
        } else {
          const created = await rw.files.create({
            requestBody: {
              name: want,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentId],
            },
            fields: "id, name",
            supportsAllDrives: true,
          });
          newId = created.data.id;
          row.newFolder = newId;
          console.log(`CREATED ${newId}  "${want}"`);
        }
      } else {
        console.log(`SKIP  이미 있음  ${newId}  "${want}"`);
      }

      // 내용 이관
      if (oldFolder) {
        const kids = await listChildren(oldFolder.id);
        for (const k of kids) {
          if (!EXECUTE) {
            console.log(`PLAN  이동  "${k.name}" (${k.id})  ${oldFolder.id} → [새폴더]`);
            continue;
          }
          await rw.files.update({
            fileId: k.id,
            addParents: newId,
            removeParents: oldFolder.id,
            fields: "id, parents",
            supportsAllDrives: true,
          });
          console.log(`MOVED ${k.id}  from=${oldFolder.id}  to=${newId}  "${k.name}"`);
        }
      }

      // registry 스탬프 — N(부모경로) O(업체관리폴더) P(상태)
      if (EXECUTE && newId) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: REG,
          range: `${REG_TAB}!N${u.rowNo}:P${u.rowNo}`,
          valueInputOption: "RAW",
          requestBody: { values: [[parentId, newId, "ok"]] },
        });
        console.log(`STAMP row ${u.rowNo}  N/O/P = 부모/새폴더/ok`);
      } else if (MODE_FIX && !EXECUTE) {
        console.log(`PLAN  스탬프 row ${u.rowNo}  N=${parentId} O=[새폴더] P=ok`);
      }
    } catch (e) {
      row.error = e?.message || String(e);
      failed.push(row);
      report.push(row);
      console.log(`FAIL  ${u.name}  ${row.error}`);
    }
  }

  console.log("\n=== 감사표 ===");
  console.log("이름\t기수\t원기수\t새폴더\t구폴더\t구항목수\t비고");
  for (const r of report) {
    console.log(
      [
        r.name,
        r.cohort,
        r.originCohort ?? "-",
        r.newFolder ? "있음" : "없음",
        r.oldFolder ? "있음" : "없음",
        r.oldItems,
        r.error ? `ERR ${r.error}` : (r.originSheetError ? `원본시트 접근불가` : ""),
      ].join("\t"),
    );
  }
  const missing = report.filter((r) => !r.newFolder).length;
  console.log(`\n요약: 대상 ${report.length} · 새폴더 없음 ${missing} · 실패 ${failed.length}`);
  if (MODE_FIX && !EXECUTE) console.log("(dry-run — 쓰기 0. 실제 실행은 --execute)");
}

main().catch((e) => {
  console.error("치명 오류:", e?.message || e);
  process.exit(1);
});
