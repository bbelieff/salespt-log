/**
 * 저장 경로 관측성 회귀 가드 (2026-09-14 저장 무결성 사고 후속).
 *
 * 사고 요약: 트레이너 담당 체크가 "저장된 것처럼 보였는데" 실제로는 반영 안 됨.
 * 조사 결과 (1) pm2 가 앱 stdout 을 수집하지 못해 로그가 0줄이었고 (2) 미러 스킵
 * 경로(picked=null)는 애초에 아무것도 남기지 않았다. (1)은 운영 설정으로 고쳤고,
 * 이 테스트는 (2)와 PII·응답 안전성을 **기계 검증**으로 박아 재발을 막는다.
 *
 * 2026-09-14 교차검수 후속: (a) redact 가 접속문자열만 지우고 이메일은 통과시켰고
 * (b) t:"sheet_write" 방출점이 둘이었으며 (c) db_disabled 가 쓰기마다 한 줄씩 쌓였다.
 * 세 건 모두 아래 케이스로 회귀를 잡는다.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { als, currentRequestId, withApiTiming } from "@/lib/analytics/api-timing";
import {
  hashEmail,
  logMirrorResult,
  logMirrorSkipped,
  logRegistryCellWrite,
  redactDbError,
  resetSaveObservabilityForTests,
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
    // db_disabled 억제는 모듈 전역 플래그다 — 리셋을 빠뜨리면 뒤 테스트가 조용히
    // 침묵해 순서 의존 실패가 난다. 명시 리셋으로 결정적으로 푼다.
    resetSaveObservabilityForTests();
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

    // 프로덕션이 실제로 부르는 경로로 검증한다 — logSheetWrite 직접 호출은
    // 아무도 안 쓰는 경로를 검증하는 것이었다(2026-09-14 교차검수 지적).
    const listCell = `${email},second.person@example.com`;
    logRegistryCellWrite("registry", "G", 12, listCell, true);

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

  it("sheet_write 의 키 순서가 고정된다 — 이 형식을 읽는 소비자가 있다", () => {
    logRegistryCellWrite("registry", "G", 5, "a@example.com", true);
    const line = jsonLines(logSpy).find((l) => l["t"] === "sheet_write")!;
    expect(Object.keys(line)).toEqual([
      "t",
      "request_id",
      "tab",
      "cell",
      "col",
      "sheet_row",
      "value_len",
      "value_hash",
      "emails_hash",
    ]);
  });

  it("비 G 열은 emails_hash 키가 없고 한 줄만 나온다 — 중복 방출 회귀", () => {
    logRegistryCellWrite("registry", "C", 7, "일반값", true);
    const lines = jsonLines(logSpy).filter((l) => l["t"] === "sheet_write");
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toHaveProperty("emails_hash");
    expect(rawText(logSpy, warnSpy)).not.toContain("일반값");
  });

  it('t:"sheet_write" 방출점은 소스에 딱 한 곳이다 — 형식이 갈리지 않게', () => {
    // 동작 테스트만으로는 두 번째 방출점 부활을 못 잡는다. 소스를 직접 센다.
    // 주석은 제거하고 센다 — 안 그러면 "여기서 t:"sheet_write" 를 또 쓰지 마라" 같은
    // 경고 주석 자체가 위반으로 잡혀 테스트가 자기 문서를 처벌한다(2026-09-14 실측).
    const src = readFileSync("lib/analytics/save-observability.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const hits = src.match(/t:\s*"sheet_write"/g) ?? [];
    expect(hits).toHaveLength(1);
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

  it("db_disabled 는 프로세스당 1회만 — 쓰기마다 쌓이지 않는다", () => {
    logMirrorSkipped({ reason: "db_disabled", label: "users cells I,J,K,L" });
    logMirrorSkipped({ reason: "db_disabled", label: "다른 라벨" });
    logMirrorSkipped({ reason: "db_disabled", label: "또 다른 라벨" });
    // 라벨이 달라도 전역 1회 — DATABASE_URL 유무는 프로세스 전역 사실이라 라벨과 무관하다.
    expect(warnSpy).toHaveBeenCalledTimes(1);

    resetSaveObservabilityForTests();
    logMirrorSkipped({ reason: "db_disabled", label: "users cells I,J,K,L" });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("picked_null 은 억제되지 않는다 — 행별 사건이라 매번 남아야 한다", () => {
    logMirrorSkipped({ reason: "picked_null", label: "users cells G", sheetRow: 7 });
    logMirrorSkipped({ reason: "picked_null", label: "users cells G", sheetRow: 8 });
    expect(warnSpy).toHaveBeenCalledTimes(2);
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
      logRegistryCellWrite("registry", "G", 7, "a@example.com,b@example.com", true);
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
      new Error("connect failed postgres://user:***@db.internal:5432/app"),
    );
    expect(msg).toContain("[DATABASE_URL]");
    expect(msg).not.toContain("secret");
    expect(msg.length).toBeLessThanOrEqual(500);
  });

  it("DB 에러 메시지 안의 이메일도 지운다 — 불변조건 1(PII 원문 금지)", () => {
    // 실제 사례: invalid input syntax 류는 위반한 '값'을 message 에 그대로 담는다.
    const msg = redactDbError(
      new Error('invalid input syntax for type uuid: "hong.gildong@example.com"'),
    );
    expect(msg).not.toContain("hong.gildong@example.com");
    expect(msg).toContain("[EMAIL]");
  });

  it("stack 을 끌어오지 않는다 — 노출면은 message 로 한정", () => {
    const e = new Error("connection failed");
    e.stack = 'Error: connection failed\n    at f (/home/leak/secret@example.com/a.ts:1:1)';
    const msg = redactDbError(e);
    expect(msg).not.toContain("/home/leak");
    expect(msg).toBe("connection failed");
  });

  it("문자열 warn 과 구조화 라인이 같은 redact 를 통과한다", () => {
    // registry-mirror 의 문자열 warn 이 예전엔 접속문자열만 따로 치환해 이메일을 흘렸다.
    // 두 출력이 같은 함수를 쓰는지 소스로 확인한다.
    const src = readFileSync("lib/repo/db/registry-mirror.ts", "utf8");
    expect(src).toContain("const msg = redactDbError(e);");
    expect(src).toContain("[registry-mirror] 실패"); // 운영 grep 보존
  });
});
