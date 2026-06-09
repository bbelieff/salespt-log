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
 *   → 출력된 URL 을 belie 계정으로 열어 동의 → 콘솔에 refresh_token 출력.
 *   → .env.local 과 VPS env 에 ADMIN_DRIVE_REFRESH_TOKEN=<값> 추가.
 */
import { readFileSync } from "node:fs";
import http from "node:http";
import { google } from "googleapis";

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
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("완료 — 콘솔의 refresh_token 을 확인하세요. 이 창은 닫아도 됩니다.");
    console.log("\n=== ADMIN_DRIVE_REFRESH_TOKEN ===");
    console.log(tokens.refresh_token ?? "(refresh_token 없음 — prompt=consent 재시도)");
    console.log("=================================\n");
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
