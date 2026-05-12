/**
 * parsePrepText — admin 메시지 paste 형식 파싱 검증.
 *
 * 실제 사용자가 준 데이터(2026-05-12: 16명 6기/7기) 형식으로 테스트.
 */
import { describe, it, expect } from "vitest";
import { parsePrepText } from "@/components/auth/TraineePrepBulkForm";

describe("parsePrepText — 사용자 메시지 형식", () => {
  it("표준 페어: 시트 이름 + URL 두 줄", () => {
    const text = `세일즈PT_ 6기 김미란 수강생 경영일지
https://docs.google.com/spreadsheets/d/1QXfmTJ4sfDE0Laobq5meu46wDewWYvAheX_IfGsAPPI/edit?usp=sharing`;
    const items = parsePrepText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cohort: "6",
      name: "김미란",
    });
    expect(items[0]!.spreadsheetUrl).toContain("1QXfmTJ4sfDE0Laobq5meu46");
  });

  it("페어 사이 빈 줄 무시", () => {
    const text = `세일즈PT_ 6기 김미란 수강생 경영일지
https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAA/edit

세일즈PT_ 6기 김선주 수강생 경영일지
https://docs.google.com/spreadsheets/d/BBBBBBBBBBBBBBBBBBBBBBBBBB/edit`;
    const items = parsePrepText(text);
    expect(items.map((i) => i.name)).toEqual(["김미란", "김선주"]);
  });

  it("시트 이름 + URL 같은 줄 붙어있는 경우(사용자 메시지 실제 케이스)", () => {
    const text = `세일즈PT_ 7기 김상목 수강생 경영일지https://docs.google.com/spreadsheets/d/1dSNFCLJFYOx634NW2s824OAdOCLF_wcUd-q17RZPDqs/edit?usp=sharing`;
    const items = parsePrepText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ cohort: "7", name: "김상목" });
  });

  it("trailing 공백 있는 시트 이름 처리 (`...경영일지 `)", () => {
    const text = `세일즈PT_ 6기 황정환 수강생 경영일지
https://docs.google.com/spreadsheets/d/1GeobrfIFzVpcrFDGpC5NnkAYlN8mqcvPVg-mFpGhSLM/edit?usp=sharing`;
    const items = parsePrepText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ cohort: "6", name: "황정환" });
  });

  it("TSV 한 줄 형식", () => {
    const text = `4\t손기학\thttps://docs.google.com/spreadsheets/d/1tn7oigvthgsxlEg-UvdahpVv86nqk73eIlZ24nJL70E/edit`;
    const items = parsePrepText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ cohort: "4", name: "손기학" });
  });

  it("매칭 안 되는 라인은 무시 (주석 등)", () => {
    const text = `# 6기 명단
세일즈PT_ 6기 김미란 수강생 경영일지
https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAA/edit
랜덤 텍스트
세일즈PT [7기] 주차별 과제 취합 시트
https://docs.google.com/spreadsheets/d/SHOULDBESKIPPEDxxxxxxxxxxxxx/edit`;
    const items = parsePrepText(text);
    // 주차별 과제 시트는 "수강생 경영일지" 패턴 매칭 안 됨 → 무시.
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("김미란");
  });

  it("실제 사용자 메시지 (16명) 전체 파싱", () => {
    const text = `세일즈PT_ 6기 김미란 수강생 경영일지
https://docs.google.com/spreadsheets/d/1QXfmTJ4sfDE0Laobq5meu46wDewWYvAheX_IfGsAPPI/edit?usp=sharing

세일즈PT_ 6기 김선주 수강생 경영일지
https://docs.google.com/spreadsheets/d/1hQM_Exv__A0wuiAnn-NX5IixinoJHI-5PiLTuC7H63Q/edit?usp=sharing

세일즈PT_ 6기 박준영 수강생 경영일지
https://docs.google.com/spreadsheets/d/1UKErEH2AJcLfFwHtz1GwW14CUW1IrBurY_qV69duPIw/edit?usp=sharing

세일즈PT_ 6기 이장현 수강생 경영일지
https://docs.google.com/spreadsheets/d/1Er_fFz8DAkRP9YQlt0COc7S1gRojvBT-7gRoNieAHGI/edit?usp=sharing

세일즈PT_ 6기 조정욱 수강생 경영일지
https://docs.google.com/spreadsheets/d/1ib4_WR-ZvtajvImR7mSrjFf0ZL7RwEsyR0NxfWS4_UM/edit?usp=sharing

세일즈PT_ 6기 김서준 수강생 경영일지
https://docs.google.com/spreadsheets/d/1-yN9iy37CctJ2s_ZUMcb3S7qozIwOfqzdLIHBmyWoXU/edit?usp=sharing

세일즈PT_ 6기 신다혜 수강생 경영일지
https://docs.google.com/spreadsheets/d/10Cps6AeQtivFQdBUXViWGx8P9focOKjMAT8srzo5BUQ/edit?usp=sharing

세일즈PT_ 6기 최정한 수강생 경영일지
https://docs.google.com/spreadsheets/d/1XPPJAbWWIrxmj8kcPbAEV9CUKWijPlZQUMWAeDqhRQU/edit?usp=sharing

세일즈PT_ 6기 황정환 수강생 경영일지
https://docs.google.com/spreadsheets/d/1GeobrfIFzVpcrFDGpC5NnkAYlN8mqcvPVg-mFpGhSLM/edit?usp=sharing

세일즈PT_ 7기 김상목 수강생 경영일지https://docs.google.com/spreadsheets/d/1dSNFCLJFYOx634NW2s824OAdOCLF_wcUd-q17RZPDqs/edit?usp=sharing

세일즈PT_ 7기 김영준 수강생 경영일지https://docs.google.com/spreadsheets/d/15bK1PWuCfdNOZoD8nDENXA0Iawj9dZfInjIo9-mZVdE/edit?usp=sharing

세일즈PT_ 7기 김현정 수강생 경영일지
https://docs.google.com/spreadsheets/d/1PlhR4Eczl0PU0jVE8T3uz9CbyDjbKUYQjOljO2y3tU8/edit?usp=sharing

세일즈PT_ 7기 문보혜 수강생 경영일지
https://docs.google.com/spreadsheets/d/1zdHqmz3mtFyR7e0yEiE8c1OubwdrPExesq1UNVjzl-c/edit?usp=sharing

세일즈PT_ 7기 오승진 수강생 경영일지
https://docs.google.com/spreadsheets/d/1hxN74K3lsaxfwHZaGEm4hmE0gVNXs-FYw8yyHh3-N-E/edit?usp=sharing

세일즈PT_ 7기 김현지 수강생 경영일지
https://docs.google.com/spreadsheets/d/1fGVDATqinxEVJrg--I0yp46BJZtWzXQvaWZGbnSfbj0/edit?usp=sharing

세일즈PT_ 7기 이승익 수강생 경영일지
https://docs.google.com/spreadsheets/d/1J3yaHkX1-dxh_oUv3yFquAqwJJlvFVpZ76XA-jaac_Y/edit?usp=sharing

세일즈PT_ 7기 함진숙 수강생 경영일지
https://docs.google.com/spreadsheets/d/1E914eyS56u5X3prZ4inuPgyLo5LUqWvx7bbM4RV1uwE/edit?usp=sharing

세일즈PT [7기] 주차별 과제 취합 시트
https://docs.google.com/spreadsheets/d/1stxaMp_zq_n6lBC_zD0Z0DdIC74dniZDjIHRyDd82CI/edit?usp=sharing`;
    const items = parsePrepText(text);
    // 17명 페어 + 마지막 "주차별 과제 취합 시트" (수강생 경영일지 패턴 X → 무시).
    expect(items).toHaveLength(17);
    const names = items.map((i) => i.name);
    expect(names).toContain("김미란");
    expect(names).toContain("김현지");
    expect(names).toContain("황정환");
    expect(names).not.toContain("주차별");
    // 기수별 카운트: 6기 9명 + 7기 8명.
    expect(items.filter((i) => i.cohort === "6")).toHaveLength(9);
    expect(items.filter((i) => i.cohort === "7")).toHaveLength(8);
  });
});
