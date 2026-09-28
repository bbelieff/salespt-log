/**
 * 업체정보 확장2 20필드 (company-info-new-fields, belie 확정 2026-09-28).
 *  ① 스키마 default "" · 옛 데이터(키 없음) 파싱 유지
 *  ② 04 코덱: AU(46)~BN(65) 위치 · AT(45 gcal 맵) 비접촉 · 기존 열 불변 · 라운드트립
 *  ③ 헤더 보강은 빈 셀에만
 *  ④ 이월(carryover) payload·시트 확장 열 병합이 새 필드를 옮긴다
 *  ⑤ DB payload(열문자 BN 까지) 복원
 *  ⑥ TXT 추출에 새 필드·[재무] 섹션
 */
import { describe, expect, it } from "vitest";
import { CompanyInfo, Meeting } from "@/types";
import {
  COMPANY_EXT2_START,
  COMPANY_EXT_START,
  COMPANY_FIELDS,
  COMPANY_FIELDS_EXT,
  COMPANY_FIELDS_EXT2,
  GCAL_MAP_COL,
  MEETING_ROW_WIDTH,
  headerBackfillPlan,
  meetingToRow,
  rowToMeeting,
} from "@/repo/meetings-rows";
import { carriedMeetingPayload, withExtColumns } from "@/repo/carryover";
import { meetingFromDbPayload } from "@/repo/db/read-daily";
import { formatCompanyInfoTxt } from "@/service/company-info-txt";
import { colName } from "@/util/sheet-column";

const NEW_VALUES: Record<string, string> = {
  과세유형: "일반과세자",
  업태: "도소매",
  법인등록번호: "110111-0000000",
  임차보증금: "1,000만",
  임차월세: "50만",
  임차면적: "33㎡(10평)",
  주민등록번호: "800101-",
  결산연도: "2025",
  영업이익: "3,200만",
  당기순이익: "2,100만",
  이자비용: "400만",
  자산총계: "5억",
  부채총계: "2억",
  자본총계: "3억",
  반기별매출: "25년 상반기 1.2억\n25년 하반기 1.5억",
  면세수입금액: "0",
  부채비율: "66%",
  이자보상배율: "8",
  당기순이익률: "7%",
  매출증가율: "12%",
};

const BASE = Meeting.parse({
  id: "m-new-001",
  예약일: "2026-09-28",
  예약시각: "10:00",
  미팅날짜: "2026-09-29",
  미팅시간: "14:00",
  channel: "매입DB",
  업체명: "예시상사",
  장소: "본사",
  업체정보: { 대표자이름: "홍길동", 과년도매출Y3: "23' 70백만", ...NEW_VALUES },
});

/** USER_ENTERED 재현 — apostrophe prefix 는 시트 저장 시 벗겨진다. */
const userEntered = (row: (string | number | boolean)[]) =>
  row.map((v) => (typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));

describe("① CompanyInfo 스키마", () => {
  it("20개 새 키 전부 default 빈 문자열", () => {
    const ci = CompanyInfo.parse({}) as Record<string, unknown>;
    expect(COMPANY_FIELDS_EXT2).toHaveLength(20);
    for (const f of COMPANY_FIELDS_EXT2) expect(ci[f]).toBe("");
  });

  it("옛 행(새 키 없음)도 그대로 파싱 — 기존 값 보존", () => {
    const old = CompanyInfo.parse({ 대표자이름: "홍길동", 과년도매출Y2: "24' 148백만" });
    expect(old.대표자이름).toBe("홍길동");
    expect(old.과년도매출Y2).toBe("24' 148백만");
    expect(old.과세유형).toBe("");
  });
});

describe("② 04 코덱 좌표 (AU~BN)", () => {
  it("AU(46)부터 20열 = BN(65), AT(45)는 gcal 맵 자리", () => {
    expect(COMPANY_EXT2_START).toBe(46);
    expect(colName(COMPANY_EXT2_START)).toBe("AU");
    expect(GCAL_MAP_COL).toBe(45);
    expect(colName(GCAL_MAP_COL)).toBe("AT");
    // 확장2 끝 = BN(65). 그 뒤 BO~CC 는 확장3(company-info-restructure) — 전체 폭 81(CC).
    expect(colName(COMPANY_EXT2_START + COMPANY_FIELDS_EXT2.length - 1)).toBe("BN");
    expect(MEETING_ROW_WIDTH).toBe(81);
    expect(colName(MEETING_ROW_WIDTH - 1)).toBe("CC");
  });

  it("기존 열 불변 — T(19)·AN 커스텀·AQ(42) 시작 그대로", () => {
    const row = meetingToRow(BASE);
    expect(row[19 + COMPANY_FIELDS.indexOf("대표자이름")]).toBe("'홍길동");
    expect(row[COMPANY_EXT_START + COMPANY_FIELDS_EXT.indexOf("과년도매출Y3")]).toBe("'23' 70백만");
  });

  it("새 필드가 정해진 순서로 AU~BN 에 apostrophe 텍스트로, AT 는 빈칸", () => {
    const row = meetingToRow(BASE);
    expect(row).toHaveLength(81);
    expect(row[GCAL_MAP_COL]).toBe("");
    COMPANY_FIELDS_EXT2.forEach((f, i) => {
      expect(row[COMPANY_EXT2_START + i]).toBe(`'${NEW_VALUES[f]}`);
    });
    expect(row[46]).toBe("'일반과세자"); // AU
    expect(row[65]).toBe("'12%"); // BN
  });

  it("meetingToRow → USER_ENTERED → rowToMeeting 라운드트립", () => {
    const back = rowToMeeting(userEntered(meetingToRow(BASE)));
    expect(back).not.toBeNull();
    const ci = back!.업체정보 as Record<string, unknown>;
    for (const f of COMPANY_FIELDS_EXT2) expect(ci[f]).toBe(NEW_VALUES[f]);
  });

  it("옛 행(A~AS 45셀 — 새 열 없음)도 읽힌다, 새 필드는 빈값", () => {
    const short = userEntered(meetingToRow(BASE)).slice(0, 45);
    const m = rowToMeeting(short)!;
    expect(m.업체정보?.대표자이름).toBe("홍길동");
    expect(m.업체정보?.과세유형).toBe("");
  });
});

describe("③ 헤더 보강 — 빈 셀에만", () => {
  it("사용자가 바꾼 헤더는 건드리지 않고 빈 칸만 채운다", () => {
    const existing = ["과세유형", "", "내가 바꾼 이름", "  "];
    const plan = headerBackfillPlan(existing, 46, COMPANY_FIELDS_EXT2);
    const cols = plan.map((p) => p.col);
    expect(cols).not.toContain(46);
    expect(cols).not.toContain(48);
    expect(plan[0]).toEqual({ col: 47, label: "업태" });
    expect(cols).toContain(49); // 공백만 있는 칸 = 빈 칸
    expect(plan).toHaveLength(20 - 2);
  });

  it("전부 채워진 헤더면 할 일 없음", () => {
    expect(headerBackfillPlan([...COMPANY_FIELDS_EXT2], 46, COMPANY_FIELDS_EXT2)).toEqual([]);
  });
});

describe("④ 이월(carryover)이 새 필드를 옮긴다", () => {
  const sheetRaw = userEntered(meetingToRow(BASE));

  it("시트 읽기: A~AN + (AQ 부터 읽은) 확장 행 병합 — AT 는 옮기지 않음", () => {
    const base = sheetRaw.slice(0, 40);
    const ext = sheetRaw.slice(COMPANY_EXT_START, MEETING_ROW_WIDTH);
    ext[GCAL_MAP_COL - COMPANY_EXT_START] = '{"a@b":"evt"}'; // 옛 시트의 gcal 맵
    const merged = withExtColumns(base, ext);
    expect(merged[COMPANY_EXT2_START]).toBe("일반과세자");
    expect(merged[GCAL_MAP_COL]).toBeUndefined();
    const p = carriedMeetingPayload({ 원본id: "m-new-001", raw: merged }, "new-9");
    expect(p.AU).toBe("일반과세자");
    expect(p.BN).toBe("12%");
    expect(p.AS).toBe("23' 70백만");
    expect(p).not.toHaveProperty("AT");
  });

  it("확장 행이 없는 옛 시트 → A~AN 그대로(확장 열 없음)", () => {
    expect(withExtColumns(sheetRaw.slice(0, 40), undefined)).toHaveLength(40);
  });

  it("⑤ DB payload(열문자) → Meeting 복원에 새 필드 포함", () => {
    const p = carriedMeetingPayload({ 원본id: "m-new-001", raw: sheetRaw }, "new-9");
    const m = meetingFromDbPayload(p)!;
    expect(m).not.toBeNull();
    const ci = m.업체정보 as Record<string, unknown>;
    for (const f of COMPANY_FIELDS_EXT2) expect(ci[f]).toBe(NEW_VALUES[f]);
    expect(m.구분).toBe("이월");
  });
});

describe("⑥ TXT 추출", () => {
  it("기업정보·대표자 그룹에 새 칸, [재무] 섹션에 재무 칸(옛 한 칸 값은 '이전 … 메모')", () => {
    const txt = formatCompanyInfoTxt("예시상사", BASE.업체정보!, "2026-09-28 10:00");
    const 대표자 = txt.slice(txt.indexOf("[대표자]"), txt.indexOf("[기업정보]"));
    const 기업 = txt.slice(txt.indexOf("[기업정보]"), txt.indexOf("[재무]"));
    const 재무 = txt.slice(txt.indexOf("[재무]"));
    for (const label of ["과세유형", "업태", "법인등록번호", "임차 보증금", "임차 월세", "임차 면적"]) {
      expect(기업).toContain(label);
    }
    expect(대표자).toContain("주민등록번호");
    expect(대표자).not.toContain("주민등록번호 앞자리");
    expect(대표자).toContain("800101-");
    for (const label of ["결산연도", "영업이익", "이전 반기별 매출 메모", "면세 수입금액", "부채비율", "이전 매출증가율 메모"]) {
      expect(재무).toContain(label);
    }
    expect(재무).toContain("- 25년 하반기 1.5억"); // 멀티라인 목록
  });

  it("재무 칸이 모두 비면 [재무] 머리글을 쓰지 않는다", () => {
    const txt = formatCompanyInfoTxt("예시상사", CompanyInfo.parse({ 대표자이름: "홍길동" }), "T");
    expect(txt).not.toContain("[재무]");
    expect(txt).toContain("[대표자]");
  });
});
