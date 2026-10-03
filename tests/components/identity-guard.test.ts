/**
 * 탭 신원 가드 회귀 테스트.
 *
 * 배경(2026-09-01 belie 신고 · 실제 화면 확인): 상단은 `A2-8기 김현민`인데 계약 목록은
 * 문병규 님 것이 떴다. 대리접속 신원(`salespt_as`)은 httpOnly 쿠키(path=/)라 브라우저
 * 전체가 공유하는데, 전환은 **새 탭을 여는 방식**이라 먼저 열어둔 탭도 함께 바뀐다.
 * 저장도 같은 쿠키를 쓰므로(`getWritableUserEmail`) 낡은 탭의 저장이 **다른 사람 기록에
 * 써진다** — 그래서 알림이 아니라 조작 자체를 막아야 한다.
 *
 * 여기서 못 박는 것:
 *   ① 지문이 달라지면 막는다
 *   ② ★지문을 못 받으면(오프라인·401) 막지 않는다 — 가드가 화면을 인질로 잡으면 안 된다
 *   ③ ★`/api/whoami` 는 이메일 원문을 내보내지 않는다(지문 + 마스킹만)
 *   ④ ★자동 새로고침을 걸지 않는다 — 입력 중이던 내용이 날아간다
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shouldBlockTab } from "@/components/auth/IdentityGuard";

describe("shouldBlockTab — 탭 신원 판정", () => {
  it("탭이 열릴 때와 지금이 같은 사람이면 막지 않는다", () => {
    expect(shouldBlockTab("abc123", "abc123")).toBe(false);
  });

  it("★다른 사람으로 바뀌었으면 막는다", () => {
    expect(shouldBlockTab("abc123", "def456")).toBe(true);
  });

  it("★아직 첫 지문을 못 받았으면 막지 않는다 — 첫 렌더에서 깜빡이지 않게", () => {
    expect(shouldBlockTab(null, "def456")).toBe(false);
  });

  it("★지금 지문을 못 받았으면 막지 않는다 — 오프라인·401 에서 오탐 금지", () => {
    expect(shouldBlockTab("abc123", null)).toBe(false);
    expect(shouldBlockTab(null, null)).toBe(false);
  });
});

describe("★소스 가드", () => {
  const guard = readFileSync("components/auth/IdentityGuard.tsx", "utf8");
  const whoami = readFileSync("app/api/whoami/route.ts", "utf8");

  it("가드는 (app) 셸에 실제로 걸려 있다 — 파일만 있고 안 쓰면 의미 없다", () => {
    const layout = readFileSync("app/(app)/layout.tsx", "utf8");
    expect(layout).toContain("IdentityGuard");
    expect(layout).toContain("<IdentityGuard />");
  });

  it("★자동 새로고침을 걸지 않는다 — 사용자가 버튼을 누른다(입력 유실 방지)", () => {
    // reload 는 onClick 핸들러 안에만 있어야 한다. useEffect 안에서 부르면 입력이 날아간다.
    const inEffect = guard.slice(guard.indexOf("useEffect("), guard.indexOf("if (!shouldBlockTab"));
    expect(inEffect).not.toContain("location.reload");
    expect(guard).toContain("onClick={() => window.location.reload()}");
  });

  it("★whoami 는 이메일 원문을 내보내지 않는다 — 지문 + 마스킹만", () => {
    expect(whoami).toContain("createHash");
    expect(whoami).toMatch(/activeFingerprint/);
    expect(whoami).toMatch(/activeMasked/);
    // 응답 본문에 원문 이메일 필드를 싣지 않는다.
    const body = whoami.slice(whoami.indexOf("NextResponse.json("));
    expect(body).not.toMatch(/\bemail:\s/);
  });

  it("★whoami 는 캐시되지 않는다 — 낡은 값이면 가드가 무의미하다", () => {
    expect(whoami).toContain("no-store");
  });

  it("★whoami 는 시트·DB 를 읽지 않는다 — 30초마다 도는 경로다", () => {
    expect(whoami).not.toMatch(/readBundle|loadMe|sheetsClient|@\/repo\//);
  });
});
