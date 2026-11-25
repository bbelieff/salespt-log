/**
 * 「오늘 챙길 일」 줄의 종류·이유 분류(lib/analytics/follow-up-work-kind, 2026-11-25) — 합성 항목만 쓴다.
 * 분류는 dashboard-follow-ups 가 만드는 문구에 기대므로, 그 문구가 실제 소스에 그대로 있는지도 함께 고정한다.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TODAY_MEETING_REASON } from "@/lib/analytics/dashboard-follow-ups";
import { countFollowUpReasons, followUpReasonChips, followUpReasonLabels, followUpWorkKind, FOLLOW_UP_WORK_KINDS, FOLLOW_UP_WORK_KIND_LABEL } from "@/lib/analytics/follow-up-work-kind";

const kind = (key: string, action: string) => followUpWorkKind({ key, kind: "today", action });
const source = readFileSync("lib/analytics/dashboard-follow-ups.ts", "utf8");

describe("할 일 종류", () => {
  it("여섯 가지이고 이름이 있다", () => {
    expect(FOLLOW_UP_WORK_KINDS.map(k => FOLLOW_UP_WORK_KIND_LABEL[k])).toEqual(["전화", "날짜", "미팅", "기록", "정하기", "할 일"]);
  });

  it("만들어진 곳(key 앞머리)과 문구로 정한다", () => {
    expect(kind("lead:a", "첫 연락하기")).toBe("call");
    expect(kind("lead:a", "다시 연락하기")).toBe("call");
    expect(kind("lead:a", "다음 연락일 정하기")).toBe("date");
    expect(kind("meeting:a", "오늘 미팅")).toBe("meeting");
    expect(kind("meeting:a", "미팅 준비")).toBe("meeting");
    expect(kind("meeting:a", "미팅 결과 입력")).toBe("record");
    expect(kind("stalled:3:1", "다음 할 일 정하기")).toBe("plan");
    expect(kind("stalled:3:1", "진행기관과 다음 할 일 확인")).toBe("plan");
    expect(kind("todo:a", "가상 서류 준비")).toBe("todo");
  });

  it("분류가 기대는 문구와 key 앞머리가 실제 생성 코드에 그대로 있다", () => {
    for (const text of ["다음 연락일 정하기", "미팅 결과 입력", "`lead:${", "`meeting:${", "`stalled:${", "`todo:${"]) expect(source, text).toContain(text);
  });
});

describe("이유 칩", () => {
  it("쉬운 말로 바꾸고, 묶인 이유는 나누고, 정보 없는 이유는 뺀다", () => {
    expect(followUpReasonLabels({ reasons: ["진행기관 없음", "다음 할 일 없음", "7일 이상 진행 정체", "조건 대기(단기관리)"] })).toEqual(["기관 없음", "다음 할 일 비어 있음", "7일 넘게 멈춤", "조건 대기"]);
    expect(followUpReasonLabels({ reasons: ["재통화 · 다음 연락일 없음"] })).toEqual(["재통화", "다음 연락일 없음"]);
    expect(followUpReasonLabels({ reasons: ["미완료 할 일"] })).toEqual([]);
    expect(followUpReasonLabels({ reasons: ["공고 신청 준비"] })).toEqual(["공고"]);
    expect(followUpReasonLabels({ reasons: [TODAY_MEETING_REASON] })).toEqual(["오늘 미팅"]);
    expect(followUpReasonLabels({ reasons: ["미팅 결과 미입력"] })).toEqual(["결과 안 적음"]);
    // 모르는 이유는 그대로 보여 준다(숨기지 않는다). 같은 말은 한 번만.
    expect(followUpReasonLabels({ reasons: ["처음 보는 이유", "처음 보는 이유"] })).toEqual(["처음 보는 이유"]);
  });

  it("줄에는 두 개까지만", () => {
    expect(followUpReasonChips({ reasons: ["진행기관 없음", "다음 할 일 없음", "7일 이상 진행 정체"] })).toEqual(["기관 없음", "다음 할 일 비어 있음"]);
  });

  it("바꿔 쓰는 원래 문구가 실제 생성 코드에 그대로 있다", () => {
    for (const text of ["진행기관 없음", "다음 할 일 없음", "일 이상 진행 정체", "조건 대기(단기관리)", "공고 신청 준비", "미완료 할 일", "연결 진행건 확인 필요", "미팅 결과 미입력", "다음 연락일 없음"]) expect(source, text).toContain(text);
  });

  it("이유별 건수 — 많은 순, 한 줄의 이유 둘은 양쪽에 다 센다", () => {
    const counted = countFollowUpReasons([
      { reasons: ["진행기관 없음", "다음 할 일 없음"] },
      { reasons: ["다음 할 일 없음", "7일 이상 진행 정체"] },
      { reasons: ["다음 할 일 없음"] },
      { reasons: ["미완료 할 일"] },
    ]);
    expect(counted).toEqual([{ label: "다음 할 일 비어 있음", count: 3 }, { label: "7일 넘게 멈춤", count: 1 }, { label: "기관 없음", count: 1 }]);
  });
});
