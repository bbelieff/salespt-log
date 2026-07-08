/**
 * R2-2 정합 대조 (db-read-meetings-banners): 컨택 탭 meetings·현수막 주문합의
 * DB 경로가 시트 경로와 **같은 결과**를 내는지 고정.
 *
 * payload 두 형태(dual-write 필드명 / backfill 열문자·문자열화)를 모두
 * 시트 파서(rowToMeeting) 결과와 대조 — 변환기가 유일한 차이 지점이므로
 * 여기서 동등하면 loadDay 나머지 파이프라인(공유)은 자동 정합.
 */
import { describe, expect, it } from "vitest";
import { rowToMeeting } from "@/repo/meetings";
import {
  bannerOrderQtyFromDbPayload,
  meetingFromDbPayload,
} from "@/repo/db/read-daily";

/** ISO 날짜 → Sheets serial (UNFORMATTED_VALUE 와 동일 규약, 1899-12-30 기점). */
function toSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000 + 25569;
}

/** backfill rowObj 재현 — 문자열화 + 빈값 skip + _backfill 마킹 (스크립트와 동일 규칙). */
function backfillPayload(row: unknown[]): Record<string, unknown> {
  const colName = (i: number) =>
    i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
  const o: Record<string, unknown> = { _backfill: true };
  row.forEach((v, i) => {
    const s = String(v ?? "").trim();
    if (s !== "") o[colName(i)] = s;
  });
  return o;
}

/** 시트 04 탭 원시 행(UNFORMATTED) 픽스처 — 예약일=2026-07-08, 계약 상태. */
function sheetRow(): unknown[] {
  const r: unknown[] = new Array(45).fill("");
  r[0] = "mtg-001";                 // A id
  r[1] = toSerial("2026-07-08");    // B 예약일 (serial)
  r[2] = 10.5 / 24;                 // C 예약시각 10:30 (serial fraction)
  r[3] = toSerial("2026-07-10");    // D 미팅날짜
  r[4] = 14 / 24;                   // E 미팅시간 14:00
  r[5] = "매입DB";                  // F channel
  r[6] = "테스트상사";              // G 업체명
  r[7] = "서울";                    // H 장소
  r[8] = "비고";                    // I 예약비고
  r[9] = "계약";                    // J 상태
  r[10] = true;                     // K 계약여부 (UNFORMATTED boolean)
  r[11] = 500;                      // L 수임비
  r[12] = "";                       // M 미팅사유
  r[15] = "월 3회";                 // P 계약조건
  return r;
}

describe("R2-2 meetings: DB payload ↔ 시트 파서 정합", () => {
  it("dual-write 필드명 payload == 시트 rowToMeeting 결과", () => {
    const expected = rowToMeeting(sheetRow())!;
    expect(expected).not.toBeNull();
    // mirror.ts 는 검증된 Meeting 객체를 payload 로 그대로 upsert — 그 형태 재현.
    const fromDb = meetingFromDbPayload({ ...expected } as unknown as Record<string, unknown>);
    expect(fromDb).toEqual(expected);
  });

  it("backfill 열문자 payload(문자열화·직렬날짜) == 시트 rowToMeeting 결과", () => {
    const raw = sheetRow();
    const expected = rowToMeeting(raw)!;
    const fromDb = meetingFromDbPayload(backfillPayload(raw));
    expect(fromDb).toEqual(expected);
  });

  it("병합 payload(열문자+필드명 공존)는 필드명(최신) 우선", () => {
    const raw = sheetRow();
    const merged = {
      ...backfillPayload(raw),
      ...(rowToMeeting(raw) as unknown as Record<string, unknown>),
      업체명: "개명된상사", // 앱에서 나중에 수정된 값(필드명 쪽이 최신)
    };
    expect(meetingFromDbPayload(merged)!.업체명).toBe("개명된상사");
  });

  it("id 없는 쓰레기 payload 는 null (행 제외 — 화면 오염 금지)", () => {
    expect(meetingFromDbPayload({ _backfill: true })).toBeNull();
  });
});

describe("R2-2 banners: 주문개수 정합 (ADR-0025 재고 base 입력)", () => {
  it("dual-write 필드명(주문개수) 우선", () => {
    expect(bannerOrderQtyFromDbPayload({ 주문개수: 30, T: "999" })).toBe(30);
  });

  it("backfill 열문자(T, 문자열) fallback — 시트 readBanners 값과 동일", () => {
    // 03 DB관리 현수막 P4:V — T(인덱스 19)=주문개수. backfill 은 문자열로 저장.
    expect(bannerOrderQtyFromDbPayload({ P: "46110", Q: "현수막업체", T: "12", _backfill: true })).toBe(12);
  });

  it("둘 다 없으면 0 (합산 무해)", () => {
    expect(bannerOrderQtyFromDbPayload({ _cleared: false })).toBe(0);
  });

  it("Σ주문개수: 혼재 형태 rows 합 == 시트 경로 합", () => {
    const rows = [
      { 주문개수: 30 },              // 앱 dual-write
      { T: "12", _backfill: true },  // backfill 만
      { 주문개수: 8, T: "8" },       // 병합
    ];
    const dbSum = rows.reduce((s, p) => s + bannerOrderQtyFromDbPayload(p), 0);
    expect(dbSum).toBe(30 + 12 + 8); // 시트 readBanners reduce 와 동일 의미
  });
});
