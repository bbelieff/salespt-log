/**
 * 발굴 체인 PR-4 — `발굴id` 공용 계약 (lead-chain §4-3·§4-5).
 * 이 파일이 고정하는 성질을 PR-5(id 부여·보존)·PR-6(링크)이 의존한다.
 *
 *  ① DBLead·Meeting 에 발굴id 가 optional 로 존재하고 **default 가 없다**(R11 — 빈 문자열이 링크를 지우면 안 됨).
 *  ② DB payload 에 발굴id 가 실리면 **read 경로에서 살아남는다**(strip 안 됨).
 *  ③ Meeting 발굴id 는 **시트에 안 써진다**(meetingToRow 명시 컬럼만 — 04 읽기 range 무변경).
 */
import { describe, expect, it } from "vitest";
import { DBLead, Meeting } from "@/types";
import { meetingToRow } from "@/repo/meetings-rows";
import { meetingFromDbPayload } from "@/repo/db/read-daily";

describe("발굴id 스키마 계약 (R11 — optional, no default)", () => {
  it("DBLead.발굴id 는 optional·default 없음 — 미지정 시 키 부재(undefined)", () => {
    const l = DBLead.parse({ 업체명: "가나상사" });
    expect(l.발굴id).toBeUndefined();
    expect("발굴id" in l).toBe(false); // default("") 였다면 "" 로 존재해 병합에서 링크를 지운다
  });

  it("Meeting.발굴id 는 optional·default 없음 — 미지정 시 키 부재", () => {
    const m = Meeting.parse({
      id: "m1", 예약일: "2026-07-10", 예약시각: "10:00", 미팅날짜: "2026-07-10",
      미팅시간: "14:00", channel: "콜·지·기·소", 업체명: "가나상사", 장소: "서울",
      예약비고: "", 상태: "예약", 계약여부: false, 수임비: 0, 미팅사유: "", 계약조건: "",
    });
    expect(m.발굴id).toBeUndefined();
    expect("발굴id" in m).toBe(false);
  });

  it("지정 시 값 보존 — 빈 문자열도 허용(무효화용, B3)", () => {
    expect(DBLead.parse({ 발굴id: "uuid-1" }).발굴id).toBe("uuid-1");
    expect(DBLead.parse({ 발굴id: "" }).발굴id).toBe(""); // clearLead 가 명시 무효화에 쓴다
  });
});

describe("DB payload 왕복 — 발굴id 가 read 경로에서 살아남는다", () => {
  it("meetingFromDbPayload 가 발굴id 를 strip 하지 않는다(스키마에 있으므로)", () => {
    const payload = {
      id: "m1", 예약일: "2026-07-10", 예약시각: "10:00", 미팅날짜: "2026-07-10",
      미팅시간: "14:00", channel: "콜·지·기·소", 업체명: "가나상사", 장소: "서울",
      예약비고: "", 상태: "예약", 계약여부: false, 수임비: 0, 미팅사유: "", 계약조건: "",
      발굴id: "uuid-42",
    };
    expect(meetingFromDbPayload(payload)?.발굴id).toBe("uuid-42");
  });
});

describe("시트 격리 — Meeting.발굴id 는 시트 행에 안 써진다(§4-5)", () => {
  it("meetingToRow 결과 어디에도 발굴id 값이 없다(04 읽기 range 무변경 전제)", () => {
    const m = Meeting.parse({
      id: "m1", 예약일: "2026-07-10", 예약시각: "10:00", 미팅날짜: "2026-07-10",
      미팅시간: "14:00", channel: "콜·지·기·소", 업체명: "가나상사", 장소: "서울",
      예약비고: "", 상태: "예약", 계약여부: false, 수임비: 0, 미팅사유: "", 계약조건: "",
      발굴id: "uuid-should-not-reach-sheet",
    });
    const row = meetingToRow(m);
    expect(row.some((c) => String(c ?? "").includes("uuid-should-not-reach-sheet"))).toBe(false);
  });
});
