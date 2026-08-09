/**
 * R3-2 정합 고정 (meetings 쓰기 정본 전환):
 *  1) meetingToRow ↔ rowToMeeting 라운드트립 — 수렴 동기화 잡(upsertMeetingRowSnapshot)이
 *     DB Meeting 을 full-row 로 다시 쓸 때 필드 손실이 없는지.
 *  2) 수식(N/O/Q/S)·이월깃발(AO/AP)·gcal맵(AT~) 비접촉 — meetingToRow 가 해당 셀을 항상
 *     빈 문자열로 두는지 기계 고정(split write 범위의 전제).
 *  3) 이월 DB payload(carriedMeetingPayload) — 열문자 평탄화가 meetingFromDbPayload 로
 *     정확히 복원되는지(구 {_carryRaw} payload 가 이월 미팅을 DB read 에서 소실시키던
 *     결함의 회귀 방지). R(옛 previousMeetingId)·수식값은 payload 에서 제외.
 */
import { describe, expect, it } from "vitest";
import { Meeting } from "@/types";
import { meetingToRow, rowToMeeting } from "@/repo/meetings-rows";
import { carriedMeetingPayload } from "@/repo/carryover";
import { meetingFromDbPayload } from "@/repo/db/read-daily";

const FORMULA_IDX = [13, 14, 16, 18]; // N 표시상세 / O 표시요약 / Q 계약합성라인 / S 주차
const CARRY_IDX = [40, 41]; // AO 구분 / AP 이월원본행id

const BASE = Meeting.parse({
  id: "m-rt-001",
  예약일: "2026-07-10",
  예약시각: "10:00",
  미팅날짜: "2026-07-12",
  미팅시간: "14:30",
  channel: "매입DB",
  업체명: "라운드트립상사",
  장소: "본사 회의실",
  예약비고: "서류 지참",
  상태: "예약",
  계약여부: false,
  수임비: 0,
  미팅사유: "",
  계약조건: "5%",
  업체정보: { 대표자이름: "김테스트", 신용점수: "800" },
});

/** USER_ENTERED 가 하는 일 재현 — apostrophe prefix 는 시트에 저장될 때 벗겨진다. */
function simulateUserEntered(row: (string | number | boolean)[]): unknown[] {
  return row.map((v) =>
    typeof v === "string" && v.startsWith("'") ? v.slice(1) : v,
  );
}

describe("R3-2 meetings 코덱 라운드트립", () => {
  it("meetingToRow → (USER_ENTERED) → rowToMeeting 필드 보존", () => {
    const back = rowToMeeting(simulateUserEntered(meetingToRow(BASE)));
    expect(back).not.toBeNull();
    // rowToMeeting 은 AO/AP 빈 셀을 구분·이월원본행id "" 로 세팅 — 그 둘만 분리 비교.
    const { 구분, 이월원본행id, ...rest } = back!;
    expect(구분).toBe("");
    expect(이월원본행id).toBe("");
    expect(rest).toEqual({ ...BASE });
  });

  it("수식(N/O/Q/S)·이월(AO/AP)·gcal맵(AT~) 셀은 항상 빈 문자열 — split write 전제", () => {
    const row = meetingToRow(BASE);
    expect(row).toHaveLength(45); // A~AS — AT(gcal 맵) 이후 비접촉
    for (const i of [...FORMULA_IDX, ...CARRY_IDX]) {
      expect(row[i]).toBe("");
    }
  });

  it("previousMeetingId·구분 있는 미팅도 라운드트립 (구분은 AO 로 별도 쓰기 — row 엔 없음)", () => {
    const carried = Meeting.parse({
      ...BASE,
      id: "m-rt-002",
      previousMeetingId: "m-rt-001",
      구분: "이월",
      이월원본행id: "old-77",
    });
    const raw = simulateUserEntered(meetingToRow(carried));
    // meetingToRow 는 AO/AP 를 쓰지 않으므로(스냅샷이 별도 기록) 라운드트립 입력에 주입.
    raw[40] = "이월";
    raw[41] = "old-77";
    expect(rowToMeeting(raw)).toEqual(carried);
  });
});

describe("R3-2 이월 DB payload(열문자 평탄화) ↔ DB 파서 정합", () => {
  // 옛 시트 raw (A~AN): 직렬 날짜·수식값·옛 previousMeetingId 포함.
  const raw: unknown[] = new Array(40).fill("");
  raw[0] = "old-id-1"; // A 옛 id — payload 에선 새 id 로 대체
  raw[1] = 46213; // B 예약일 직렬(2026-07-10)
  raw[2] = "10:00"; // C 예약시각
  raw[3] = 46215; // D 미팅날짜 직렬(2026-07-12)
  raw[4] = "14:00"; // E 미팅시간
  raw[5] = "매입DB";
  raw[6] = "이월상사";
  raw[7] = "고객 사무실"; // H 장소(스키마 필수)
  raw[9] = "예약";
  raw[10] = false;
  raw[11] = 0;
  raw[13] = "표시상세 수식값"; // N — 제외 대상
  raw[15] = "3%"; // P 계약조건
  raw[16] = "계약합성 수식값"; // Q — 제외 대상
  raw[17] = "old-prev-9"; // R — 옛 시트 내부 참조, 제외 대상
  raw[19] = "2019-03-01"; // T 개업일(업체정보 첫 필드)

  it("payload: 새 id·AO/AP 포함, R·수식(N/Q)·빈값 제외", () => {
    const p = carriedMeetingPayload({ 원본id: "old-id-1", raw }, "new-id-9");
    expect(p.A).toBe("new-id-9");
    expect(p.AO).toBe("이월");
    expect(p.AP).toBe("old-id-1");
    expect(p).not.toHaveProperty("N");
    expect(p).not.toHaveProperty("Q");
    expect(p).not.toHaveProperty("R");
    expect(p).not.toHaveProperty("S");
    expect(p).not.toHaveProperty("I"); // 빈값(예약비고) skip
  });

  it("meetingFromDbPayload 가 이월 Meeting 으로 복원 (구분·원본id·날짜 직렬 포함)", () => {
    const p = carriedMeetingPayload({ 원본id: "old-id-1", raw }, "new-id-9");
    const m = meetingFromDbPayload(p);
    expect(m).not.toBeNull();
    expect(m!.id).toBe("new-id-9");
    expect(m!.예약일).toBe("2026-07-10");
    expect(m!.미팅날짜).toBe("2026-07-12");
    expect(m!.업체명).toBe("이월상사");
    expect(m!.계약조건).toBe("3%");
    expect(m!.구분).toBe("이월");
    expect(m!.이월원본행id).toBe("old-id-1");
    expect(m!.previousMeetingId).toBeUndefined(); // R 제외 확인
    expect(m!.업체정보?.개업일).toBe("2019-03-01");
  });

  it("구형 {_carryRaw} payload 는 Meeting 복원 불가(결함 재현) — 신형 필수 근거", () => {
    const legacy = { id: "new-id-9", _carryRaw: raw, 구분: "이월", 원본행id: "old-id-1" };
    expect(meetingFromDbPayload(legacy as Record<string, unknown>)).toBeNull();
  });
});

describe("BBE-65 — DB 유니언 소스(meetingToRow 출력)도 같은 payload 함수로 무손실 왕복", () => {
  // arena-carryover.ts:96 이 실제로 만드는 raw — listCarrySourceMeetings(시트 읽기, apostrophe
  // 없음)와 달리 meetingToRow 출력(USER_ENTERED 오변환 방지 apostrophe 포함)이라 형식이 다르다.
  const DB_SOURCED = Meeting.parse({
    id: "old-db-id-1",
    예약일: "2026-07-10",
    예약시각: "10:00",
    미팅날짜: "2026-07-12",
    미팅시간: "14:30",
    channel: "매입DB",
    업체명: "이월DB상사",
    장소: "본사",
    예약비고: "고객 요청 메모, 재방문 예정",
    상태: "예약",
    계약여부: false,
    수임비: 0,
    미팅사유: "5% 할인 협의",
    계약조건: "3%",
    업체정보: {
      개업일: "2019-03-01", 신용점수: "800",
      커스텀: { 업체: { 메모: "특이사항" }, 대표자: { 등급: "A" } },
    },
  });

  it("meetingToRow → carriedMeetingPayload → meetingFromDbPayload — apostrophe 잔존·업체정보.커스텀 소실 없음", () => {
    const raw = meetingToRow(DB_SOURCED); // arena-carryover.ts 가 실제로 하는 것과 동일
    const p = carriedMeetingPayload({ 원본id: DB_SOURCED.id, raw }, "new-db-id-9");
    const m = meetingFromDbPayload(p);
    expect(m).not.toBeNull();
    // 수정 전엔 이 값들 앞에 apostrophe 가 그대로 남았다("'고객 요청 메모, 재방문 예정" 등).
    expect(m!.예약비고).toBe("고객 요청 메모, 재방문 예정");
    expect(m!.미팅사유).toBe("5% 할인 협의");
    expect(m!.계약조건).toBe("3%");
    expect(m!.업체정보?.개업일).toBe("2019-03-01");
    expect(m!.업체정보?.신용점수).toBe("800");
    // 수정 전엔 JSON.parse("'{...}") 실패 → catch 무시로 커스텀 전체가 조용히 사라졌다.
    expect(m!.업체정보?.커스텀).toEqual({ 업체: { 메모: "특이사항" }, 대표자: { 등급: "A" } });
  });
});
