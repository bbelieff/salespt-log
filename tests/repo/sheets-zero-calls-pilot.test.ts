/**
 * 동적 검증 — 파일럿 쓰기 경로 시트 호출 0회 (BBE-251, 시트독립 4단계).
 *
 * A 의 BBE-245 코멘트(정정)에 따르면 `lib/analytics/api-timing.ts` 가 이미 요청당 시트콜을
 * 계측하지만, 그 값을 확인하는 정본 경로는 PostHog Insights 조회다(신규 계측 인프라는 불요
 * 하다는 것이 A 의 결론). 이 세션도 PostHog 접근 권한이 없어(실측: 연결된 MCP 도구 없음)
 * 그 축은 직접 못 채운다 — "모른다"로 명시하고 belie/PostHog 권한 세션에 이관한다(§0.8).
 *
 * 대신 이 테스트는 **같은 질문(파일럿 쓰기 경로가 시트를 부르는가)을 코드 레벨에서 실행 시점에
 * 직접 증명**한다 — `sheets-client.ts` 저수준 export 전부를 모킹하고, 파일럿(`opts.syncDb=true`)
 * 경로로 실제 함수(`updateUserFields`/`clearRow`)를 호출해 그 모킹이 **한 번도 불리지 않았음**을
 * 단언한다. 정적 가드(sheets-request-path-guard.test.ts)가 "시트를 부르는 코드가 화이트리스트
 * 밖에 있는가" 를 보면, 이 테스트는 "화이트리스트 안의(R2-비파일럿-폴백 태그) 코드가 파일럿
 * 분기에서 실제로 실행 시 시트를 안 부르는가" 를 실행해서 확인 — 정적 분석이 못 보는
 * 런타임 분기(if (opts?.syncDb))를 커버한다.
 *
 * ★부수 발견(고쳤다고 안 함, 정직 보고): `clearRow` 는 syncDb 분기 이전에 `resolveLayout()` 을
 * **무조건** 호출하는데, 이 함수는 in-process 캐시가 비어 있으면(콜드) 탭 레이아웃 확인을 위해
 * 시트를 1회 읽는다(모듈 레벨 `layoutCache` Map). 즉 "파일럿도 시트 호출 0" 은 **워밍 후에만**
 * 참이다(장기 실행 pm2 프로세스에선 사실상 항상 워밍 상태). 이 테스트는 그 캐시를 먼저
 * 채운 뒤 syncDb 분기 자체의 호출 수를 검증한다 — 콜드 케이스는 발견만 남기고 이 카드
 * 스코프(게이트 구축) 밖이라 고치지 않는다(후속 카드 후보).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sheetsClientMock = vi.fn(() => {
  throw new Error("sheetsClient() 가 파일럿(syncDb) 경로에서 호출됨 — 재유입");
});
const readRangeMock = vi.fn(() => {
  throw new Error("readRange() 가 파일럿(syncDb) 경로에서 호출됨 — 재유입");
});
const appendRowsMock = vi.fn(() => {
  throw new Error("appendRows() 가 파일럿(syncDb) 경로에서 호출됨 — 재유입");
});
const ensureGridColumnsMock = vi.fn(() => {
  throw new Error("ensureGridColumns() 가 파일럿(syncDb) 경로에서 호출됨 — 재유입");
});

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: sheetsClientMock,
  readRange: readRangeMock,
  appendRows: appendRowsMock,
  ensureGridColumns: ensureGridColumnsMock,
}));
vi.mock("@/repo/db/mirror", () => ({ mirrorClearRow: vi.fn() }));
vi.mock("@/repo/db/contracts-clear", () => ({
  persistContractRow: vi.fn().mockResolvedValue(undefined),
  clearContractRowInDbSync: vi.fn().mockResolvedValue(undefined),
  userFieldsMirrorPayload: vi.fn((cp: unknown) => cp),
}));
vi.mock("@/repo/contract-sheet-sync", () => ({ queueContractRowSync: vi.fn() })); // fire-and-forget, 미대기라 별도 검증 불필요(비동기-수렴미러)
vi.mock("@/repo/contract-append-mirror", () => ({ mirrorContractRowDurable: vi.fn() }));
vi.mock("@/repo/db/db-tab-sync", () => ({
  persistDbRow: vi.fn().mockResolvedValue(undefined),
  clearDbRow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/repo/db/row-key", () => ({
  resolveWriteKey: vi.fn().mockResolvedValue("매입DB:r3"),
}));
vi.mock("@/repo/db-tab-sheet-sync", () => ({ queueDbTabRowSync: vi.fn() })); // fire-and-forget(비동기-수렴미러)

beforeEach(() => {
  sheetsClientMock.mockClear();
  readRangeMock.mockClear();
  appendRowsMock.mockClear();
  ensureGridColumnsMock.mockClear();
});

describe("계약(02) 파일럿 쓰기 경로 — 시트 호출 0회 (BBE-246 이 걷어낸 것 실행 시점 재확인)", () => {
  it("updateUserFields(syncDb=true) 는 sheetsClient 계열을 전혀 안 부른다", async () => {
    const { updateUserFields } = await import("@/repo/contract-payment");
    await updateUserFields(
      "fake-sheet-id",
      {
        row: 3,
        계약일: "2026-08-20",
        업체명: "테스트업체",
        수임비: 100,
      } as never,
      { syncDb: true },
    );
    expect(sheetsClientMock).not.toHaveBeenCalled();
    expect(readRangeMock).not.toHaveBeenCalled();
    expect(appendRowsMock).not.toHaveBeenCalled();
  });

  it("clearRow(syncDb=true) — resolveLayout 워밍 후엔 syncDb 분기 자체가 시트를 0회 부른다", async () => {
    const { clearRow, resolveLayout } = await import("@/repo/contract-payment");
    // ★부수 발견(위 헤더 설명): resolveLayout 은 콜드 캐시면 시트 1회 읽는다 — 여기서
    // 그 1회를 먼저 소모(워밍)하고 counter 를 리셋해, "syncDb 분기 자체" 만 측정한다.
    sheetsClientMock.mockImplementationOnce(
      () =>
        ({
          spreadsheets: {
            get: async () => ({ data: { sheets: [{ properties: { title: "02 계약수납관리" } }] } }),
          },
        }) as never,
    );
    await resolveLayout("fake-sheet-id-2");
    sheetsClientMock.mockClear();

    await clearRow("fake-sheet-id-2", 10, { syncDb: true }); // firstDataRow 보다 큰 안전한 행
    expect(sheetsClientMock).not.toHaveBeenCalled();
  });
});

describe("DB관리(03) 파일럿 쓰기 경로 — 시트 호출 0회", () => {
  it("updatePurchase(syncDb=true) 는 sheetsClient 계열을 전혀 안 부른다", async () => {
    const { updatePurchase } = await import("@/repo/db-write");
    await updatePurchase(
      "fake-sheet-id-3",
      3,
      { channel: "매입DB" } as never,
      { syncDb: true },
    );
    expect(sheetsClientMock).not.toHaveBeenCalled();
    expect(readRangeMock).not.toHaveBeenCalled();
  });
});
