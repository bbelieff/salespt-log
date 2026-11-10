import { vi } from "vitest";

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

// ADR-0038 5단계: 운영의 「시트에서 떼어 낸 기수」 목록이 바뀌어도 기존 단위 시험은 시트가 붙은
// 기존 동작을 그대로 검증한다(목록이 차면 판정이 명단을 읽어 모킹 순서가 밀린다). 떼어 내기 동작은
// 자기 목록을 모킹하는 전용 시험(tests/service/sheet-detach-screens·tests/repo/sheet-detach)이 본다.
vi.mock("@/config/sheet-detach", () => ({ SHEET_DETACHED_COHORTS: new Set<string>() }));
