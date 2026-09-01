/**
 * 사전 등록(prep) 행이 명단에서 사라지지 않는다 — 회귀 가드.
 *
 * 배경(2026-09-01 belie 신고 "신규수강생 사전등록이라는게 안되지않나?"):
 * 사전 등록 행은 **이메일이 빈 값**으로 만들어진다(본인이 로그인해 클레임할 때 채워지는 설계 —
 * `users-prep.ts:buildPrepRowValues` A열 = ""). 그런데 `User` 스키마가 `z.string().email()`
 * 이라 빈 값이 검증에서 탈락했고, `users.ts:parseRow` 는 실패를 조용히 `null` 로 삼킨다.
 * 결과: **등록은 되는데 `/admin/users` 명단에 아예 안 보였다.**
 *
 * 실측(2026-09-01): 11기 7명을 만들고 서버가 "이미 등록됨"이라고 답하는데도 화면엔 63명 그대로.
 * 10기 김옥선(이메일 빈값)도 같은 이유로 안 보였다.
 *
 * 여기서 못 박는 것:
 *   ① 이메일이 빈 사전등록 행도 파싱된다(= 명단에 뜬다)
 *   ② 이메일이 있으면 여전히 형식 검증을 한다 — 아무 문자열이나 통과시키지 않는다
 */
import { describe, expect, it } from "vitest";
import { User } from "@/types";

const prepRow = (over: Record<string, unknown> = {}) => ({
  email: "",
  cohort: "11",
  name: "이진호",
  spreadsheetId: "12lZihP2cpwbsyKDH9kVVxSF4CPgLun-BIPmRHDfHWl8",
  role: "trainee",
  status: "active",
  ...over,
});

describe("사전 등록 행(이메일 빈값)", () => {
  it("★파싱된다 — 예전엔 여기서 탈락해 명단에서 사라졌다", () => {
    const r = User.safeParse(prepRow());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("");
      expect(r.data.name).toBe("이진호");
      expect(r.data.cohort).toBe("11");
    }
  });

  it("클레임 후(이메일 채워짐)도 그대로 파싱된다", () => {
    const r = User.safeParse(prepRow({ email: "trainee@example.com" }));
    expect(r.success).toBe(true);
  });

  it("★이메일이 있으면 형식은 여전히 검사한다 — 아무 문자열이나 통과 금지", () => {
    expect(User.safeParse(prepRow({ email: "not-an-email" })).success).toBe(false);
    expect(User.safeParse(prepRow({ email: " " })).success).toBe(false);
  });

  it("트레이너·admin 행(이메일 있음, 시트 빈값)도 영향 없다", () => {
    const r = User.safeParse({
      email: "trainer@example.com",
      cohort: "T",
      name: "김트레이너",
      spreadsheetId: "",
      role: "trainer",
      status: "active",
    });
    expect(r.success).toBe(true);
  });
});
