/**
 * 계약해지 (contract-termination) 정합:
 *  ① 시트 파서(rowToCP) AL~AO 왕복 ② DB payload(필드명·열문자) 동치
 *  ③ 매출 = 수임비+수납 − 반환액(이월 제외 일관) ④ 서비스 입력 검증
 *  ⑤ 판정·건수 정책 단일 결정점
 */
import { describe, expect, it } from "vitest";
import { rowToCP } from "@/repo/contract-payment";
import { contractFromDbPayload } from "@/repo/db/read-daily";
import { computeContractRevenue, splitContractRevenue } from "@/service/dashboard";
import { terminateContract } from "@/service/contract-payment";
import {
  isTerminatedContract,
  TERMINATED_IN_CONTRACT_COUNT,
  ContractPayment,
} from "@/types";

function cpWith(over: Partial<ContractPayment>): ContractPayment {
  return ContractPayment.parse({ 계약일: "2026-07-01", 업체명: "업체", 수임비: 1000, ...over });
}

describe("계약해지 — 파서·payload 정합", () => {
  it("① 시트 행 AL~AO → 해지 필드 왕복 (Y/빈값 boolean 포함)", () => {
    const r: unknown[] = new Array(41).fill("");
    r[2] = "2026-07-01"; r[3] = "해지업체"; r[4] = 500;
    r[37] = "2026-07-12"; r[38] = "고객 요청"; r[39] = 200; r[40] = "Y";
    const cp = rowToCP(r, 6)!;
    expect(cp.해지일).toBe("2026-07-12");
    expect(cp.해지사유).toBe("고객 요청");
    expect(cp.반환액).toBe(200);
    expect(cp.해지숨김).toBe(true);
    expect(isTerminatedContract(cp)).toBe(true);
  });

  it("② DB 필드명 payload(writeTermination 미러) == 시트 파서 결과", () => {
    const p = {
      계약일: "2026-07-01", 업체명: "해지업체", 수임비: 500,
      해지일: "2026-07-12", 해지사유: "고객 요청", 반환액: 200, 해지숨김: true,
    };
    const cp = contractFromDbPayload(p, 6)!;
    expect(cp.해지일).toBe("2026-07-12");
    expect(cp.반환액).toBe(200);
    expect(cp.해지숨김).toBe(true);
  });

  it("② DB 열문자 payload(backfill 문자열화) == 동일 결과", () => {
    const p = {
      C: "2026-07-01", D: "해지업체", E: "500",
      AL: "2026-07-12", AM: "고객 요청", AN: "200", AO: "Y",
      _backfill: true,
    };
    const cp = contractFromDbPayload(p, 6)!;
    expect(cp.해지일).toBe("2026-07-12");
    expect(cp.반환액).toBe(200);
    expect(cp.해지숨김).toBe(true);
  });

  it("미해지 행은 기본값 (해지 아님·차감 0)", () => {
    const cp = cpWith({});
    expect(isTerminatedContract(cp)).toBe(false);
    expect(cp.반환액).toBe(0);
  });
});

describe("계약해지 — 매출 규칙 (수임비+수납 − 반환액)", () => {
  const normal = cpWith({ 수임비: 1000, 수납1: { 진행기관: "A", 진행률: "", 현황: "", 승인금액: 0, 수납액: 300, 수납일: "", 메모: "" } });
  const terminated = cpWith({
    업체명: "해지", 수임비: 500, 해지일: "2026-07-12", 해지사유: "환불", 반환액: 400, 해지숨김: true,
  });

  it("③ 해지 계약도 수임비·수납은 합산, 반환액만 차감 (숨김이어도)", () => {
    const { totalFee, totalReceived, totalRefunded, revenue } =
      computeContractRevenue([normal, terminated]);
    expect(totalFee).toBe(1500);
    expect(totalReceived).toBe(300);
    expect(totalRefunded).toBe(400);
    expect(revenue).toBe(1400); // 1500 + 300 − 400
  });

  it("③ 이월 계약은 반환액도 아레나(본인) 매출 차감에서 제외 — 기존 이월 규칙 일관", () => {
    const carryTerminated = cpWith({ 구분: "이월", 수임비: 900, 반환액: 100, 해지일: "2026-07-12" });
    const { revenue, totalRefunded } = computeContractRevenue([normal, carryTerminated]);
    expect(totalRefunded).toBe(0); // 이월은 continue — 수임비·수납과 같은 취급
    expect(revenue).toBe(1300);
  });

  it("③ splitContractRevenue — 버킷별 반환 차감 + 전체 합 일치", () => {
    const { arena, carryover, total } = splitContractRevenue(
      [normal, terminated, cpWith({ 구분: "이월", 수임비: 200, 반환액: 50, 해지일: "2026-07-12" })],
      "2026-06-01",
    );
    expect(arena.revenue).toBe(1400); // (1000+500) + 300 − 400
    expect(carryover.revenue).toBe(150); // 200 − 50
    expect(total.revenue).toBe(arena.revenue + carryover.revenue);
    expect(total.totalRefunded).toBe(450);
  });
});

describe("계약해지 — 서비스 검증 (repo 도달 전 차단)", () => {
  it("④ 사유 없으면 throw", async () => {
    await expect(
      terminateContract("x@y.z", { row: 6, 사유: "  ", 반환액: 0, 숨김: false }),
    ).rejects.toThrow("해지 사유");
  });

  it("④ 반환액 음수/NaN 이면 throw", async () => {
    await expect(
      terminateContract("x@y.z", { row: 6, 사유: "환불", 반환액: -1, 숨김: false }),
    ).rejects.toThrow("반환액");
    await expect(
      terminateContract("x@y.z", { row: 6, 사유: "환불", 반환액: NaN, 숨김: false }),
    ).rejects.toThrow("반환액");
  });

  it("⑤ 건수 정책 상수 — 기본 제외(해지 N건 별도 표시)", () => {
    expect(TERMINATED_IN_CONTRACT_COUNT).toBe(false);
  });
});
