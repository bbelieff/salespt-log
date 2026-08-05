/**
 * SA 시트 접근권 감사 — **읽기 전용(쓰기 0건)**. BBE-45.
 *
 * 실행:
 *   node scripts/ops/verify-sa-sheet-access.mjs --cohort 10
 *   node scripts/ops/verify-sa-sheet-access.mjs --cohort 9,10   # 비교용
 *
 * 왜 필요한가 (2026-08-06 실측 배경):
 *   앱은 수강생 시트를 **SA(service account)** 로 읽고 쓴다(`lib/repo/sheets-client.ts`).
 *   SA 가 그 시트에 접근하는 경로는 둘뿐이다:
 *     ① SA 가 **명시 편집자**로 공유돼 있다  ② **부모 폴더**가 SA 에 공유돼 상속된다
 *   둘 다 없으면 링크공유(anyone-with-link writer)에 의존하게 되는데, 이건 관리자가
 *   링크공유를 잠그는 순간 **앱 접근이 끊기는** 취약 상태다.
 *
 *   설계 이력(중요): 2026-05-12 `704ac5c` 가 SA 자동 공유를 넣었다가 같은 날 `fe4a0b8` 이
 *   **"폴더를 한 번 공유하면 그 안 시트는 상속되므로 자동화 불필요"** 라는 근거로 걷어냈다.
 *   즉 현행 설계의 전제는 **"기수 폴더가 SA 에 공유돼 있다"** 이다. 이 스크립트는 그 전제가
 *   실제로 성립하는지를 기수 단위로 검증한다.
 *
 * 수리(선택): `--execute` 를 붙이면 부족한 시트에 SA 편집자 공유를 **추가**한다.
 *   node scripts/ops/verify-sa-sheet-access.mjs --cohort 10 --execute
 *   · 파일 소유자 자격이 필요하므로 **ADMIN_DRIVE_REFRESH_TOKEN**(관리자 OAuth)을 쓴다(ADR-0015).
 *     그 토큰에 `drive` 쓰기 scope 가 없으면 여기서 PERMISSION_DENIED 로 드러난다.
 *   · 권한을 **추가만** 한다 — 기존 공유·링크공유·파일 내용은 건드리지 않는다. 멱등(이미 있으면 skip).
 *   · 되돌리기: Drive 공유 대화상자에서 해당 SA 를 제거(또는 permissions.delete).
 *
 * 출력: 기수별 시트 1행 = 명시공유 / 폴더상속 / 링크공유 판정 + 폴더 요약.
 * 종료코드: 0 = 전원 안전(①또는②) · 1 = 링크공유에만 의존하는 시트 있음 · 2 = env/인자 오류.
 * ★비밀값 미출력 — SA 키·admin 토큰·시트ID 전체값·수강생 이메일은 찍지 않는다(끝 6자리 마스킹).
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── env (.env → .env.local 순으로 병합, 뒤가 우선) ──
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

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? "") : "";
};
const COHORTS = argOf("--cohort")
  .split(",")
  .map((s) => s.replace(/기\s*$/, "").trim())
  .filter(Boolean);
if (COHORTS.length === 0) {
  console.error("❌ --cohort 필요 — 예: --cohort 10  또는  --cohort 9,10");
  process.exit(2);
}

const EXECUTE = process.argv.includes("--execute");

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const REGISTRY_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error(
    "❌ SA/레지스트리 env 누락 — 레포 루트(.env.local 보유)에서 실행하세요.\n" +
      "   키 형식: 1줄 + 리터럴 \\n (따옴표 허용).",
  );
  process.exit(2);
}
// 셸에 남은 옛 변수가 .env.local 을 조용히 이기는 사고 차단(finalize-cohort10 선례).
if (
  process.env.SHEETS_REGISTRY_ID &&
  fileEnv.SHEETS_REGISTRY_ID &&
  process.env.SHEETS_REGISTRY_ID !== fileEnv.SHEETS_REGISTRY_ID
) {
  console.error("❌ 셸 SHEETS_REGISTRY_ID 가 .env.local 과 다릅니다 — 확정 후 재실행.");
  process.exit(2);
}

// 읽기 전용 scope 만 요청한다 — 이 스크립트가 쓰기를 할 수 없음을 인증 단계에서 보장.
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

/**
 * 수리용 Drive 클라이언트 — 파일 **소유자(admin OAuth)** 자격이어야 공유를 추가할 수 있다.
 * SA 는 자기 자신에게 권한을 줄 수 없다. `--execute` 일 때만 만든다(읽기 실행에는 토큰 불요).
 */
function adminDrive() {
  const refresh = env("ADMIN_DRIVE_REFRESH_TOKEN");
  const cid = env("AUTH_GOOGLE_ID");
  const csec = env("AUTH_GOOGLE_SECRET");
  if (!refresh || !cid || !csec) {
    console.error(
      "❌ --execute 에는 ADMIN_DRIVE_REFRESH_TOKEN·AUTH_GOOGLE_ID·AUTH_GOOGLE_SECRET 이 필요합니다(ADR-0015).\n" +
        "   토큰은 GitHub Secrets → 배포 시 VPS `.env` 로 주입되므로 **VPS 에서 실행**하세요.",
    );
    process.exit(2);
  }
  const oauth = new google.auth.OAuth2(cid, csec);
  oauth.setCredentials({ refresh_token: refresh });
  return google.drive({ version: "v3", auth: oauth });
}

const tail = (s) => (s ? `…${String(s).slice(-6)}` : "(없음)");
const pad = (s, n) => String(s).padEnd(n, " ");

/** 레지스트리에서 대상 행 발견 — cohort 정규화("10기"·" 10" 흡수) 후 정확 일치. */
async function targets() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range: `'${REGISTRY_TAB}'!A2:D`,
  });
  return (res.data.values ?? [])
    .map((r, i) => ({
      row: i + 2,
      cohort: String(r?.[1] ?? "").replace(/기\s*$/, "").trim(),
      name: String(r?.[2] ?? "").trim(),
      sid: String(r?.[3] ?? "").trim(),
    }))
    .filter((u) => u.sid && COHORTS.includes(u.cohort));
}

/**
 * 파일 1건의 접근 경로 판정.
 * ⚠️ SA 가 그 파일에 아예 접근 못 하면 files.get 자체가 404 로 떨어진다 — 그 경우도
 *    "접근 불가"라는 **관측 결과**이므로 삼키지 않고 그대로 올린다.
 */
async function inspect(fileId) {
  try {
    const meta = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: "id,name,parents,owners(emailAddress)",
    });
    let perms = null;
    let permErr = "";
    try {
      const p = await drive.permissions.list({
        fileId,
        supportsAllDrives: true,
        fields: "permissions(type,role,emailAddress,domain,allowFileDiscovery)",
      });
      perms = p.data.permissions ?? [];
    } catch (e) {
      // 공유목록 조회는 더 높은 권한을 요구할 수 있다 — 접근 가능 여부와는 별개.
      permErr = String(e?.message ?? e).slice(0, 60);
    }
    return { ok: true, meta: meta.data, perms, permErr };
  } catch (e) {
    return { ok: false, err: String(e?.message ?? e).slice(0, 80) };
  }
}

const hasSA = (perms) =>
  Array.isArray(perms) &&
  perms.some((p) => p.type === "user" && String(p.emailAddress).toLowerCase() === SA_EMAIL.toLowerCase());
const hasAnyoneWriter = (perms) =>
  Array.isArray(perms) && perms.some((p) => p.type === "anyone" && (p.role === "writer" || p.role === "owner"));

async function main() {
  const rows = await targets();
  if (rows.length === 0) {
    console.error(`❌ 레지스트리에서 기수 ${COHORTS.join(",")} 행을 찾지 못했습니다.`);
    process.exit(2);
  }
  console.log(`\n▶ SA 접근권 감사 (읽기 전용) — 기수 ${COHORTS.join(",")} · 대상 ${rows.length}건`);
  console.log(`  SA: ${tail(SA_EMAIL)}\n`);

  const folderCache = new Map();
  const weakRows = [];
  let weak = 0;

  console.log(`  ${pad("기수", 5)}${pad("이름", 9)}${pad("시트", 9)}${pad("SA명시", 8)}${pad("폴더상속", 9)}${pad("링크공유", 9)}판정`);
  console.log(`  ${"-".repeat(62)}`);

  for (const t of rows) {
    const f = await inspect(t.sid);
    if (!f.ok) {
      weak++;
      console.log(`  ${pad(t.cohort, 5)}${pad(t.name, 9)}${pad(tail(t.sid), 9)}${pad("-", 8)}${pad("-", 9)}${pad("-", 9)}❌ SA 접근 불가 (${f.err})`);
      continue;
    }
    const parent = f.meta.parents?.[0] ?? "";
    if (parent && !folderCache.has(parent)) folderCache.set(parent, await inspect(parent));
    const pf = parent ? folderCache.get(parent) : null;

    const saDirect = hasSA(f.perms);
    const saFolder = pf?.ok ? hasSA(pf.perms) : false;
    const linkOnly = hasAnyoneWriter(f.perms) || (pf?.ok ? hasAnyoneWriter(pf.perms) : false);
    const safe = saDirect || saFolder;
    if (!safe) {
      weak++;
      weakRows.push(t);
    }

    console.log(
      `  ${pad(t.cohort, 5)}${pad(t.name, 9)}${pad(tail(t.sid), 9)}` +
        `${pad(saDirect ? "O" : "X", 8)}${pad(saFolder ? "O" : "X", 9)}${pad(linkOnly ? "O" : "X", 9)}` +
        (safe ? "✅ 안전" : "⚠️ 링크공유 의존"),
    );
  }

  console.log(`\n  ── 부모 폴더 요약 ──`);
  for (const [id, pf] of folderCache) {
    if (!pf.ok) {
      console.log(`  폴더 ${tail(id)} — ❌ SA 접근 불가 (${pf.err})`);
      continue;
    }
    console.log(
      `  폴더 ${tail(id)} "${pf.meta.name ?? "?"}" — SA 공유 ${hasSA(pf.perms) ? "O" : "X"}` +
        ` · 링크공유(writer) ${hasAnyoneWriter(pf.perms) ? "O" : "X"}` +
        (pf.permErr ? ` · 공유목록 조회 실패(${pf.permErr})` : ""),
    );
  }

  if (weak === 0) {
    console.log(`\n✅ 전원 안전 — 명시공유 또는 폴더상속으로 SA 접근이 보장됩니다.\n`);
    return;
  }

  console.log(
    `\n❌ 링크공유에만 의존하는 시트 ${weak}건 — 링크공유를 잠그면 앱 접근이 끊깁니다.` +
      `\n   근본 조치: 해당 **부모 폴더**를 SA(${tail(SA_EMAIL)})에 편집자로 공유하면 하위 시트가 상속받습니다.` +
      `\n   (폴더 공유가 현행 설계의 전제 — fe4a0b8 근거. 새 폴더까지 한 번에 덮음)`,
  );

  if (!EXECUTE) {
    console.log(`   즉시 조치(시트 개별 공유): 같은 명령에 --execute 추가 (권한 추가만·멱등)\n`);
    process.exit(1);
  }

  // ── 수리: 부족한 시트에 SA 편집자 공유 추가 (권한 추가만) ──
  console.log(`\n▶ --execute — 부족한 시트에 SA 편집자 공유 추가 (${weakRows.length}건)`);
  const adrive = adminDrive();
  let done = 0;
  let failed = 0;
  for (const t of weakRows) {
    try {
      await adrive.permissions.create({
        fileId: t.sid,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        requestBody: { type: "user", role: "writer", emailAddress: SA_EMAIL },
      });
      done++;
      console.log(`  ✅ ${pad(t.name, 9)}${tail(t.sid)} — SA 공유 추가`);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/already|duplicate/i.test(msg)) {
        done++;
        console.log(`  ✅ ${pad(t.name, 9)}${tail(t.sid)} — 이미 공유돼 있음(멱등)`);
        continue;
      }
      failed++;
      console.log(`  ❌ ${pad(t.name, 9)}${tail(t.sid)} — ${msg.slice(0, 70)}`);
    }
  }
  console.log(`\n  완료 ${done} · 실패 ${failed}`);
  if (failed > 0) {
    console.log(
      `  ⚠️ 실패가 남았습니다. PERMISSION_DENIED 계열이면 admin OAuth 토큰의 쓰기(scope) 문제 —\n` +
        `     BBE-72(토큰 scope 실측)와 같은 근인일 수 있습니다. 그 확정 후 재실행하세요.\n`,
    );
    process.exit(1);
  }
  console.log(`  → 재실측: 같은 명령에서 --execute 를 빼고 다시 실행\n`);
}

main().catch((e) => {
  console.error("실행 실패:", e?.message ?? e);
  process.exit(2);
});
