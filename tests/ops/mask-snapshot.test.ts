/**
 * 가짜로 바꾼 사본 규칙 — 원본 개인정보가 사본에 남지 않고, 구조 시험에 필요한 값·관계는 남는다.
 * 모든 입력은 합성값(예시상사·홍길동·가짜 번호).
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs 운영 스크립트(타입 선언 없음)
import { assertNoPii, DROP_ROW_TABLES, makeMasker } from "../../scripts/ops/mask-snapshot-core.mjs";

const m = makeMasker("unit-test-salt-0123456789");

describe("makeMasker", () => {
  const row = {
    email: "hong@example.com",
    tab: "meetings",
    row_key: "현수막:r12",
    spreadsheet_id: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEF",
    payload: {
      id: "3f2b6c1e-8d4a-4b7e-9c2d-1a2b3c4d5e6f",
      업체명: "예시상사",
      대표자이름: "홍길동",
      연락처: "010-1234-5678",
      미팅날짜: "2026-10-15",
      수임비: 3000000,
      상태: "계약",
      채널: "현수막",
      사업자등록번호: "123-45-67891",
      주민등록번호: "800101-",
      메모: "hong@example.com 에게 연락",
      A: "46042",
      계약여부: true,
      _backfill: "true",
    },
  };
  const out = m.maskRow(row);

  it("이름·업체·연락처·번호·메모는 가짜로", () => {
    for (const k of ["업체명", "대표자이름", "연락처", "사업자등록번호", "주민등록번호", "메모"]) {
      expect(out.payload[k]).toMatch(/^가짜-[0-9a-f]{8}$/);
    }
    expect(out.email).toMatch(/^user\d{6}@example\.test$/);
    expect(out.spreadsheet_id).not.toBe(row.spreadsheet_id);
  });

  it("날짜·금액·상태값·UUID·행 키·짧은 숫자·불리언은 그대로", () => {
    expect(out.payload.미팅날짜).toBe("2026-10-15");
    expect(out.payload.수임비).toBe(3000000);
    expect(out.payload.상태).toBe("계약");
    expect(out.payload.채널).toBe("현수막");
    expect(out.payload.id).toBe(row.payload.id);
    expect(out.row_key).toBe("현수막:r12");
    expect(out.payload.A).toBe("46042");
    expect(out.payload.계약여부).toBe(true);
    expect(out.payload._backfill).toBe("true");
    expect(out.tab).toBe("meetings");
  });

  it("같은 원본 = 같은 가짜(관계 유지), salt 가 다르면 다른 가짜", () => {
    expect(m.maskRow({ s: row.spreadsheet_id }).s).toBe(out.spreadsheet_id);
    expect(m.maskRow({ e: "HONG@example.com" }).e).toBe(out.email);
    const other = makeMasker("another-salt-9876543210");
    expect(other.maskRow({ s: row.spreadsheet_id }).s).not.toBe(out.spreadsheet_id);
  });

  it("긴 숫자는 같은 길이의 가짜 숫자", () => {
    const v = m.maskRow({ n: "1234567890123" }).n;
    expect(v).toMatch(/^\d{13}$/);
    expect(v).not.toBe("1234567890123");
  });

  it("가짜 사본은 원본 흔적 검사를 통과한다", () => {
    expect(() => assertNoPii(JSON.stringify(out))).not.toThrow();
  });

  it("salt 가 짧으면 거부", () => {
    expect(() => makeMasker("short")).toThrow();
  });

  it("비밀 표는 행을 내보내지 않는다", () => {
    expect([...DROP_ROW_TABLES]).toEqual(expect.arrayContaining(["gcal_tokens", "vault_pins", "company_vault"]));
  });
});

describe("assertNoPii — 원본이면 막는다", () => {
  it.each([
    ["이메일", '{"e":"hong@example.com"}'],
    ["전화", '{"p":"010-1234-5678"}'],
    ["주민번호 전체", '{"r":"800101-1234567"}'],
    ["사업자번호", '{"b":"123-45-67891"}'],
    ["호칭 붙은 이름", '{"m":"홍길동님 미팅"}'],
  ])("%s", (_label, text) => {
    expect(() => assertNoPii(text)).toThrow(/원본 흔적/);
  });
});
