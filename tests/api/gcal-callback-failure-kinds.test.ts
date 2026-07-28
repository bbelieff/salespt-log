/**
 * gcal 연동 실패 사유 분류 — "원인을 삼키는 일반 폴백" 재발 방지(2026-07-28 진단).
 *
 * 이전엔 모든 실패가 `?gcal=error` 하나로 뭉쳐 사용자·서버 로그 어느 쪽에서도 원인을
 * 알 수 없었다. 분류기가 알려진 원인을 사용자 행동으로 이어지는 사유로 갈라야 한다.
 */
import { describe, expect, it } from "vitest";
import { classifyGcalFailure } from "@/service/gcal-failure";

describe("classifyGcalFailure (연동 실패 사유 분류)", () => {
  it("registry 행 없음 → unregistered (승인 전 계정 안내)", () => {
    // lib/repo/users.ts updateUserCell 이 실제로 던지는 문구.
    expect(
      classifyGcalFailure("[users] email a@b.com 을 registry 에서 찾을 수 없습니다."),
    ).toBe("unregistered");
  });

  it("refresh_token 미수신 → noconsent (구글 화면에서 허용 유도)", () => {
    // lib/repo/gcal-oauth.ts exchangeCodeForToken 이 던지는 문구.
    expect(
      classifyGcalFailure("[gcal-oauth] refresh_token 미수신 — 재동의 필요(access_type/prompt 확인)"),
    ).toBe("noconsent");
  });

  it("모르는 원인 → error (일반 폴백, 원인은 서버 로그가 보유)", () => {
    expect(classifyGcalFailure("invalid_grant")).toBe("error");
    expect(classifyGcalFailure("")).toBe("error");
  });

  it("분류 실패가 곧 정보 손실이 되지 않게 — 모든 사유가 서로 구분된다", () => {
    const kinds = new Set([
      classifyGcalFailure("[users] email x 을 registry 에서 찾을 수 없습니다."),
      classifyGcalFailure("[gcal-oauth] refresh_token 미수신 — 재동의 필요"),
      classifyGcalFailure("보통의 네트워크 오류"),
    ]);
    expect(kinds.size).toBe(3);
  });
});
