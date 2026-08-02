/**
 * 아레나 시즌 SSOT 회귀 (AR-2b, belie A안 = cohorts 탭 config 정본).
 *
 * 고정하는 계약:
 *  ① 시즌 정본 = cohorts 탭 시즌 행(label "A{n}", type=arena)의 **J열 seasonStartISO**(admin 입력).
 *     참가자별 registry K 는 **쓰지 않는다** — 템플릿 O1 스탬프라 출처 불신(3R 결론).
 *  ② **개막일 기준**: 개강일이 오늘 이하인 시즌만 채택 → 개막 전엔 이전 시즌 유지(등록≠개막).
 *  ③ 미입력·비ISO·archived 는 판정 제외.
 *  ④ 아무 시즌도 확정 안 되면 0 → 라벨 "아레나" + 스코프 전부 통과(**데이터 안 자름**).
 *  ⑤ 혼합 상태 안전: 새 시즌 개강일 미입력이면 옛 시즌으로 **고정되지 않는다**
 *     (3R HIGH — 옛 시즌 스코프가 새 시즌 참가자를 통째로 숨기던 결함).
 *
 * 날짜는 테스트 픽스처로만 등장한다(앱 코드 하드코딩 금지 — 구조테스트 G5 가 강제).
 */
import { describe, expect, it } from "vitest";
import {
  currentSeasonStartISO,
  isInSeason,
  resolveCurrentSeason,
  seasonDisplayLabel,
  seasonWeekOf,
  type ArenaSeasonRow,
} from "../../lib/service/arena-season-config";

const S1 = "2026-06-12"; // 시즌1 개막(픽스처)
const S2 = "2026-08-07"; // 시즌2 개막(픽스처)

/** cohorts 탭 시즌 행 픽스처. */
const row = (
  label: string,
  seasonStartISO = "",
  status = "active",
  type = "arena",
): ArenaSeasonRow => ({ label, seasonStartISO, status, type });

describe("resolveCurrentSeason — cohorts config 정본", () => {
  it("A1 만 개막 → 시즌1", () => {
    expect(resolveCurrentSeason([row("A1", S1)], "2026-07-20")).toBe(1);
  });

  it("**개막일에 시즌2 전환** (A2 개강일 <= 오늘)", () => {
    expect(resolveCurrentSeason([row("A1", S1), row("A2", S2)], S2)).toBe(2);
  });

  it("**등록 ≠ 개막**: A2 행이 있고 개강일이 미래면 여전히 시즌1", () => {
    const rows = [row("A1", S1), row("A2", S2)];
    expect(resolveCurrentSeason(rows, "2026-08-06")).toBe(1);
    expect(resolveCurrentSeason(rows, "2026-07-01")).toBe(1);
  });

  it("**혼합 상태 안전(3R HIGH)**: A2 개강일 미입력이면 옛 시즌으로 고정하지 않고 0", () => {
    // 0 → isInSeason 전부 통과 → 새 시즌 참가자가 보드에서 사라지지 않는다.
    expect(resolveCurrentSeason([row("A1", S1), row("A2", "")], S2)).toBe(0);
    expect(isInSeason("A2-1기", 0)).toBe(true);
    expect(isInSeason("A1-1기", 0)).toBe(true);
  });

  it("비ISO 개강일도 판정 제외 → 0", () => {
    expect(resolveCurrentSeason([row("A1", S1), row("A2", "8/7")], S2)).toBe(0);
  });

  it("달력상 존재하지 않는 개강일은 미래/개막이 아니라 미상 → 0", () => {
    expect(resolveCurrentSeason([row("A1", S1), row("A2", "2026-02-31")], S2)).toBe(0);
    expect(resolveCurrentSeason([row("A1", S1), row("A2", "2026-13-01")], S2)).toBe(0);
  });

  it("archived 시즌은 제외 — admin 이 닫은 시즌은 후보 아님", () => {
    const rows = [row("A1", S1), row("A2", S2, "archived")];
    expect(resolveCurrentSeason(rows, S2)).toBe(1);
  });

  it("일반 기수 행·참가자 라벨은 무시 (시즌 레벨 라벨만)", () => {
    const rows: ArenaSeasonRow[] = [
      { label: "8", seasonStartISO: S2, status: "active", type: "cohort" },
      { label: "A2-1기", seasonStartISO: S2, status: "active", type: "arena" },
      row("A1", S1),
    ];
    expect(resolveCurrentSeason(rows, S2)).toBe(1);
  });

  it("type 이 arena 가 아니면 제외 (일반 기수에 개강일이 들어가도 시즌 오염 없음)", () => {
    expect(
      resolveCurrentSeason([{ label: "A2", seasonStartISO: S2, type: "cohort" }], S2),
    ).toBe(0);
  });

  it("행 없음/전부 미입력 → 0(미상)", () => {
    expect(resolveCurrentSeason([], S2)).toBe(0);
    expect(resolveCurrentSeason([row("A1", ""), row("A2", "")], S2)).toBe(0);
  });

  it("오늘 날짜가 비ISO 면 판정 불가 → 0", () => {
    expect(resolveCurrentSeason([row("A1", S1)], "")).toBe(0);
  });

  it("오늘 날짜가 달력상 존재하지 않으면 판정 불가 → 0", () => {
    expect(resolveCurrentSeason([row("A1", S1)], "2026-02-31")).toBe(0);
  });

  it("시즌 두 자리 (A10 > A9 — 문자열 비교 아님)", () => {
    const rows = [row("A9", S1), row("A10", S1)];
    expect(resolveCurrentSeason(rows, S2)).toBe(10);
  });

  it("개막 당일 경계 포함 (개강일 == 오늘 → 개막)", () => {
    expect(resolveCurrentSeason([row("A2", S2)], S2)).toBe(2);
  });
});

describe("isInSeason — 집계 스코프(라벨과 같은 SSOT)", () => {
  it("해당 시즌 참가자만 통과", () => {
    expect(isInSeason("A2-1기", 2)).toBe(true);
    expect(isInSeason("A1-6기", 2)).toBe(false);
  });

  it("'기' 접미사 유무 무관", () => {
    expect(isInSeason("A2-3", 2)).toBe(true);
  });

  it("비아레나 라벨은 시즌 스코프에서 제외", () => {
    expect(isInSeason("8기", 2)).toBe(false);
    expect(isInSeason("", 2)).toBe(false);
  });

  it("헤더-표 정합: config 가 준 시즌으로 거른 결과만 남는다", () => {
    const season = resolveCurrentSeason([row("A1", S1), row("A2", S2)], S2);
    const parts = ["A1-1기", "A2-1기", "A2-2기"];
    expect(season).toBe(2);
    expect(parts.filter((c) => isInSeason(c, season))).toEqual(["A2-1기", "A2-2기"]);
  });
});

describe("주차 = 시즌 개강일 앵커 (참가자 시트 O1 배제)", () => {
  it("**개막일 주차는 1** — 옛 코드는 O1(이전 시즌 개강일)로 재 '8주차'로 찍혔다(4R HIGH)", () => {
    const rows = [row("A1", S1), row("A2", S2)];
    const start = currentSeasonStartISO(rows, S2);
    expect(start).toBe(S2); // 시즌2 개강일이 앵커
    expect(seasonWeekOf(start, S2)).toBe(1); // O1(6/12) 기준이면 9→캡8 이 됐다
  });

  it("개막 후 주차가 정상 증가 (개강일 +7일 = 2주차)", () => {
    expect(seasonWeekOf(S2, "2026-08-14")).toBe(2);
    expect(seasonWeekOf(S2, "2026-08-13")).toBe(1);
  });

  it("STATS_WEEKS 상한으로 캡 (시즌 후반)", () => {
    expect(seasonWeekOf(S2, "2026-12-31")).toBe(8);
  });

  it("개강일·오늘 미상이면 0 → 헤더가 주차 칸을 생략", () => {
    expect(seasonWeekOf("", S2)).toBe(0);
    expect(seasonWeekOf(S2, "")).toBe(0);
    expect(seasonWeekOf("8/7", S2)).toBe(0);
    expect(seasonWeekOf("2026-02-31", S2)).toBe(0);
    expect(seasonWeekOf(S2, "2026-13-01")).toBe(0);
  });

  it("currentSeasonStartISO: 시즌 미상이면 '' (주차도 숨김)", () => {
    expect(currentSeasonStartISO([row("A1", S1), row("A2", "")], S2)).toBe("");
    expect(currentSeasonStartISO([], S2)).toBe("");
  });

  it("currentSeasonStartISO: 개막 전이면 **이전 시즌** 개강일을 준다(주차 연속)", () => {
    const rows = [row("A1", S1), row("A2", S2)];
    expect(currentSeasonStartISO(rows, "2026-08-06")).toBe(S1);
  });
});

describe("seasonDisplayLabel — 표기 단일 규칙", () => {
  it("시즌 번호가 있으면 '아레나 시즌N'", () => {
    expect(seasonDisplayLabel(1)).toBe("아레나 시즌1");
    expect(seasonDisplayLabel(2)).toBe("아레나 시즌2");
  });

  it("미상(0)이면 번호 없이 '아레나' — 옛 '시즌1' 하드코딩 fallback 금지", () => {
    expect(seasonDisplayLabel(0)).toBe("아레나");
  });
});
