import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DbSheetLoadError, fetchDbSheetLeads, isDbSheetUnsupported } from "@/lib/query/db-sheet-hooks";
import { isDbSheetFollowUpResult } from "@/types/db-sheet";
import { outcomes, showsNextContact } from "@/app/(app)/db-sheet/_components/model";

afterEach(() => vi.unstubAllGlobals());

describe("DB관리시트 읽기 훅", () => {
  it("「이 계정은 지원 안 함」 503 은 숨김 대상, 일시 장애 503·다른 상태는 오류로 둔다", () => {
    expect(isDbSheetUnsupported(new DbSheetLoadError("이 계정은 아직 DB관리시트를 지원하지 않습니다.", 503))).toBe(true);
    expect(isDbSheetUnsupported(new DbSheetLoadError("개인 DB 연결을 확인할 수 없습니다.", 503))).toBe(true);
    expect(isDbSheetUnsupported(new DbSheetLoadError("저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요.", 503))).toBe(false);
    expect(isDbSheetUnsupported(new DbSheetLoadError("이 계정은 아직 DB관리시트를 지원하지 않습니다.", 500))).toBe(false);
    expect(isDbSheetUnsupported(new Error("이 계정은 아직 DB관리시트를 지원하지 않습니다."))).toBe(false);
  });

  it("서버의 DbSheetUnavailable 문구가 바뀌면 이 시험이 먼저 깨진다(대시보드 DB 칩 숨김과 짝)", () => {
    const src = readFileSync(join(__dirname, "../../lib/service/db-sheet.ts"), "utf8");
    const messages = [...src.matchAll(/new DbSheetUnavailable\("([^"]+)"\)/g)].map((m) => m[1]!);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(isDbSheetUnsupported(new DbSheetLoadError(message, 503)), message).toBe(true);
  });

  it("실패 응답의 문구와 상태를 그대로 들고 온다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "개인 DB 연결을 확인할 수 없습니다." }) })));
    const error = await fetchDbSheetLeads().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DbSheetLoadError);
    expect(error).toMatchObject({ status: 503, message: "개인 DB 연결을 확인할 수 없습니다." });
  });
});

describe("다음 연락일을 쓰는 결과 — 한 곳에서만 정의", () => {
  it("6결과 행렬이 이전과 같다(부재·단순거절·상담 후 거절·재통화만 참)", () => {
    const expected = new Map([["미컨택", false], ["부재", true], ["단순거절", true], ["재통화", true], ["컨택진행", false], ["상담 후 거절", true]]);
    for (const result of outcomes) {
      expect(showsNextContact(result), result).toBe(expected.get(result));
      expect(isDbSheetFollowUpResult(result), result).toBe(expected.get(result));
    }
  });
});
