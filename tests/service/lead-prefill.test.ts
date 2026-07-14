/**
 * 발굴 체인 PR-1 — 프리필 매퍼 회귀 (lead-chain §2-2 매핑표 + §2-3 의미론 고정).
 * 이 파일이 고정하는 인터페이스(leadToMeetingDraft·mergeLeadDraft·LEAD_REFERRER_CUSTOM_KEY)는
 * PR-2(발굴 목록)·PR-3(피커 UI)가 소비하는 공용 계약이다.
 */
import { describe, expect, it } from "vitest";
import { DBLead, Meeting } from "@/types";
import {
  LEAD_REFERRER_CUSTOM_KEY,
  leadRemark,
  leadToMeetingDraft,
  mergeLeadDraft,
} from "@/service/lead-prefill";

const mkLead = (o: Partial<DBLead> = {}): DBLead =>
  DBLead.parse({
    구분: "지인",
    접수일: "2026-07-10",
    대표자명: "김대표",
    업체명: "가나상사",
    소개처: "잠실 김사장",
    연락처: "010-1234-5678",
    조건: "3천 이하",
    ...o,
  });

describe("leadToMeetingDraft — §2-2 매핑표", () => {
  it("업체명 → 업체명, 조건·구분 → 예약비고, 접수일은 미승계", () => {
    const d = leadToMeetingDraft(mkLead());
    expect(d.업체명).toBe("가나상사");
    expect(d.예약비고).toBe("[지인] 3천 이하");
    // 접수일(2026-07-10)은 draft 어디에도 없어야 한다 — 03 라이프사이클 메타.
    expect(JSON.stringify(d)).not.toContain("2026-07-10");
  });

  it("대표자명 → CompanyInfo.대표자이름 (키 이명 매핑, 스키마 rename 없음)", () => {
    const d = leadToMeetingDraft(mkLead());
    expect(d.업체정보?.대표자이름).toBe("김대표");
    expect(d.업체정보).not.toHaveProperty("대표자명");
  });

  it("연락처 → CompanyInfo.연락처통신사", () => {
    expect(leadToMeetingDraft(mkLead()).업체정보?.연락처통신사).toBe("010-1234-5678");
  });

  it("소개처 → 커스텀.업체[소개처] (04 AN→06 Y→TXT 기존 배관)", () => {
    const d = leadToMeetingDraft(mkLead());
    expect(d.업체정보?.커스텀?.업체?.[LEAD_REFERRER_CUSTOM_KEY]).toBe("잠실 김사장");
  });

  it("업체정보 3필드(대표자명·연락처·소개처) 전부 빈 값 → 업체정보 undefined", () => {
    const d = leadToMeetingDraft(mkLead({ 대표자명: "", 연락처: " ", 소개처: "" }));
    expect(d.업체정보).toBeUndefined();
    expect(d.업체명).toBe("가나상사"); // 업체명·비고는 여전히 채움
  });

  it("공백 trim — ' 가나상사 ' → '가나상사'", () => {
    expect(leadToMeetingDraft(mkLead({ 업체명: " 가나상사 " })).업체명).toBe("가나상사");
  });
});

describe("leadRemark — 구분·조건 → 예약비고 조합", () => {
  it.each([
    [{ 구분: "지인", 조건: "3천 이하" }, "[지인] 3천 이하"],
    [{ 구분: "지인", 조건: "" }, "[지인]"],
    [{ 구분: "", 조건: "3천 이하" }, "3천 이하"],
    [{ 구분: "", 조건: "" }, ""],
  ])("%o → %s", (input, expected) => {
    expect(leadRemark(input)).toBe(expected);
  });

  it("🐛회귀: Meeting.예약비고 max(500) 클램프 — 무제한 03 조건이 저장 400 을 만들지 않는다", () => {
    const long = leadRemark({ 구분: "지인", 조건: "가".repeat(900) });
    expect(long.length).toBe(500);
    // 클램프 결과가 실제로 Meeting 스키마를 통과하는지 고정
    expect(Meeting.shape.예약비고.safeParse(long).success).toBe(true);
    const draft = leadToMeetingDraft(mkLead({ 조건: "나".repeat(900) }));
    expect(Meeting.shape.예약비고.safeParse(draft.예약비고).success).toBe(true);
  });
});

describe("mergeLeadDraft — §2-3 비파괴 병합(빈 필드에만)", () => {
  it("빈 폼 → 초안 전체 채움", () => {
    const m = mergeLeadDraft({}, mkLead());
    expect(m.업체명).toBe("가나상사");
    expect(m.예약비고).toBe("[지인] 3천 이하");
    expect(m.업체정보?.대표자이름).toBe("김대표");
  });

  it("사용자가 이미 적은 업체명·예약비고는 절대 덮지 않는다", () => {
    const m = mergeLeadDraft({ 업체명: "내가적은상사", 예약비고: "직접 메모" }, mkLead());
    expect(m.업체명).toBe("내가적은상사");
    expect(m.예약비고).toBe("직접 메모"); // append 아님 — 재프리필 중복 누적 방지
  });

  it("업체정보 필드 단위 비파괴 — 대표자이름은 유지, 빈 연락처통신사만 채움", () => {
    const cur = { 업체정보: { 대표자이름: "박대표", 연락처통신사: "" } as never };
    const m = mergeLeadDraft(cur, mkLead());
    expect(m.업체정보?.대표자이름).toBe("박대표"); // 사용자 값 승리
    expect(m.업체정보?.연락처통신사).toBe("010-1234-5678"); // 빈 필드만 채움
  });

  it("커스텀 — 사용자의 다른 커스텀 키는 보존, 소개처 키만 없을 때 추가", () => {
    const cur = {
      업체정보: {
        커스텀: { 업체: { 별칭: "본사" }, 대표자: { 취미: "골프" } },
      } as never,
    };
    const m = mergeLeadDraft(cur, mkLead());
    expect(m.업체정보?.커스텀?.업체?.별칭).toBe("본사");
    expect(m.업체정보?.커스텀?.업체?.[LEAD_REFERRER_CUSTOM_KEY]).toBe("잠실 김사장");
    expect(m.업체정보?.커스텀?.대표자?.취미).toBe("골프");
  });

  it("사용자가 이미 소개처 커스텀을 적었으면 lead 소개처가 덮지 않는다", () => {
    const cur = {
      업체정보: { 커스텀: { 업체: { [LEAD_REFERRER_CUSTOM_KEY]: "강남 박사장" }, 대표자: {} } } as never,
    };
    const m = mergeLeadDraft(cur, mkLead());
    expect(m.업체정보?.커스텀?.업체?.[LEAD_REFERRER_CUSTOM_KEY]).toBe("강남 박사장");
  });

  it("초안 업체정보가 없으면(빈 lead) 사용자 업체정보 그대로 — 참조 유지", () => {
    const 기존 = { 대표자이름: "박대표" } as never;
    const m = mergeLeadDraft(
      { 업체정보: 기존 },
      mkLead({ 대표자명: "", 연락처: "", 소개처: "" }),
    );
    expect(m.업체정보).toBe(기존); // 재구성 없이 그대로
  });

  it("양쪽 커스텀 전무(소개처 없는 lead) → 커스텀 키 자체가 생략된다(유령 '{}' JSON 방지)", () => {
    const m = mergeLeadDraft(
      { 업체정보: { 대표자이름: "" } as never },
      mkLead({ 소개처: "" }),
    );
    expect(m.업체정보?.대표자이름).toBe("김대표");
    expect(m.업체정보?.커스텀).toBeUndefined(); // {업체:{},대표자:{}} 를 만들지 않음
  });

  it("🐛회귀: 사용자 값은 trim 변형 없이 verbatim 보존 (§2-3.2 자구 준수)", () => {
    const m = mergeLeadDraft(
      { 업체명: " 내가적은상사 ", 예약비고: " 직접 메모 ", 업체정보: { 대표자이름: " 박대표 " } as never },
      mkLead(),
    );
    expect(m.업체명).toBe(" 내가적은상사 ");
    expect(m.예약비고).toBe(" 직접 메모 ");
    expect(m.업체정보?.대표자이름).toBe(" 박대표 ");
  });

  it("계약: 발굴 교체는 merge 로 표현 못 한다 — 원본 스냅샷 merge 또는 leadToMeetingDraft 대체 (PR-3 의무)", () => {
    const A = mkLead({ 업체명: "A상사", 대표자명: "김A" });
    const B = mkLead({ 업체명: "B상사", 대표자명: "박B" });
    const afterA = mergeLeadDraft({}, A);
    // naive 재호출 = A 값이 '사용자 값'으로 보존되어 A+B 혼합 (스펙상 의도된 fill-empty 동작)
    const naive = mergeLeadDraft(afterA, B);
    expect(naive.업체명).toBe("A상사");
    // PR-3 이 써야 할 두 경로 — 둘 다 B 로 깨끗이 교체된다.
    expect(mergeLeadDraft({}, B).업체명).toBe("B상사"); // (a) 원본 스냅샷에 merge
    expect(leadToMeetingDraft(B).업체명).toBe("B상사"); // (b) 대체
  });

  it("입력 불변 — current 객체를 변형하지 않는다", () => {
    const cur = {
      업체명: "",
      업체정보: { 커스텀: { 업체: { 별칭: "본사" }, 대표자: {} } } as never,
    };
    const snapshot = JSON.stringify(cur);
    mergeLeadDraft(cur, mkLead());
    expect(JSON.stringify(cur)).toBe(snapshot);
  });
});
