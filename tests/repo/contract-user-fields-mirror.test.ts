/**
 * updateUserFields 미러 payload 회귀 (#558 PARTIAL ③ — DevD 재플래그 반영).
 *
 * 스펙: 미러는 **시트에 실제 쓰는 범위(F:AH = 사용자 편집영역)** 만 담는다(화이트리스트).
 *  · 구분·이월원본행id(AI·AJ) 제외 → arena-carryover 재복사 시 DB 이월 flag 클로버 방지(#558 1차)
 *  · **해지 AL~AO·linkedMeetingId(AK) 제외** → 해지된 옛 계약을 이월할 때 "DB 만 해지" 갈림 방지
 *    (⚠️ 이전 테스트가 "해지일 보존(무해)"을 스펙으로 고정하고 있었다 — 그게 버그였다)
 *  · 계약일·업체명·수임비(C/D/E)도 F:AH 밖 → append/updateLinkFields/syncFee 가 정본
 * 화이트리스트라 AP 이후 신규 필드가 늘어도 자동 누출되지 않는다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const persistContractRow = vi.fn();
const valuesUpdate = vi.fn(async () => ({}));

// persistContractRow 만 스파이 — userFieldsMirrorPayload(실물)는 그대로 써야 payload 를 검증할 수 있다.
vi.mock("@/repo/db/contracts-clear", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/repo/db/contracts-clear")>();
  return {
    ...actual,
    persistContractRow: (...a: unknown[]) => persistContractRow(...(a as [])),
  };
});
vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: async () => ({
        data: { sheets: [{ properties: { title: "02 계약수납관리" } }] },
      }),
      values: { update: valuesUpdate, batchUpdate: vi.fn(async () => ({})) },
    },
  }),
  ensureGridColumns: vi.fn(async () => {}),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: vi.fn(),
  mirrorClearRow: vi.fn(),
}));

import { ContractPayment } from "@/types";
import { userFieldsMirrorPayload } from "@/repo/db/contracts-clear";
import { updateUserFields } from "@/repo/contract-payment";

/** 해지되고 이월이며 미팅에 링크된 **옛 기수 계약** — arena-carryover 가 넘기는 외래 소스. */
function oldCarriedTerminatedCp(): ContractPayment {
  return ContractPayment.parse({
    row: 9,
    계약일: "2026-05-01",
    업체명: "옛업체",
    수임비: 1000,
    공동인증서: true,
    로드맵메모: "메모",
    수납1: {
      진행기관: "A", 진행률: "", 현황: "", 승인금액: 0,
      수납액: 300, 수납일: "", 메모: "슬롯메모",
    },
    구분: "이월",
    이월원본행id: "02:5",
    linkedMeetingId: "m-old-cohort",
    해지일: "2026-06-01",
    해지사유: "환불",
    반환액: 500,
    해지숨김: true,
  });
}

const LEAK_KEYS = [
  "구분", "이월원본행id", "linkedMeetingId",
  "해지일", "해지사유", "반환액", "해지숨김",
  "계약일", "업체명", "수임비", // F:AH 밖 — 이 함수의 소유가 아님
];

beforeEach(() => {
  persistContractRow.mockReset().mockResolvedValue(undefined);
  valuesUpdate.mockReset().mockResolvedValue({});
});

describe("userFieldsMirrorPayload — F:AH 화이트리스트", () => {
  it("F:AH 편집값만 담는다(체크박스·슬롯·로드맵메모)", () => {
    const p = userFieldsMirrorPayload(oldCarriedTerminatedCp());
    expect(p.공동인증서).toBe(true);
    expect(p.로드맵메모).toBe("메모");
    expect((p.수납1 as { 수납액: number }).수납액).toBe(300);
  });

  it("🐛③ 해지(AL~AO)·linkedMeetingId(AK) 누출 차단 — DB만 해지 갈림 방지", () => {
    const p = userFieldsMirrorPayload(oldCarriedTerminatedCp());
    for (const k of ["해지일", "해지사유", "반환액", "해지숨김", "linkedMeetingId"]) {
      expect(k in p).toBe(false);
    }
  });

  it("구분·이월원본행id 제외 유지(#558 1차 — 이월 flag 클로버 방지)", () => {
    const p = userFieldsMirrorPayload(oldCarriedTerminatedCp());
    expect("구분" in p).toBe(false);
    expect("이월원본행id" in p).toBe(false);
  });

  it("F:AH 밖(계약일·업체명·수임비)도 제외 — append/updateLink/syncFee 가 정본", () => {
    const p = userFieldsMirrorPayload(oldCarriedTerminatedCp());
    for (const k of ["계약일", "업체명", "수임비"]) expect(k in p).toBe(false);
  });

  it("원본 cp 는 mutate 하지 않음", () => {
    const src = oldCarriedTerminatedCp();
    userFieldsMirrorPayload(src);
    expect(src.구분).toBe("이월");
    expect(src.해지일).toBe("2026-06-01");
  });
});

describe("호출부 회귀(DevD iv) — updateUserFields 가 persistContractRow 에 넘기는 payload", () => {
  it("해지·이월 옛 계약을 넘겨도 payload 에 누출 키가 하나도 없다", async () => {
    await updateUserFields("sheet-1", oldCarriedTerminatedCp());
    expect(persistContractRow).toHaveBeenCalledTimes(1);
    const payload = persistContractRow.mock.calls[0]![2] as Record<string, unknown>;
    for (const k of LEAK_KEYS) expect(k in payload).toBe(false);
    // F:AH 값은 실려야 한다(회귀 반대편 — 미러가 텅 비면 안 됨).
    expect(payload.공동인증서).toBe(true);
    expect(payload.로드맵메모).toBe("메모");
  });
});
