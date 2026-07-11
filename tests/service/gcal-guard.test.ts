/**
 * gcalActorFrom — gcal 귀속 판정 고정 (fix/gcal-per-user-identity, 수용 기준).
 * 원칙: 표시 대상 = active(화면의 수강생), 조작 허용 = 본인(세션=active)만.
 */
import { describe, expect, it } from "vitest";
import { gcalActorFrom } from "@/service/gcal-guard";

describe("gcalActorFrom", () => {
  it("본인 로그인(세션=액티브) → impersonated=false, 귀속=본인", () => {
    const a = gcalActorFrom("student@example.com", "student@example.com");
    expect(a).toEqual({ email: "student@example.com", impersonated: false });
  });

  it("임퍼스네이션(마스터가 수강생 화면) → 귀속=수강생, impersonated=true (조작 차단 대상)", () => {
    const a = gcalActorFrom("master@example.com", "student@example.com");
    expect(a.email).toBe("student@example.com"); // 표시가 마스터 상태를 보이던 사고의 반대 고정
    expect(a.impersonated).toBe(true);
  });

  it("대소문자·공백 차이는 본인으로 인식 (오탐 차단 방지)", () => {
    const a = gcalActorFrom(" Student@Example.com ", "student@example.com");
    expect(a.impersonated).toBe(false);
  });

  it("수강생 A 연결이 B 화면에 안 보임 — B 화면의 귀속은 항상 B (수용 기준)", () => {
    // 어떤 세션이 보든 카드 데이터 로드는 actor.email(=화면 주인) 기준임을 고정.
    expect(gcalActorFrom("a@x.com", "b@x.com").email).toBe("b@x.com");
    expect(gcalActorFrom("b@x.com", "b@x.com").email).toBe("b@x.com");
  });
});
