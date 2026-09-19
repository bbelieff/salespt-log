/**
 * 2026-09-19 — 누적 실적의 **계약만** 1주차 것만 세던 버그.
 *
 * 무엇이 터졌나: 수강생이 「역산제안이 안 된다」고 신고했다. 화면엔 생산·유입·컨택·미팅
 * 누적 수치가 멀쩡히 보이는데 제안은 전부 「계산 불가」였다.
 *
 * 원인: `weeklyContractsFromDb` / `terminatedByWeek` 는 **주차별 배열**을 돌려주는데
 * `[0]`(= 범위의 첫 주)만 꺼내 썼다. 한 주짜리 창에선 맞지만 **누적(1주차~지난주)** 에선
 * 첫 주 계약만 세게 된다. 실제 그 수강생의 첫 계약은 **3주차**였다 → 누적계약 0 →
 * 역산은 계약 1건당 비율로 계산하므로(docs/domains/weekly-goals.md §초안 편의 기능)
 * 전 항목 null.
 *
 * 곁다리로 span 도 고쳤다 — 기본값 STATS_WEEKS(8)라 12주 과정(ADR-0032)의 9주차 이후
 * 계약이 누적에서 빠졌다.
 */
import { describe, expect, it } from "vitest";
import { weeklyGoalActuals } from "@/service/weekly-goals-actuals";
import type { Meeting, ContractPayment } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";

const WEEK1 = "2026-08-07"; // 수강 1주차 시작(금)

/** 계약 성사된 미팅 1건. 정의는 weeklyContractsFromDb 와 같다(상태 === "계약"). */
const contractMeeting = (date: string): Meeting =>
  ({ 미팅날짜: date, 상태: "계약", 업체명: "가", 계약여부: true }) as unknown as Meeting;

const doneMeeting = (date: string): Meeting =>
  ({ 미팅날짜: date, 상태: "완료", 업체명: "나", 계약여부: false }) as unknown as Meeting;

const sale = (date: string, production: number): DbSalesRow =>
  ({ date, channel: "현수막", production, inflow: 0, contactProgress: 0 }) as unknown as DbSalesRow;

const NO_PAY: ContractPayment[] = [];

describe("누적 구간의 계약 집계", () => {
  it("★1주차에 계약이 없어도 이후 주차 계약을 센다 — 신고 케이스", () => {
    // 첫 계약이 3주차(08-20). 예전 코드는 [0](1주차)만 봐서 0 을 돌려줬다.
    const meetings = [contractMeeting("2026-08-20")];
    const a = weeklyGoalActuals([], meetings, NO_PAY, WEEK1, "2026-09-17");
    expect(a.contracts).toBe(1);
  });

  it("★여러 주에 흩어진 계약을 전부 합산한다", () => {
    const meetings = [
      contractMeeting("2026-08-20"), // 3주차
      contractMeeting("2026-08-21"), // 3주차
      contractMeeting("2026-09-03"), // 5주차
      contractMeeting("2026-09-16"), // 7주차
    ];
    const a = weeklyGoalActuals([], meetings, NO_PAY, WEEK1, "2026-09-17");
    expect(a.contracts).toBe(4);
  });

  it("★9주차 이후도 빠지지 않는다 — 12주 과정(ADR-0032)", () => {
    // 기본 span 이 8주라 9주차 계약이 조용히 사라지던 자리.
    const wk10 = "2026-10-09"; // 1주차(08-07)로부터 9주 뒤
    const meetings = [contractMeeting(wk10)];
    const a = weeklyGoalActuals([], meetings, NO_PAY, WEEK1, "2026-10-29");
    expect(a.contracts).toBe(1);
  });

  it("범위 밖 계약은 안 센다", () => {
    const meetings = [contractMeeting("2026-09-25")]; // end 이후
    const a = weeklyGoalActuals([], meetings, NO_PAY, WEEK1, "2026-09-17");
    expect(a.contracts).toBe(0);
  });

  it("「완료」는 계약이 아니다 — 기존 정의 유지", () => {
    const a = weeklyGoalActuals([], [doneMeeting("2026-08-20")], NO_PAY, WEEK1, "2026-09-17");
    expect(a.contracts).toBe(0);
    expect(a.meetings).toBe(1); // 미팅완료로는 잡힌다
  });
});

describe("한 주짜리 창은 예전과 같아야 한다 — 대시보드 수치 불변", () => {
  it("그 주 계약만 센다", () => {
    const meetings = [
      contractMeeting("2026-09-11"), // 창 안
      contractMeeting("2026-09-04"), // 창 밖(이전 주)
    ];
    const a = weeklyGoalActuals([], meetings, NO_PAY, "2026-09-11", "2026-09-17");
    expect(a.contracts).toBe(1);
  });
});

describe("다른 지표는 원래 구간 합이었다 — 회귀 확인", () => {
  it("생산은 구간 전체를 더한다", () => {
    const sales = [sale("2026-08-20", 10), sale("2026-09-03", 20)];
    const a = weeklyGoalActuals(sales, [], NO_PAY, WEEK1, "2026-09-17");
    expect(a.production).toBe(30);
  });
});
