/**
 * 저장 경로 관측성 회귀 가드 (2026-09-14 저장 무결성 사고 후속).
 *
 * 사고 요약: 트레이너 담당 체크가 "저장된 것처럼 보였는데" 실제로는 반영 안 됨.
 * 조사 결과 (1) pm2 가 앱 stdout 을 수집하지 못해 로그가 0줄이었고 (2) 미러 스킵
 * 경로(picked=null)는 애초에 아무것도 남기지 않았다. (1)은 운영 설정으로 고쳤고,
 * 이 테스트는 (2)와 PII·응답 안전성을 **기계 검증**으로 박아 재발을 막는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { als, currentRequestId, withApiTiming } from "@/lib/analytics/api-timing";
import {
  hashEmail,
  hashEmailList,
  logMirrorResult,
  logMirrorSkipped,
  logSheetWrite,
  redactDbError,
  shortHash,
} from "@/lib/analytics/save-observability";

type Spy = ReturnType<typeof vi.spyOn>;

function jsonLines(spy: Spy): Record<string, unknown>[] {
  return spy.mock.calls
    .map((c) => {
      try {
        return JSON.parse(String(c[0])) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((v): v is Record<string, unknown> => v !== null);
}

function rawText(...spies: Spy[]): string {
  return spies.flatMap((s) => s.mock.calls.map((c) => String(c[0]))).join("\n");
}

describe("저장 경로 관측성", () => {
  let logSpy: Spy;
  let warnSpy: Spy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("이메일이 로그에 원문으로 남지 않는다 — 해시만", () => {
    const email = "Test.User+alias@Example.com";
    expect(hashEmail(email)).toMatch(/^sha256:[0-9a-f]{8}$/);
    // 표기가 달라도 같은 해시 → 로그끼리 조인 가능
    expect(hashEmail("test.user+alias@example.com")).toBe(hashEmail(email));

    const listCell = `${email},second.person@example.com`;
    logSheetWrite({
      tab: "registry",
      colLetter: "G",
      sheetRow: 12,
      valueLen: listCell.length,
      valueHash: shortHash(listCell),
      emailsHash: hashEmailList(listCell),
    });

    const text = rawText(logSpy, warnSpy);
    expect(text).not.toContain("Test.User");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("second.person");

    const line = jsonLines(logSpy).find((l) => l["t"] === "sheet_write");
    expect(line).toBeDefined();
    expect(line!["sheet_row"]).toBe(12);
    expect(line!["cell"]).toBe("G12");
    expect((line!["emails_hash"] as string[]).length).toBe(2);
  });

  it("미러 스킵(picked=null)이 경고 한 줄로 남는다 — 예전엔 완전 침묵이었다", () => {
    logMirrorSkipped({ reason: "picked_null", label: "users cells G", sheetRow: 42 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(warnSpy.mock.calls[0]![0])) as Record<string, unknown>;
    expect(line["t"]).toBe("db_mirror_result");
    expect(line["outcome"]).toBe("skipped");
    expect(line["reason"]).toBe("picked_null");
    expect(line["sheet_row"]).toBe(42);
  });

  it("로그 싱크가 죽어도 라우트 응답은 200 — 관측이 응답을 깨지 않는다", async () => {
    logSpy.mockImplementation(() => {
      throw new Error("log sink down");
    });
    const POST = withApiTiming(
      "test/route:POST",
      async (_req: Request) => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const res = await POST(new Request("http://localhost/test/route", { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("한 요청의 세 로그가 같은 request_id 로 묶인다", async () => {
    const POST = withApiTiming("test/route:POST", async (_req: Request) => {
      logSheetWrite({
        tab: "registry",
        colLetter: "G",
        sheetRow: 7,
        valueLen: 3,
        valueHash: shortHash("a,b"),
      });
      logMirrorResult({
        requestId: currentRequestId(),
        label: "users cells G",
        outcome: "ok",
        attempts: 1,
      });
      return new Response("ok", { status: 200 });
    });
    const res = await POST(new Request("http://localhost/test/route", { method: "POST" }));
    expect(res.status).toBe(200);

    const lines = jsonLines(logSpy);
    const timing = lines.find((l) => l["t"] === "api_timing");
    const sheet = lines.find((l) => l["t"] === "sheet_write");
    const mirror = lines.find((l) => l["t"] === "db_mirror_result");
    expect(timing).toBeDefined();
    expect(sheet).toBeDefined();
    expect(mirror).toBeDefined();
    const rid = timing!["request_id"];
    expect(typeof rid).toBe("string");
    expect(rid).not.toBe("none");
    expect(sheet!["request_id"]).toBe(rid);
    expect(mirror!["request_id"]).toBe(rid);
  });

  it("기존 api_timing 필드는 그대로 유지된다 — 운영 grep 보존", async () => {
    const GET = withApiTiming(
      "test/route:GET",
      async (_req: Request) => new Response("ok", { status: 200 }),
    );
    await GET(new Request("http://localhost/test/route"));
    const line = jsonLines(logSpy).find((l) => l["t"] === "api_timing")!;
    for (const key of ["t", "route", "ms", "sheets_ms", "sheets_calls", "status"]) {
      expect(line).toHaveProperty(key);
    }
  });

  it("요청 컨텍스트 밖에서는 request_id 가 none — throw 하지 않는다", () => {
    expect(currentRequestId()).toBe("none");
    expect(() => logMirrorSkipped({ reason: "db_disabled" })).not.toThrow();
  });

  it("ALS 컨텍스트가 있으면 그 requestId 를 읽는다", async () => {
    await als.run({ sheetsMs: 0, sheetsCalls: 0, requestId: "fixed-rid" }, async () => {
      expect(currentRequestId()).toBe("fixed-rid");
    });
  });

  it("DB 에러의 접속문자열은 로그에 남지 않는다", () => {
    const msg = redactDbError(
      new Error("connect failed postgres://user:secret@db.internal:5432/app"),
    );
    expect(msg).toContain("[DATABASE_URL]");
    expect(msg).not.toContain("secret");
    expect(msg.length).toBeLessThanOrEqual(500);
  });
});
