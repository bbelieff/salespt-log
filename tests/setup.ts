/**
 * Vitest setup — 테스트용 더미 환경변수.
 * lib/config/index.ts가 모듈 로드 시점에 required(...)를 호출하므로
 * 테스트에선 dummy 값을 미리 채워놓는다 (실제 시트 호출은 mock 또는 skip).
 */
const DEFAULTS: Record<string, string> = {
  AUTH_SECRET: "test-secret",
  AUTH_GOOGLE_ID: "test-google-id",
  AUTH_GOOGLE_SECRET: "test-google-secret",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@test.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "test-private-key",
  SHEETS_REGISTRY_ID: "test-registry-id",
  SHEETS_REGISTRY_TAB: "users",
};

for (const [k, v] of Object.entries(DEFAULTS)) {
  if (!process.env[k]) process.env[k] = v;
}
