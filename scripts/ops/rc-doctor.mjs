#!/usr/bin/env node
/**
 * scripts/ops/rc-doctor.mjs — 원격 제어(Remote Control) 연결 진단.
 *
 * 폰·웹 「코드」 목록에 세션이 안 뜨거나 자꾸 「연결 해제됨」이 될 때, 내 PC 에서 한 번 돌린다.
 * 읽기 전용 — 아무것도 고치지 않고, 무엇을 어떻게 고칠지만 찍는다.
 *
 *   node scripts/ops/rc-doctor.mjs
 *
 * 근거: docs/playbooks/remote-control-sessions.md · https://code.claude.com/docs/en/remote-control
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const rows = [];
const add = (level, title, detail, fix) => rows.push({ level, title, detail, fix });

/** JSON 설정 파일을 조용히 읽는다. 없거나 깨졌으면 null. */
function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    add("FAIL", `${path} 파싱 실패`, "JSON 문법이 깨졌다 — 이 파일의 설정이 통째로 무시된다.", "쉼표·따옴표를 확인해 고친다.");
    return null;
  }
}

// ── 1. 원격 제어를 아예 막는 환경변수 ────────────────────────────
// 출처: 공식 문서 Requirements — API 키·커스텀 엔드포인트·피처플래그 차단은 연결 자체를 막는다.
const blockers = [
  ["ANTHROPIC_API_KEY", "API 키로 로그인되면 원격 제어를 쓸 수 없다(claude.ai 계정 로그인 필요).", "이 변수를 지운 뒤 `claude auth login` 으로 claude.ai 로그인."],
  ["DISABLE_TELEMETRY", "원격 제어 사용 가능 여부를 판단하는 피처플래그 조회가 꺼진다.", "이 변수를 해제한다(셸 환경 · settings.json 의 env 블록 둘 다 확인)."],
  ["DO_NOT_TRACK", "위와 같은 피처플래그 조회 차단.", "이 변수를 해제한다."],
  ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "위와 같은 피처플래그 조회 차단.", "이 변수를 해제한다."],
  ["DISABLE_GROWTHBOOK", "위와 같은 피처플래그 조회 차단.", "이 변수를 해제한다."],
];
for (const [name, why, fix] of blockers) {
  if (process.env[name]) add("FAIL", `${name} 가 설정돼 있다`, why, fix);
}

const baseUrl = process.env.ANTHROPIC_BASE_URL;
if (baseUrl && !/^https?:\/\/api\.anthropic\.com\/?$/.test(baseUrl.trim())) {
  add("FAIL", `ANTHROPIC_BASE_URL 이 api.anthropic.com 이 아니다 (${baseUrl})`,
    "LLM 게이트웨이·프록시를 거치면 짝지을 claude.ai 백엔드가 없어 원격 제어가 안 된다.",
    "이 변수를 해제한다. Bedrock·Vertex·Foundry 를 쓰는 세션도 같은 이유로 불가.");
}
if (rows.length === 0) add("OK", "환경변수 차단 없음", "원격 제어를 막는 변수가 하나도 설정돼 있지 않다.");

// ── 2. 자동 연결 설정 (안 끊기게 하는 핵심 스위치) ───────────────
const userSettingsPath = join(homedir(), ".claude", "settings.json");
const user = readJson(userSettingsPath);
const autoConnect = user?.remoteControlAtStartup;
if (autoConnect === true) {
  add("OK", "자동 연결 켜짐", `${userSettingsPath} · remoteControlAtStartup: true — 여는 세션마다 폰 목록에 자동으로 뜬다.`);
} else {
  add("WARN", "자동 연결이 꺼져 있다",
    `${userSettingsPath} 에 remoteControlAtStartup 가 ${autoConnect === undefined ? "없다" : JSON.stringify(autoConnect)}. 매번 /remote-control 을 직접 쳐야 하고, 깜빡하면 폰에서 안 보인다.`,
    `\`claude\` → \`/config\` → **Enable Remote Control for all sessions** = true. 또는 ${userSettingsPath} 에 {"remoteControlAtStartup": true}`);
}

if (user?.disableRemoteControl === true) {
  add("FAIL", "disableRemoteControl: true", "설정으로 원격 제어를 통째로 꺼놨다.", `${userSettingsPath} 에서 이 줄을 지운다.`);
}

// 프로젝트 설정의 false 는 사용자 설정의 true 를 이긴다 — 여기서만 막히는 함정.
for (const rel of [".claude/settings.json", ".claude/settings.local.json"]) {
  const proj = readJson(join(process.cwd(), rel));
  if (proj?.remoteControlAtStartup === false) {
    add("FAIL", `${rel} 이 자동 연결을 끄고 있다`,
      "프로젝트 설정의 false 는 내 PC 설정의 true 를 이긴다 — 이 레포에서만 연결이 안 된다.",
      `${rel} 에서 "remoteControlAtStartup": false 를 지운다.`);
  }
  if (proj?.remoteControlAtStartup === true) {
    add("WARN", `${rel} 의 remoteControlAtStartup: true 는 무시된다`,
      "체크인된 파일이 남의 PC 를 마음대로 연결시키지 못하게 막혀 있다.",
      `이 줄을 지우고 ${userSettingsPath} 에 넣는다.`);
  }
}

// ── 3. CLI 존재·버전 ─────────────────────────────────────────────
try {
  const version = execFileSync("claude", ["--version"], { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  add("OK", "claude CLI 확인", version);
} catch {
  add("WARN", "claude CLI 를 실행하지 못했다",
    "PATH 에 없거나 응답이 없다. (클라우드 세션·컨테이너 안에서 돌리면 정상적으로 이렇게 뜬다)",
    "내 PC 에서 돌렸는데도 이 줄이 뜨면 Claude Code 를 다시 설치하거나 `claude update` 한다.");
}

// ── 4. 윈도우 절전/최대 절전 (프로세스를 죽이는 쪽만 경고) ────────
if (process.platform === "win32") {
  add("WARN", "윈도우 자동 재시작 확인",
    "잠자기는 자동 복구되지만, 윈도우 업데이트 자동 재시작은 claude 프로세스를 죽여 세션을 끊는다.",
    "설정 → Windows 업데이트 → 고급 옵션 → **활성 시간**을 작업 시간대로 지정한다.");
}

// ── 출력 ─────────────────────────────────────────────────────────
const icon = { OK: "✔", WARN: "⚠", FAIL: "✘" };
console.log("\n원격 제어 진단 (rc-doctor)\n" + "─".repeat(48));
for (const r of rows) {
  console.log(`${icon[r.level]} [${r.level}] ${r.title}`);
  if (r.detail) console.log(`    ${r.detail}`);
  if (r.fix) console.log(`    → 고치는 법: ${r.fix}`);
}
const fails = rows.filter((r) => r.level === "FAIL").length;
const warns = rows.filter((r) => r.level === "WARN").length;
console.log("─".repeat(48));
console.log(fails
  ? `❌ 연결을 막는 문제 ${fails}건 (경고 ${warns}건). 위 「고치는 법」부터 처리한다.`
  : warns
    ? `⚠ 연결은 되지만 잘 끊길 소지 ${warns}건. 자세한 배경 = docs/playbooks/remote-control-sessions.md`
    : "✅ 문제 없음. 창만 안 닫으면 연결이 유지된다.");
console.log("");
process.exit(fails ? 1 : 0);
