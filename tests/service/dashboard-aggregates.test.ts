/**
 * R2-7a 대시보드 재계산 순수 함수 단위 대조. 그림자 대조는 실데이터 diff 가 최종 검증(R2-7b 게이트)이지만,
 * 여기서 각 재계산의 도메인 규칙(불변식①·주차·미팅상태·이월)을 고정한다.
 * ⚠️ 활동량(미팅/생산 정의)은 실측 규명 완료(2026-07-09). B21(누적수임비)은 정의 belie 확정
 *    (2026-08-05, BBE-66) — 단 파일럿 전원 실측 diff 0 은 미완(dashboard-aggregates.ts 상단 참고).
 *    여기 테스트는 "설계대로 구현됐는지"를 고정할 뿐, 시트 실측 일치는 별도.
 */
import { describe, expect, it } from "vitest";
import type { ContractPayment, Meeting } from "@/types";
import type { DbSalesRow } from "@/repo/db/client";
import { MAX_SHEET_WEEK, STATS_WEEKS } from "@/config/cohort-dates"; // 리터럴 금지(period-hardcode G3)
import {
  arenaFeeFromDb,
  channelStackingFromDb,
  computeDbAggregates,
  diffDashboardAggregates,
  weeklyActivityFromDb,
  weeklyContractsFromDb,
  weeklyFeeFromMeetings,
} from "@/service/dashboard-aggregates";

const CS = new Date(2026, 5, 1); // courseStart 2026-06-01 (로컬 자정)
const CS_ISO = "2026-06-01";

function sales(date: string, channel: string, p: number, i: number, c: number, mr: number): DbSalesRow {
  return { date, channel, production: p, inflow: i, contactProgress: c, meetingReservation: mr } as DbSalesRow;
}
function mtg(partial: Partial<Meeting>): Meeting {
  return {
    id: partial.id ?? "m", 예약일: "", 예약시각: "", 미팅날짜: partial.미팅날짜 ?? "",
    미팅시간: "", channel: partial.channel ?? "매입DB", 업체명: "업체", 장소: "서울",
    예약비고: "", 상태: partial.상태 ?? "예약", 계약여부: partial.계약여부 ?? false,
    수임비: partial.수임비 ?? 0, 구분: partial.구분 ?? "", 미팅사유: "", 계약조건: "",
  } as Meeting;
}
function contract(수임비: number, 구분 = "", 계약일 = "2026-06-10"): ContractPayment {
  return { row: 3, 계약일, 업체명: "x", 수임비, 구분,
    수납1: {}, 수납2: {}, 수납3: {} } as unknown as ContractPayment;
}

describe("R2-7a channelStackingFromDb (01!R1:U6)", () => {
  it("생산/유입/컨택진행 = salesRows 채널별 합 (미팅예약은 미팅 카드 기반, sales 아님)", () => {
    const rows = [
      sales("2026-06-02", "매입DB", 10, 5, 4, 2),
      sales("2026-06-03", "매입DB", 3, 1, 1, 1),
      sales("2026-06-02", "현수막", 7, 0, 2, 0),
    ];
    const m = channelStackingFromDb(rows, [], CS);
    const 매입 = m.find((x) => x.채널 === "매입DB")!;
    expect(매입).toMatchObject({ 생산: 13, 유입: 6, 컨택진행: 5, 미팅예약: 0 }); // 미팅 카드 없음 → 0
    expect(m.find((x) => x.채널 === "현수막")!.생산).toBe(7);
  });

  it("누적 퍼널: 미팅예약=상태∈{예약,완료,계약}, 미팅완료=상태∈{완료,계약}, 계약=계약여부", () => {
    // ※ 계약 카운트는 R6(=N 주차블록 합) 대칭이라 **미팅날짜가 창 안**이어야 계상된다(아래 R4 클램프
    //   describe 참조). 픽스처에 코스 기간 내 날짜를 준다 — 실제 계약 미팅은 미팅날짜를 갖는다.
    const IN = "2026-06-10"; // 2주차
    const meetings = [
      mtg({ channel: "매입DB", 상태: "예약", 미팅날짜: IN }),
      mtg({ channel: "매입DB", 상태: "완료", 미팅날짜: IN }),
      mtg({ channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: IN }),
      mtg({ channel: "매입DB", 상태: "변경", 미팅날짜: IN }), // 퍼널 제외
      mtg({ channel: "매입DB", 상태: "취소", 미팅날짜: IN }), // 퍼널 제외
    ];
    const 매입 = channelStackingFromDb([], meetings, CS).find((x) => x.채널 === "매입DB")!;
    expect(매입.미팅예약).toBe(3); // 예약+완료+계약 (변경·취소 제외)
    expect(매입.미팅완료).toBe(2); // 완료+계약
    expect(매입.계약).toBe(1); // 계약여부 true
  });

  it("미팅날짜 없는 계약은 계상 안 함 — 시트 N 주차행에도 안 걸린다(fail-closed)", () => {
    const 매입 = channelStackingFromDb(
      [],
      [mtg({ channel: "매입DB", 상태: "계약", 계약여부: true })], // 미팅날짜 ""
      CS,
    ).find((x) => x.채널 === "매입DB")!;
    expect(매입.계약).toBe(0);
    expect(매입.미팅예약).toBe(1); // 예약·완료는 COUNTIFS(무필터) 대칭 — 날짜와 무관
  });

  it("오염 채널(CHANNEL_ORDER 밖) 무시, 4채널 항상 반환", () => {
    const m = channelStackingFromDb([sales("2026-06-02", "coljigiso", 9, 9, 9, 9)], [], CS);
    expect(m).toHaveLength(4);
    expect(m.every((x) => x.생산 === 0)).toBe(true);
  });

  // R4 W1-1: 무제한 쓰기(9주+ DB-only)가 코스 지표를 오염시키지 않는다는 계약.
  // 상한 = STATS_WEEKS(R1:U6 실제 합산 범위) — 리터럴 금지(period-hardcode G4).
  // ⚠️ BBE-120(2026-08-10) 실측 정정: FORMULA 렌더옵션으로 R1:U6 수식 원문을 직접 읽어
  // 확인(연습 계정 + 실제 A2-7기 학생 2곳 모두 동일) — `=E10+E14+…+E272`(56항=8주×7일,
  // 1~8주만). 이전 버전은 MAX_SHEET_WEEK(10, 시트 쓰기 물리 상한)를 이 클램프에 잘못
  // 재사용했었다 — MAX_SHEET_WEEK 는 `lib/repo/sales.ts` 의 쓰기 좌표 계산 상한일 뿐,
  // R1:U6 재계산의 창은 아니다. 이 오분류가 실사용자 3명의 parity 오탐(sheet<db)
  // 근인이었다(run 31361493846).
  describe("R4 클램프 — 시트 표현 가능 창 밖(STATS_WEEKS+1주+) 은 집계 제외", () => {
    /** courseStart(CS) 로부터 week 번째 주의 임의 날짜(주 시작일). */
    const dateOfWeek = (week: number): string => {
      const d = new Date(CS);
      d.setDate(d.getDate() + (week - 1) * 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    it(`${"STATS_WEEKS"} 이내 행은 그대로 합산(오늘 수치 불변 보증)`, () => {
      const rows = [
        sales(dateOfWeek(1), "매입DB", 1, 0, 0, 0),
        sales(dateOfWeek(STATS_WEEKS), "매입DB", 2, 0, 0, 0), // 경계 = 포함
      ];
      const 매입 = channelStackingFromDb(rows, [], CS).find((x) => x.채널 === "매입DB")!;
      expect(매입.생산).toBe(3);
    });

    it("상한 밖(STATS_WEEKS+1 주차) 행은 생산/유입/컨택진행에 합산되지 않는다", () => {
      const rows = [
        sales(dateOfWeek(1), "매입DB", 5, 5, 5, 0),
        sales(dateOfWeek(STATS_WEEKS + 1), "매입DB", 100, 100, 100, 0), // 9주+ = DB-only 저장분
      ];
      const 매입 = channelStackingFromDb(rows, [], CS).find((x) => x.채널 === "매입DB")!;
      expect(매입).toMatchObject({ 생산: 5, 유입: 5, 컨택진행: 5 }); // 부풀림 0
    });

    it("BBE-120 반증 — MAX_SHEET_WEEK(시트 물리 상한) 이내라도 STATS_WEEKS 밖(9~10주)이면 제외된다", () => {
      // 이전 버그의 정확한 재현: week9·10 은 시트에 물리적으로 쓸 순 있지만(MAX_SHEET_WEEK=10),
      // R1:U6 수식은 8주까지만 더한다 — 물리 상한과 합산 창은 다른 개념이다.
      expect(STATS_WEEKS).toBeLessThan(MAX_SHEET_WEEK); // 전제 고정(두 상수가 같아지면 이 테스트 무의미)
      const rows = [
        sales(dateOfWeek(1), "매입DB", 1, 0, 0, 0),
        sales(dateOfWeek(STATS_WEEKS + 1), "매입DB", 50, 0, 0, 0), // 9주 — MAX_SHEET_WEEK 이내지만 제외 대상
        sales(dateOfWeek(MAX_SHEET_WEEK), "매입DB", 50, 0, 0, 0), // 10주 — 마찬가지로 제외 대상
      ];
      const 매입 = channelStackingFromDb(rows, [], CS).find((x) => x.채널 === "매입DB")!;
      expect(매입.생산).toBe(1); // 9·10주차 100 이 안 섞여야 함(부풀림 0)
    });

    it("먼 미래(수료 한참 뒤) 기록이 쌓여도 코스 지표는 고정", () => {
      const far = [40, 80, 200].map((w) => sales(dateOfWeek(w), "현수막", 7, 7, 7, 0));
      const 현수막 = channelStackingFromDb(far, [], CS).find((x) => x.채널 === "현수막")!;
      expect(현수막).toMatchObject({ 생산: 0, 유입: 0, 컨택진행: 0 });
    });

    // 적대리뷰 M2 반영 — 초판은 "하한은 클램프하지 않는다(parity 보존)"로 **구멍을 계약으로 잠갔다**.
    // 실제로는 삭제된 쓰기 가드가 주차 0 기입도 막고 있었고, 시트엔 주차 0 좌표가 없으므로
    // 하한을 열어두는 것이 곧 parity 위반이다. 계약을 뒤집는다.
    it("하한(수강 시작 전 = 주차 0) 행도 집계에서 제외 — 시트에 좌표가 없다", () => {
      const before = new Date(CS);
      before.setDate(before.getDate() - 3); // 수강 시작 3일 전 = weekIndexOf 0
      const iso = `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, "0")}-${String(before.getDate()).padStart(2, "0")}`;
      const 매입 = channelStackingFromDb([sales(iso, "매입DB", 4, 0, 0, 0)], [], CS).find(
        (x) => x.채널 === "매입DB",
      )!;
      expect(매입.생산).toBe(0);
    });

    // M3 — **시트 실수식 실측(2026-07-28, 연습 시트 01!R1:U6)** 이 확정한 단계별 비대칭:
    //   R4 미팅예약 · R5 미팅완료 = COUNTIFS(04!F:F, J:J) → **날짜 무필터** → 클램프 금지
    //   R6 계약        = `=N10+N14+…+N272`            → **주차블록 합**   → 클램프 필요
    // 셋을 같은 규칙으로 묶으면 어느 쪽이든 시트↔DB parity 가 영구 diff 를 낸다.
    // ⚠️ 시트 수식이 바뀌면 이 테스트가 먼저 깨져야 한다(= 그때 코드도 함께 바꾼다).
    it("클램프 밖(먼 미래) 미팅: 예약·완료는 세고(COUNTIFS 대칭), 계약만 제외(N 주차블록 합 대칭)", () => {
      const far = new Date(CS);
      far.setDate(far.getDate() + (MAX_SHEET_WEEK + 5) * 7); // 15주차쯤(STATS_WEEKS 도 MAX_SHEET_WEEK 도 넘음)
      const iso = `${far.getFullYear()}-${String(far.getMonth() + 1).padStart(2, "0")}-${String(far.getDate()).padStart(2, "0")}`;
      const 매입 = channelStackingFromDb(
        [],
        [
          mtg({ channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: iso, 예약일: iso }),
          mtg({ channel: "매입DB", 상태: "완료", 미팅날짜: iso, 예약일: iso }),
        ],
        CS,
      ).find((x) => x.채널 === "매입DB")!;
      expect(매입).toMatchObject({ 미팅예약: 2, 미팅완료: 2, 계약: 0 });
    });

    it("코스 기간 안 계약은 그대로 계상(클램프가 정상 데이터를 깎지 않는다)", () => {
      const d = new Date(CS);
      d.setDate(d.getDate() + 7); // 2주차
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const 매입 = channelStackingFromDb(
        [],
        [mtg({ channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: iso, 예약일: iso })],
        CS,
      ).find((x) => x.채널 === "매입DB")!;
      expect(매입).toMatchObject({ 미팅예약: 1, 미팅완료: 1, 계약: 1 });
    });
  });
});

describe("R2-7a weeklyContractsFromDb (01!N{38..276})", () => {
  it("상태=계약 미팅을 미팅날짜 weekIndexOf 1~8 버킷", () => {
    const meetings = [
      mtg({ 상태: "계약", 미팅날짜: "2026-06-01" }), // 주1
      mtg({ 상태: "계약", 미팅날짜: "2026-06-08" }), // 주2
      mtg({ 상태: "계약", 미팅날짜: "2026-06-09" }), // 주2
      mtg({ 상태: "완료", 미팅날짜: "2026-06-08" }), // 계약 아님 — 제외
      mtg({ 상태: "계약", 미팅날짜: "2026-05-30" }), // 수강전(주0) — 제외
    ];
    const w = weeklyContractsFromDb(meetings, CS);
    expect(w[0]).toBe(1); // 주1
    expect(w[1]).toBe(2); // 주2
    expect(w.slice(2).every((x) => x === 0)).toBe(true);
  });

  it("9~10주(유예) 계약은 8슬롯 밖 제외", () => {
    // 2026-06-01 + 8주*7=56일 = 2026-07-27 이 9주 시작
    const w = weeklyContractsFromDb([mtg({ 상태: "계약", 미팅날짜: "2026-07-27" })], CS);
    expect(w.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("R2-7a weeklyActivityFromDb (대시보드 H33:H40, 불변식①)", () => {
  it("생산×1 + 컨택×1.5 + 미팅완료×2(by 미팅날짜, 상태∈{완료,계약})", () => {
    const rows = [
      sales("2026-06-02", "매입DB", 10, 4, 4, 9), // 주1: 생산10 + 컨택4×1.5=6 = 16 (sales.미팅예약 9는 미사용)
      sales("2026-06-08", "현수막", 0, 2, 2, 5), // 주2: 컨택2×1.5=3
    ];
    const meetings = [
      mtg({ 상태: "완료", 미팅날짜: "2026-06-03" }), // 주1: +2
      mtg({ 상태: "계약", 미팅날짜: "2026-06-04" }), // 주1: +2
      mtg({ 상태: "예약", 미팅날짜: "2026-06-05" }), // 미완료 — 미포함
      mtg({ 상태: "완료", 미팅날짜: "2026-06-09" }), // 주2: +2
    ];
    const w = weeklyActivityFromDb(rows, meetings, CS);
    expect(w[0]).toBe(10 + 6 + 4); // 20 (미팅완료 2건×2)
    expect(w[1]).toBe(3 + 2); // 5 (미팅완료 1건×2)
  });

  it("컨택 홀수 → ×1.5 소수 유지(반올림 안 함 — 시트 H 도 소수)", () => {
    const w = weeklyActivityFromDb([sales("2026-06-02", "매입DB", 0, 1, 1, 0)], [], CS);
    expect(w[0]).toBe(1.5);
  });
});

describe("R2-7a arenaFeeFromDb + diff", () => {
  it("이월 제외 Σ수임비", () => {
    const cs = [contract(100), contract(50, "이월"), contract(30)];
    expect(arenaFeeFromDb(cs, CS, CS_ISO)).toBe(130); // 이월 50 제외
  });

  it("BBE-252 후속(2026-08-20) — STATS_WEEKS(8) 창 밖(9주+) 계약은 제외한다(시트 B21=O4=O38+...+O276, 1~8주 stride 합만)", () => {
    // courseStart+9주째(63일 후) 계약 — weeklyContractsFromDb 등 다른 3개 집계와 동일 클램프.
    const 창밖계약일 = new Date(CS.getTime() + 63 * 86400000);
    const iso = `${창밖계약일.getFullYear()}-${String(창밖계약일.getMonth() + 1).padStart(2, "0")}-${String(창밖계약일.getDate()).padStart(2, "0")}`;
    const cs = [contract(100), contract(9999, "", iso)]; // 두번째는 9주차 — 클램프 대상
    expect(arenaFeeFromDb(cs, CS, CS_ISO)).toBe(100); // 9999 는 창 밖이라 제외
  });
});

describe("BBE-252(2026-08-21) — weeklyFeeFromMeetings + 6기 소스 정렬(computeDbAggregates)", () => {
  it("상태=계약인 미팅의 수임비만 1~8주 버킷 합산(완료·예약·이월 제외)", () => {
    const meetings = [
      mtg({ 미팅날짜: "2026-06-10", 상태: "계약", 수임비: 500_000 }), // 포함
      mtg({ 미팅날짜: "2026-06-11", 상태: "완료", 수임비: 999_999 }), // 상태 불일치 — 제외
      mtg({ 미팅날짜: "2026-06-12", 상태: "계약", 수임비: 300_000, 구분: "이월" }), // 이월 — weeklyContractsFromDb 와 달리 이 함수는 날짜창만 보므로 실제로는 포함됨을 검증(아래 별도 케이스)
    ];
    // 이월 케이스는 별도로 분리 검증(위 3번째 원소 제거) — 시트 SUMIFS 원문에 AO 필터가 없어
    // weeklyFeeFromMeetings 도 날짜창만 본다(주석·PR 설명과 일치하는 의도적 설계).
    expect(weeklyFeeFromMeetings(meetings.slice(0, 2), CS)).toBe(500_000);
  });

  it("9주+(창 밖) 계약 미팅은 제외한다 — O4=O38+...+O276 8개 stride 항만", () => {
    const 구주차 = new Date(CS.getTime() + 63 * 86400000);
    const iso = `${구주차.getFullYear()}-${String(구주차.getMonth() + 1).padStart(2, "0")}-${String(구주차.getDate()).padStart(2, "0")}`;
    const meetings = [mtg({ 미팅날짜: "2026-06-10", 상태: "계약", 수임비: 100 }), mtg({ 미팅날짜: iso, 상태: "계약", 수임비: 9999 })];
    expect(weeklyFeeFromMeetings(meetings, CS)).toBe(100);
  });

  it("computeDbAggregates — cohort='6' 이면 meetings.수임비+legacy오프셋, cohort 없으면 기존 계약(02) 기준 그대로(회귀 0)", () => {
    const meetings = [mtg({ 미팅날짜: "2026-06-10", 상태: "계약", 수임비: 500_000 })];
    const contracts = [contract(700_000)]; // 02 계약 테이블 값 — 6기 정렬 시엔 무시돼야 함
    const alignedOffsetSid = "1-yN9iy37CctJ2s_ZUMcb3S7qozIwOfqzdLIHBmyWoXU"; // LEGACY_FEE_OFFSET 실제 키(660,000)
    const aligned = computeDbAggregates([], meetings, contracts, CS, CS_ISO, { cohort: "6기", spreadsheetId: alignedOffsetSid });
    expect(aligned.누적수임비).toBe(500_000 + 660_000); // meetings 합 + 6기 legacy 오프셋

    const unaligned7 = computeDbAggregates([], meetings, contracts, CS, CS_ISO, { cohort: "7기", spreadsheetId: alignedOffsetSid });
    expect(unaligned7.누적수임비).toBe(700_000); // 7기는 여전히 계약(02) 기준 — 정렬 무관

    const noFeeSource = computeDbAggregates([], meetings, contracts, CS, CS_ISO);
    expect(noFeeSource.누적수임비).toBe(700_000); // feeSource 생략(파일럿 등 기존 호출부) — 회귀 0
  });

  it("diffDashboardAggregates: 불일치 필드만 반환", () => {
    const base = {
      channelMatrix: channelStackingFromDb([sales("2026-06-02", "매입DB", 10, 0, 0, 0)], [], CS),
      weeklyContracts: [1, 0, 0, 0, 0, 0, 0, 0],
      weeklyActivity: [20, 0, 0, 0, 0, 0, 0, 0],
      누적수임비: 100,
    };
    const same = diffDashboardAggregates(base, base);
    expect(same).toHaveLength(0);
    const changed = { ...base, 누적수임비: 200 };
    const d = diffDashboardAggregates(base, changed);
    expect(d).toEqual([{ field: "누적수임비", sheet: 100, db: 200 }]);
  });
});
