// 2026-10-12 #7 — 계약 → 연결 미팅 채널(대시보드 contractChannels · 해지 차감 공용 규칙).
import { describe, expect, it } from "vitest";
import { ContractPayment, type Meeting } from "@/types";
import { contractChannels, contractMeetingResolver } from "@/service/contract-channel";

const cp = (over: Partial<ContractPayment>): ContractPayment =>
  ContractPayment.parse({ 계약일: "2026-10-01", 업체명: "샘플상사", 수임비: 1000, ...over });

const mt = (over: Partial<Meeting> & { id: string }): Meeting => ({
  예약일: "2026-09-28", 예약시각: "10:00", 미팅날짜: "2026-10-01", 미팅시간: "10:00",
  channel: "직접생산", 업체명: "샘플상사", 장소: "가상 카페", 예약비고: "",
  상태: "계약", 계약여부: true, 수임비: 1000, 미팅사유: "", 계약조건: "",
  ...over,
}) as Meeting;

describe("contractMeetingResolver", () => {
  it("AK(linkedMeetingId) 가 맞으면 그 미팅 — 이름이 달라도", () => {
    const resolve = contractMeetingResolver([mt({ id: "m1", channel: "현수막", 업체명: "옛이름상사" })]);
    expect(resolve(cp({ linkedMeetingId: "m1", 업체명: "새이름상사" }))?.channel).toBe("현수막");
  });
  it("AK 가 비면 계약일|업체명 첫 일치 미팅", () => {
    const resolve = contractMeetingResolver([
      mt({ id: "m1", channel: "매입DB", 업체명: "가상식품" }),
      mt({ id: "m2", channel: "현수막", 업체명: "가상식품" }),
    ]);
    expect(resolve(cp({ 업체명: "가상식품" }))?.id).toBe("m1");
  });
  it("manual: 은 미팅이 없다(같은 이름 미팅이 있어도)", () => {
    const resolve = contractMeetingResolver([mt({ id: "m1" })]);
    expect(resolve(cp({ linkedMeetingId: "manual:req-1" }))).toBeUndefined();
  });
  it("미팅 상태·이월과 상관없이 채널 출처를 돌려준다", () => {
    const resolve = contractMeetingResolver([mt({ id: "m1", 상태: "취소", 계약여부: false, 구분: "이월", channel: "콜·지·기·소" })]);
    expect(resolve(cp({ linkedMeetingId: "m1" }))?.channel).toBe("콜·지·기·소");
  });
});

describe("contractChannels — 대시보드 응답 필드", () => {
  it("행마다 { key, channel } — 못 찾으면 null", () => {
    const payments = [
      cp({ row: 3, linkedMeetingId: "m1" }),
      cp({ row: 4, 업체명: "가상식품" }),
      cp({ row: 5, linkedMeetingId: "manual:req-1", 업체명: "가상공방" }),
      cp({ row: 6, linkedMeetingId: "지워진-미팅", 업체명: "없는상사" }),
      cp({ row: 7, 업체명: "이전계약상사" }),
    ];
    const meetings = [mt({ id: "m1", channel: "현수막" }), mt({ id: "m2", channel: "매입DB", 업체명: "가상식품" })];
    expect(contractChannels(payments, meetings)).toEqual([
      { key: "3|ak:m1", channel: "현수막" },
      { key: "4|2026-10-01|가상식품", channel: "매입DB" },
      { key: "5|ak:manual:req-1", channel: null },
      { key: "6|ak:지워진-미팅", channel: null },
      { key: "7|2026-10-01|이전계약상사", channel: null },
    ]);
  });
});
