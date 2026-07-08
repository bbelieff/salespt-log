/**
 * R2-4 정합 대조 (db-read-payments): 02 계약수납 DB read 가 시트 파서(rowToCP)와
 * 같은 결과를 내는지 고정 — payload 3형태(backfill 열문자 / updateUserFields 전체 /
 * append 부분+이명) 전부. **이월 계약 필드(AI/AJ/AK·수납 1~3)가 핵심**
 * (2026-07-07 이월 매출 누수 사고 계열 재발 방지).
 */
import { describe, expect, it } from "vitest";
import { rowToCP } from "@/repo/contract-payment";
import { contractFromDbPayload } from "@/repo/db/read-daily";

function toSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000 + 25569;
}

/** backfill rowObj(r, 2) 재현 — C1:AK read 를 문자열화, 빈값 skip (스크립트와 동일). */
function backfillPayload(raw: unknown[]): Record<string, unknown> {
  const colName = (i: number) =>
    i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
  const o: Record<string, unknown> = { _backfill: true };
  for (let i = 2; i <= 36; i++) {
    const s = String(raw[i] ?? "").trim();
    if (s !== "") o[colName(i)] = s;
  }
  return o;
}

/** 시트 02 원시 행(UNFORMATTED) — 이월 계약 + 수납 1·2 채움 픽스처. */
function sheetRow(): unknown[] {
  const r: unknown[] = new Array(37).fill("");
  r[2] = toSerial("2026-06-20"); // C 계약일
  r[3] = "이월상사";             // D 업체명
  r[4] = 300;                    // E 수임비
  r[5] = "ㅇ"; r[6] = "ㅇ";      // F·G 체크박스
  // 수납1 (M~R + AF)
  r[12] = "기관A"; r[13] = 0.6; r[14] = "진행중"; r[15] = 1000; r[16] = 400;
  r[17] = toSerial("2026-06-25"); r[31] = "1차 메모";
  // 수납2 (S~X + AG)
  r[18] = "기관B"; r[19] = "100%"; r[20] = "완료"; r[21] = 500; r[22] = 500;
  r[23] = toSerial("2026-07-01"); r[32] = "2차 메모";
  r[30] = "로드맵 메모";          // AE
  r[34] = "이월";                 // AI 구분 (이월 깃발)
  r[35] = "02:10";                // AJ 이월원본행id
  r[36] = "mtg-777";              // AK 연결 미팅 id
  return r;
}

describe("R2-4 contracts: DB payload ↔ 시트 파서(rowToCP) 정합", () => {
  const raw = sheetRow();
  const expected = rowToCP(raw, 10)!;

  it("픽스처 자체가 이월 계약으로 파싱됨 (전제 검증)", () => {
    expect(expected).not.toBeNull();
    expect(expected.구분).toBe("이월");
    expect(expected.이월원본행id).toBe("02:10");
    expect(expected.linkedMeetingId).toBe("mtg-777");
    expect(expected.수납1.승인금액).toBe(1000);
    expect(expected.수납2.진행률).toBe("100%");
  });

  it("① backfill 열문자 payload(문자열화) == 시트 결과 — 이월·수납 필드 전부", () => {
    expect(contractFromDbPayload(backfillPayload(raw), 10)).toEqual(expected);
  });

  it("② updateUserFields 전체 객체 payload == 시트 결과", () => {
    const p = { ...expected } as unknown as Record<string, unknown>;
    expect(contractFromDbPayload(p, 10)).toEqual(expected);
  });

  it("③ append 부분 payload(meetingId·원본행id 이명) == 신규 행 시트 상태", () => {
    // appendFromContract 미러 형태 그대로 (lib/repo/contract-payment.ts:391)
    const p = {
      _cleared: false, 계약일: "2026-06-20", 업체명: "이월상사", 수임비: 300,
      meetingId: "mtg-777", 구분: "이월", 원본행id: "02:10",
    };
    // 동일 시점 시트 상태 = C~E + AI/AJ/AK 만 채워진 행
    const minimal: unknown[] = new Array(37).fill("");
    minimal[2] = "2026-06-20"; minimal[3] = "이월상사"; minimal[4] = 300;
    minimal[34] = "이월"; minimal[35] = "02:10"; minimal[36] = "mtg-777";
    expect(contractFromDbPayload(p, 12)).toEqual(rowToCP(minimal, 12));
  });

  it("④ 병합(backfill+미러 공존) — 필드명(최신) 우선", () => {
    const merged = {
      ...backfillPayload(raw),
      수임비: 999, // 이후 앱에서 수정된 값
    };
    const cp = contractFromDbPayload(merged, 10)!;
    expect(cp.수임비).toBe(999);
    expect(cp.수납1.수납액).toBe(400); // 나머지는 backfill 값 유지
  });

  it("⑤ 빈/무의미 payload 는 null (phantom row 방지 — 시트와 동일 기준)", () => {
    expect(contractFromDbPayload({ _backfill: true }, 3)).toBeNull();
  });
});
