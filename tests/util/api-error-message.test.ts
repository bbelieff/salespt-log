import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES, apiErrorMessage } from "@/lib/util/api-error-message";

describe("apiErrorMessage", () => {
  // 총괄이 실제로 본 화면. 「낫트레이너」 만 떠서 무슨 일인지 알 수 없었다.
  it("not_trainer 를 무엇을 하면 되는지까지 알려 준다", () => {
    const text = apiErrorMessage({ error: "not_trainer" }, 404);
    expect(text).not.toContain("not_trainer");
    expect(text).toContain("트레이너");
    expect(text).toMatch(/활성|추가/);
  });

  // 여러 명을 한 번에 배정하면 «누구» 때문에 막혔는지가 제일 중요하다.
  it("문제된 값이 오면 함께 보여 준다", () => {
    const text = apiErrorMessage({ error: "not_trainer", invalid: "a@b.com" }, 404);
    expect(text).toContain("a@b.com");
  });

  it("서버가 사람 말을 보내면 그대로 쓴다", () => {
    expect(apiErrorMessage({ message: "이미 마감됐어요.", error: "forbidden" })).toBe("이미 마감됐어요.");
    expect(apiErrorMessage({ hint: "시트를 먼저 연결해 주세요.", error: "no_sheet" })).toBe(
      "시트를 먼저 연결해 주세요.",
    );
  });

  // 모르는 코드를 숨기면 문의받았을 때 원인을 못 찾는다.
  it("모르는 코드는 사람 말과 함께 코드도 남긴다", () => {
    const text = apiErrorMessage({ error: "teapot_exploded" }, 418);
    expect(text).toContain("teapot_exploded");
    expect(text).toMatch(/처리하지 못했어요/);
  });

  it("본문이 비어도 화면이 빈 문자열이 되지 않는다", () => {
    expect(apiErrorMessage({}, 500)).toContain("500");
    expect(apiErrorMessage(null).length).toBeGreaterThan(0);
    expect(apiErrorMessage(undefined).length).toBeGreaterThan(0);
  });

  it("영어 코드가 그대로 새어 나가지 않는다", () => {
    for (const [code, text] of Object.entries(API_ERROR_MESSAGES)) {
      expect(text, code).not.toContain(code);
      expect(text, code).toMatch(/[가-힣]/);
    }
  });
});
