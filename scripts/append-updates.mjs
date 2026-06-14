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
 * 제목에서 type 접두어를 뗀 fallback. visible 기본(P15): 사용자용 `Changelog:` 줄이
 * 있는 feat·fix 만 TRUE. 내부전용(Changelog 없음)·docs·chore·refactor 는 FALSE.
 *
 * 묶음(announcement-popup §7, grouped-updates):
 *   `Changelog-Group: <키>` → milestone 컬럼(F)에 그룹 키 적재 + visible=FALSE
 *     (반쪽 기능 노출 방지 — 그룹이 끝나기 전까지 수강생에게 안 보임).
 *   `Changelog-Done` 줄이 있는 커밋이 들어오면 그 그룹(milestone=키) 전체
 *     행의 visible 을 TRUE 로 전환 (멱등 — 이미 TRUE 면 무시. 대상 셀 = 자기
 *     그룹 행의 G열만, §2.5).
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
export function parseCommit(dateISO, subject, body) {
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

  const groupMatch = body.match(/^Changelog-Group:\s*(.+)$/im);
  const group = groupMatch ? groupMatch[1].trim() : "";
  const done = /^Changelog-Done\s*$/im.test(body);

  // 기본 노출 규칙(P15): **사용자 체감 항목만** 기본 TRUE = 사용자용 `Changelog:` 줄이
  // 있는 feat/fix. docs·chore·refactor·내부전용 fix(Changelog 없음)는 FALSE 기본.
  // 그룹 PR 은 일단 숨김(반쪽 기능 가드) — Done 커밋이 그룹 전체를 켠다.
  // 관리자는 UI 토글로 개별 override.
  const hasUserChangelog = clMatch !== null;
  const visible =
    group || !hasUserChangelog
      ? "FALSE"
      : type === "feat" || type === "fix"
        ? "TRUE"
        : "FALSE";
  return { pr, date: dateISO, type, titleUser, visible, group, done };
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

  if (fresh.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: REGISTRY_ID,
      range: "'updates'!A1:G",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: fresh.map((c) => [c.pr, c.date, c.type, c.titleUser, "", c.group, c.visible]),
      },
    });
    console.log(
      `append-updates: ${fresh.length}건 append — ${fresh.map((c) => `#${c.pr}`).join(", ")}`,
    );
  } else {
    console.log(`append-updates: 신규 0건 (스캔 ${commits.length}, 기존 ${seen.size})`);
  }

  // Done 그룹 전환 — 스캔 범위 내 Changelog-Done 커밋의 그룹을 전부 TRUE 로 (멱등).
  const doneGroups = [...new Set(commits.filter((c) => c.done && c.group).map((c) => c.group))];
  if (doneGroups.length > 0) {
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: REGISTRY_ID,
      range: "'updates'!A2:G",
    });
    const flips = [];
    (rows.data.values ?? []).forEach((r, i) => {
      const milestone = String(r[5] ?? "").trim();
      const vis = String(r[6] ?? "").trim().toUpperCase();
      if (doneGroups.includes(milestone) && vis !== "TRUE") {
        flips.push({ range: `'updates'!G${i + 2}`, values: [["TRUE"]] });
      }
    });
    if (flips.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: REGISTRY_ID,
        requestBody: { valueInputOption: "RAW", data: flips },
      });
      console.log(
        `append-updates: 그룹 공개 전환 — [${doneGroups.join(", ")}] ${flips.length}행 visible=TRUE`,
      );
    }
  }
}

// 직접 실행 시에만 main (vitest 의 parseCommit import 와 분리)
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("append-updates 실패:", e?.message ?? e);
    process.exit(1);
  });
}
