/**
 * 일회용 헬퍼 — 관리자(belie) Google Drive refresh token 발급 (ADR-0015).
 *
 * 왜: SA(masterbot)는 Drive 용량 0 → My-Drive 공유 폴더에 시트/폴더를 *소유*하며
 *     만들 수 없음. 시트 복제·폴더 생성만 belie OAuth 로 수행하려면 belie 의
 *     refresh token 이 필요하다. 이 토큰을 ADMIN_DRIVE_REFRESH_TOKEN 에 저장.
 *
 * 선행(1회): GCP 콘솔 → 해당 OAuth 클라이언트(AUTH_GOOGLE_ID) → 승인된 리디렉션 URI 에
 *            `http://localhost:5858/oauth2callback` 추가.
 *
 * 실행:  node scripts/get-admin-drive-token.mjs
 *   → 출력된 URL 을 belie 계정으로 열어 동의 → refresh_token 이 **클립보드에 복사**됨.
 *   → GitHub Secret `ADMIN_DRIVE_REFRESH_TOKEN` 값 칸에 Ctrl+V (플레이북: deploy-vps.md "Secret 추가 절차").
 *
 * ⚠️ 원칙: **비밀값(refresh_token)은 콘솔에 출력하지 않는다** — 클립보드로만 전달(터미널 스크롤백
 *          잔존 방지). 클립보드 복사 실패 시에만 콘솔 fallback.
 */
import { readFileSync } from "node:fs";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { google } from "googleapis";

/** 비밀값을 콘솔에 찍지 않고 OS 클립보드로 복사. 의존성 무추가(OS 내장). 성공 true / 실패 false. */
function copyToClipboard(text) {
  const p = process.platform;
  const cmd = p === "win32" ? "clip" : p === "darwin" ? "pbcopy" : "xclip";
  const args = p === "win32" || p === "darwin" ? [] : ["-selection", "clipboard"];
  try {
    const r = spawnSync(cmd, args, { input: text });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

const env = readFileSync(".env.local", "utf8").replace(/\r/g, "");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  if (!m) return "";
  let v = m[1].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v;
};

const clientId = get("AUTH_GOOGLE_ID");
const clientSecret = get("AUTH_GOOGLE_SECRET");
if (!clientId || !clientSecret) {
  console.error("AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET 를 .env.local 에서 찾지 못했습니다.");
  process.exit(1);
}

const PORT = 5858;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
const url = oauth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // refresh_token 강제 발급
  scope: ["https://www.googleapis.com/auth/drive"],
});

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("no code");
    return;
  }
  try {
    const { tokens } = await oauth.getToken(code);
    const token = tokens.refresh_token;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("완료 — 이 창은 닫고, 터미널 안내를 확인하세요.");
    if (!token) {
      console.error("\n⚠️ refresh_token 이 없습니다 — Google 계정에서 앱 권한을 해제한 뒤 재실행하세요(prompt=consent).");
    } else if (copyToClipboard(token)) {
      // 비밀값은 콘솔에 찍지 않는다 — 클립보드로만 전달.
      console.log("\n✅ 토큰이 클립보드에 복사되었습니다 — GitHub Secret 값 칸에 Ctrl+V 하세요.");
      console.log("   (Secret Name: ADMIN_DRIVE_REFRESH_TOKEN)\n");
    } else {
      // 클립보드 복사 실패 시에만 콘솔 fallback.
      console.log("\n(클립보드 복사 실패 — 아래 값을 직접 복사해 Secret 값 칸에 붙여넣으세요)");
      console.log("=== ADMIN_DRIVE_REFRESH_TOKEN ===");
      console.log(token);
      console.log("=================================\n");
    }
  } catch (e) {
    res.writeHead(500).end(String(e?.message ?? e));
    console.error("token 교환 실패:", e?.message ?? e);
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 500);
  }
});

server.listen(PORT, () => {
  console.log(`리디렉션 대기 중: ${REDIRECT}`);
  console.log("\n아래 URL 을 belie Google 계정으로 열어 동의하세요:\n");
  console.log(url + "\n");
});
