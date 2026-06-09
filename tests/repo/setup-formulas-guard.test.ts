/**
 * 단위 테스트: installFormulas 의 isSafeToOverwrite 가드.
 *
 * 2026-05-14 사고 후속: 사용자가 영업관리 I~P 컬럼에 raw 값 수동 입력했는데
 * installFormulas 가 무조건 수식으로 덮어써 데이터 손실. 재발 차단 위해
 * 셀별 pre-check 도입 — 이 함수의 분기 정확도가 핵심.
 */
import { describe, it, expect } from "vitest";
import {
  computeDataRows,
  dayPrimaryRow,
  formulasForRow,
  meetingFunnelFormulas,
  isSafeToOverwrite,
} from "../../lib/repo/setup-formulas";

describe("isSafeToOverwrite — 사용자 raw 값 보호 가드", () => {
  describe("안전 (덮어쓰기 OK)", () => {
    it("undefined → 빈 셀이라 safe", () => {
      expect(isSafeToOverwrite(undefined)).toBe(true);
    });
    it("null → 빈 셀이라 safe", () => {
      expect(isSafeToOverwrite(null)).toBe(true);
    });
    it('빈 문자열 "" → safe', () => {
      expect(isSafeToOverwrite("")).toBe(true);
    });
    it('수식 "=COUNTIFS(...)" → 옛 수식 교체 safe', () => {
      expect(isSafeToOverwrite("=COUNTIFS(A:A,1)")).toBe(true);
    });
    it('수식 "=" 만 있어도 safe (edge — 깨진 수식 교체)', () => {
      expect(isSafeToOverwrite("=")).toBe(true);
    });
    it("깨진 수식 결과인 `=#REF!` 같은 경우도 safe (= 로 시작)", () => {
      expect(isSafeToOverwrite("=#REF!")).toBe(true);
    });
  });

  describe("위험 (보존 필요)", () => {
    it("일반 텍스트 → unsafe (사용자 입력 보존)", () => {
      expect(isSafeToOverwrite("미팅 3건")).toBe(false);
    });
    it("숫자 → unsafe (사용자 수동 백필 가능성)", () => {
      expect(isSafeToOverwrite(42)).toBe(false);
    });
    it("0 → unsafe (사용자가 의도적 0 입력 가능)", () => {
      expect(isSafeToOverwrite(0)).toBe(false);
    });
    it('"=" 안 붙은 한글 → unsafe', () => {
      expect(isSafeToOverwrite("계약")).toBe(false);
    });
    it("apostrophe-prefixed (Sheets text mode) → unsafe", () => {
      // Sheets 가 raw text 로 저장할 때 종종 ' 가 붙음. = 안 붙어있어 unsafe 판정.
      expect(isSafeToOverwrite("'meeting")).toBe(false);
    });
    it("boolean (TRUE/FALSE) → unsafe", () => {
      expect(isSafeToOverwrite(true)).toBe(false);
      expect(isSafeToOverwrite(false)).toBe(false);
    });
    it("공백 문자열 → unsafe (사용자 의도 모름)", () => {
      expect(isSafeToOverwrite(" ")).toBe(false);
    });
  });
});

/**
 * 단위 테스트: computeDataRows (2026-05-16, 6기 셀병합 사고 후속).
 *
 * 시트 C 컬럼 read 의존 제거 → 박힌 공식으로 결정적 row 생성. 6기 이월 시트의
 * C 컬럼 cell 병합으로 매입DB row 만 인식되던 사고 원천 차단.
 *
 * 공식: row = blockStart(10) + week*blockStride(34) + dayIdx*4 + channelIdx
 */
describe("computeDataRows — deterministic data row 생성", () => {
  const rows = computeDataRows();

  it("8주 × 7일 × 4채널 = 224 rows 반환", () => {
    expect(rows.length).toBe(8 * 7 * 4);
  });

  it("첫 row = blockStart(10) (1주 1일 매입DB)", () => {
    expect(rows[0]).toBe(10);
  });

  it("1주 1일 4채널 row 연속: 10, 11, 12, 13", () => {
    expect(rows.slice(0, 4)).toEqual([10, 11, 12, 13]);
  });

  it("1주 2일 첫 매입DB row = 14 (stride 4)", () => {
    expect(rows[4]).toBe(14);
  });

  it("2주 1일 매입DB row = blockStart + blockStride = 44", () => {
    // 1주 = 28 rows (7일 × 4채널) → idx 28 이 2주 1일 매입DB
    expect(rows[28]).toBe(44);
  });

  it("마지막 row = blockStart + 7*blockStride + 6*4 + 3 = 275", () => {
    // 8주 7일 콜·지·기·소 = 10 + 7*34 + 6*4 + 3 = 10+238+24+3 = 275
    expect(rows[rows.length - 1]).toBe(275);
  });

  it("중복 없음 + 오름차순", () => {
    const sorted = [...rows].sort((a, b) => a - b);
    expect(rows).toEqual(sorted);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("합계/헤더 row 미포함 — 매 블록 offset 0~27 만 (28~33 제외)", () => {
    for (const r of rows) {
      const offset = (r - 10) % 34;
      expect(offset).toBeLessThanOrEqual(27);
    }
  });

  it("6기 cell 병합 시나리오 — readDataRows 시절 매입DB row 만 인식되던 사고 재발 방지", () => {
    // 1주 1일 4채널 row 가 모두 dataRows 에 있어야 함 (cell 병합 무관).
    expect(rows).toContain(10); // 매입DB
    expect(rows).toContain(11); // 직접생산 — 6기 시트에서 누락됐던 row
    expect(rows).toContain(12); // 현수막
    expect(rows).toContain(13); // 콜·지·기·소
  });
});

/**
 * 단위 테스트: dayPrimaryRow (2026-05-16, 이장현 cell 병합 시트 사고 fix).
 *
 * 4 row 일별 블록의 매입DB(primary date cell) row 계산. 6기 cell 병합 시트의
 * 직접생산/현수막/콜지기소 row 에서 $C 참조가 empty 되던 사고 fix —
 * formulasForRow 가 $C{r} → $C{dayPrimaryRow(r)} 로 변경.
 */
describe("dayPrimaryRow — cell 병합 시트 $C 참조 fix", () => {
  it("매입DB row(10) 자기자신 = primary", () => {
    expect(dayPrimaryRow(10)).toBe(10);
  });

  it("직접생산 row(11) → primary = 10 (1주 1일 매입DB)", () => {
    expect(dayPrimaryRow(11)).toBe(10);
  });

  it("현수막 row(12) → primary = 10", () => {
    expect(dayPrimaryRow(12)).toBe(10);
  });

  it("콜·지·기·소 row(13) → primary = 10", () => {
    expect(dayPrimaryRow(13)).toBe(10);
  });

  it("1주 2일 매입DB(14) → primary = 14", () => {
    expect(dayPrimaryRow(14)).toBe(14);
  });

  it("1주 2일 콜·지·기·소(17) → primary = 14", () => {
    expect(dayPrimaryRow(17)).toBe(14);
  });

  it("1주 7일 매입DB(34) → primary = 34", () => {
    expect(dayPrimaryRow(34)).toBe(34);
  });

  it("1주 7일 콜·지·기·소(37) → primary = 34", () => {
    expect(dayPrimaryRow(37)).toBe(34);
  });

  it("2주 1일 매입DB(44) → primary = 44 (blockStride 34 건너뜀)", () => {
    expect(dayPrimaryRow(44)).toBe(44);
  });

  it("2주 1일 콜·지·기·소(47) → primary = 44", () => {
    expect(dayPrimaryRow(47)).toBe(44);
  });

  it("8주 7일 콜·지·기·소(275) → primary = 272", () => {
    // 8주 시작 = 10 + 7*34 = 248. 7일 시작 = 248 + 6*4 = 272. 콜지기소 = 275.
    expect(dayPrimaryRow(275)).toBe(272);
  });
});

/**
 * 단위 테스트: formulasForRow 채널 매칭 (2026-06, 콜지기소 계약 미집계 사고).
 * 콜·지·기·소 행만 separator-무관(와일드카드 "콜*소" / LEFT(F,1)="콜").
 * 다른 3채널은 정확매칭($D{r}) 유지.
 */
describe("formulasForRow — 콜지기소 계약 채널 매칭", () => {
  it("콜·지·기·소 행(13): N/O 는 와일드카드 \"콜*소\", $D13 정확매칭 아님", () => {
    const f = formulasForRow(13);
    expect(f.N).toContain('"콜*소"');
    expect(f.O).toContain('"콜*소"');
    expect(f.N).not.toContain("$D13");
  });

  it("콜·지·기·소 행(13): P 는 LEFT(F,1)=\"콜\"", () => {
    const f = formulasForRow(13);
    expect(f.P).toContain('LEFT(');
    expect(f.P).toContain('="콜"');
  });

  it("매입DB 행(10): N/O 는 정확매칭 $D10, 와일드카드 아님", () => {
    const f = formulasForRow(10);
    expect(f.N).toContain("$D10");
    expect(f.N).not.toContain('"콜*소"');
    expect(f.O).toContain("$D10");
  });

  it("직접생산(11)·현수막(12): 정확매칭 유지", () => {
    expect(formulasForRow(11).N).toContain("$D11");
    expect(formulasForRow(12).N).toContain("$D12");
    expect(formulasForRow(11).N).not.toContain('"콜*소"');
  });

  it("다른 주차 콜지기소(17=1주2일, 47=2주1일)도 와일드카드", () => {
    expect(formulasForRow(17).N).toContain('"콜*소"');
    expect(formulasForRow(47).N).toContain('"콜*소"');
  });

  it("계약 필터(J=\"계약\")·날짜(dpr) 는 유지", () => {
    const f = formulasForRow(13);
    expect(f.N).toContain('"계약"');
    expect(f.N).toContain("$C10"); // dayPrimaryRow(13)=10
  });
});

/**
 * 단위 테스트: 미팅완료(L) 상태필터 박제 (2026-06-09, 미팅실행률 100% 사고 진단).
 * L(미팅완료수) 은 04 상태 ∈ {완료,계약} 만 세야 한다 — 예약/변경/취소 제외.
 * 누군가 L 을 K(오늘미팅수, 상태 무관 전체)처럼 바꾸면 미팅완료=미팅예약 사고 → 가드.
 */
describe("formulasForRow — 미팅완료(L) 상태필터", () => {
  const f = formulasForRow(10);

  it("L 은 상태 완료+계약 COUNTIFS (예약 제외)", () => {
    expect(f.L).toContain('"완료"');
    expect(f.L).toContain('"계약"');
    expect(f.L).toContain("J:J"); // 상태 컬럼(J) 필터
  });

  it("L(미팅완료) ≠ K(오늘미팅수) — 둘이 같아지면 안 됨", () => {
    expect(f.L).not.toBe(f.K);
    // K 는 상태 무관 전체 카운트(COUNTIF D), L 은 상태필터.
    expect(f.K).not.toContain('"완료"');
  });

  it("L 은 상태 무관 전체 COUNTIF 가 아니다 (예약까지 세는 회귀 차단)", () => {
    // 상태 토큰이 빠진 단순 COUNTIF(D) 면 예약도 세짐 → 금지.
    expect(f.L).toMatch(/"완료"|"계약"/);
  });
});

/**
 * 단위 테스트: 미팅예약/완료 펀넬·채널 stacking (2026-06-09, 미팅실행률 100% 착시 fix, A안).
 * 미팅예약 = 04 상태 ∈ {예약,완료,계약}, 미팅완료 = {완료,계약}. 채널은 04.F.
 */
describe("meetingFunnelFormulas — 미팅예약/완료 04 상태기반", () => {
  const m = meetingFunnelFormulas();

  it("미팅예약(R4) = 예약+완료+계약 (변경/취소 제외, 매입DB)", () => {
    expect(m.R4).toContain('"예약"');
    expect(m.R4).toContain('"완료"');
    expect(m.R4).toContain('"계약"');
    expect(m.R4).toContain('"매입DB"');
  });

  it("미팅완료(R5) = 완료+계약 (예약 제외)", () => {
    expect(m.R5).toContain('"완료"');
    expect(m.R5).toContain('"계약"');
    expect(m.R5).not.toContain('"예약"');
  });

  it("미팅예약 ⊇ 미팅완료 — 예약 수식이 완료보다 상태 더 셈 (예약 ≥ 완료)", () => {
    // R4 는 COUNTIFS 3개(예약/완료/계약), R5 는 2개(완료/계약).
    const cnt = (s: string) => (s.match(/COUNTIFS/g) || []).length;
    expect(cnt(m.R4 ?? "")).toBe(3);
    expect(cnt(m.R5 ?? "")).toBe(2);
  });

  it("콜·지·기·소(U4/U5) 는 separator-무관 와일드카드 \"콜*소\"", () => {
    expect(m.U4).toContain('"콜*소"');
    expect(m.U5).toContain('"콜*소"');
    expect(m.U4).not.toContain("콜·지·기·소");
  });

  it("펀넬 합 F4=SUM(R4:U4), F5=SUM(R5:U5)", () => {
    expect(m.F4).toBe("=SUM(R4:U4)");
    expect(m.F5).toBe("=SUM(R5:U5)");
  });

  it("4채널 모두 예약/완료 셀 생성", () => {
    for (const col of ["R", "S", "T", "U"]) {
      expect(m[`${col}4`]).toBeTruthy();
      expect(m[`${col}5`]).toBeTruthy();
    }
  });
});
