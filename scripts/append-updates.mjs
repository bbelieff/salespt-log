/**
 * 배포 시 새소식 자동 수집 (announcement-popup §2) — VPS에서 deploy.yml 이 실행.
 *
 * master 최근 squash 커밋에서 PR번호를 추출해 레지스트리 `updates` 탭에
 * **없는 것만 append** (멱등 — pr 키 대조). 실패해도 배포는 성공 처리
 * (deploy.yml 에서 non-blocking) — 다음 배포에서 재시도된다.
 *
 * 이 레포의 squash 커밋 형태 (git log 실측, 2026-06-11):
 *   정상:   "feat(scope): 제목 (#N)"  — conventional 제목 + PR번호
 *   변형:   "@ (#N)"                  — 제목이 깨진 과거 커밋. 실제 제목은 본문 첫 줄.
 * title_user = 본문 `Changelog:` 줄 (CLAUDE.md PR Changelog 규약), 없으면
 * 제목에서 type 접두어를 뗀 fallback. visible 기본: feat·fix=TRUE, 그 외 FALSE.
 *
 * env: process.env 우선, 없으면 .env.local → .env 파싱 (VPS = /opt/salespt-log).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── env ──────────────────────────────────────────────────────────
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
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("append-updates: SHEETS_REGISTRY_ID / SA 자격을 찾지 못했습니다.");
  process.exit(1);
}

// ── 커밋 파싱 (순수 — 형태는 파일 헤더 주석 참고) ─────────────────
function parseCommit(dateISO, subject, body) {
  const prMatch = subject.match(/\(#(\d+)\)\s*$/);
  if (!prMatch) return null;
  const pr = Number(prMatch[1]);

  let title = subject.replace(/\s*\(#\d+\)\s*$/, "").trim();
  if (!title || title === "@") {
    // 제목 깨진 변형 — 본문 첫 비공백 줄이 실제 제목
    title = (body.split("\n").map((l) => l.trim()).find(Boolean) ?? "").trim();
  }

  const typeMatch = title.match(/^(feat|fix|perf|chore|docs|refactor)\b/i);
  const type = typeMatch ? typeMatch[1].toLowerCase() : "";

  const clMatch = body.match(/^Changelog:\s*(.+)$/im);
  const titleUser = clMatch
    ? clMatch[1].trim()
    : title.replace(/^(feat|fix|perf|chore|docs|refactor)(\([^)]*\))?!?:\s*/i, "").trim();

  const visible = type === "feat" || type === "fix" ? "TRUE" : "FALSE";
  return { pr, date: dateISO, type, titleUser, visible };
}

function recentMergeCommits(limit = 50) {
  // %x1f=unit sep, %x1e=record sep — 본문 멀티라인 안전 분리. %cs=YYYY-MM-DD.
  const raw = execFileSync(
    "git",
    ["log", `-${limit}`, "--format=%cs%x1f%s%x1f%b%x1e"],
    { encoding: "utf8" },
  );
  const out = [];
  for (const rec of raw.split("\x1e")) {
    const [date, subject, body] = rec.trim().split("\x1f");
    if (!subject) continue;
    const parsed = parseCommit(date ?? "", subject, body ?? "");
    if (parsed) out.push(parsed);
  }
  return out;
}

// ── 시트 I/O (updates 탭 — append 전용, 기존 셀 비접촉) ───────────
async function main() {
  const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  const sheets = google.sheets({ version: "v4", auth });

  // 탭 보장 (멱등) + 헤더
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: REGISTRY_ID,
    fields: "sheets(properties(title))",
  });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === "updates");
  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: REGISTRY_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: "updates" } } }] },
      });
    } catch (e) {
      if (!String(e?.message ?? "").includes("already exists")) throw e;
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: REGISTRY_ID,
      range: "'updates'!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["pr", "date", "type", "title_user", "body_md", "milestone", "visible"]],
      },
    });
  }

  // 기존 pr 목록 (멱등 가드)
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: REGISTRY_ID,
    range: "'updates'!A2:A",
  });
  const seen = new Set(
    (existing.data.values ?? []).map((r) => String(r[0] ?? "").trim()).filter(Boolean),
  );

  const commits = recentMergeCommits();
  const fresh = commits
    .filter((c) => !seen.has(String(c.pr)))
    .sort((a, b) => a.pr - b.pr); // 오래된 것부터 — 시트 시간순 유지

  if (fresh.length === 0) {
    console.log(`append-updates: 신규 0건 (스캔 ${commits.length}, 기존 ${seen.size})`);
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: REGISTRY_ID,
    range: "'updates'!A1:G",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: fresh.map((c) => [c.pr, c.date, c.type, c.titleUser, "", "", c.visible]),
    },
  });
  console.log(
    `append-updates: ${fresh.length}건 append — ${fresh.map((c) => `#${c.pr}`).join(", ")}`,
  );
}

main().catch((e) => {
  console.error("append-updates 실패:", e?.message ?? e);
  process.exit(1);
});
