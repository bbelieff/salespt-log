/**
 * Layer: service — 발굴(03 콜·지·기·소) → 미팅 폼 프리필 매퍼 (lead-chain §2, v1).
 *
 * 순수 함수만 — @/types 외 의존 0(googleapis 비의존) → 피커 UI(클라이언트)가 직접 import 가능.
 * 이 인터페이스는 PR-2(발굴 목록 조회)·PR-3(피커 UI)가 소비하는 공용 계약 — 시그니처 변경 주의.
 *
 * 의미론(lead-chain §2-3, 위반 금지):
 *   1. 프리필 = 미팅 생성 시점 1회 복사(스냅샷). 이후 03 수정이 04/06 을 덮지 않는다(역동기화 금지).
 *   2. 비파괴 merge — 사용자가 이미 적은 값은 절대 덮지 않는다(빈 필드에만 채움).
 *   3. 매핑(§2-2): 업체명→Meeting.업체명 · 대표자명→CompanyInfo.대표자이름(키 이명, rename 금지 §6-R3)
 *      · 연락처→연락처통신사 · 소개처→커스텀.업체["소개처"](정형 컬럼 없음 — 04 AN→06 Y→TXT 기존 배관)
 *      · 조건→예약비고 · 구분→예약비고 머리말 "[구분]" · 접수일=미승계.
 */
import { CompanyInfo, DBLead } from "@/types";

/** 커스텀 JSON 안에서 소개처가 사는 라벨 키 — 04 AN → 06 Y → TXT 전 구간이 이 문자열로 왕복. */
export const LEAD_REFERRER_CUSTOM_KEY = "소개처";

/** Meeting.예약비고 의 zod 상한(@/types). 03 조건은 무제한 자유텍스트라 매퍼가 클램프한다 —
 * 하류 스키마를 위반하는 값을 애초에 내보내지 않는다(폼이 저장 시 400 나는 걸 방지). */
const REMARK_MAX = 500;

/** 발굴 → 미팅 폼 초안. 프리필 대상 필드만(그 외 폼 필드는 매퍼 관심사 아님). */
export interface LeadMeetingDraft {
  업체명: string;
  예약비고: string;
  /** 채울 값이 하나도 없으면 undefined (빈 CompanyInfo 를 폼에 얹지 않음 — buildCompanyInfo 관례). */
  업체정보?: CompanyInfo;
}

const t = (v: string | undefined) => (v ?? "").trim();

/** 구분·조건 → 예약비고 한 줄. 예: "[지인] 3천 이하" / "[지인]" / "3천 이하" / "".
 * REMARK_MAX 로 클램프 — 03 조건은 무제한이라 클램프 없으면 저장 시 zod 400. */
export function leadRemark(lead: Pick<DBLead, "구분" | "조건">): string {
  const 구분 = t(lead.구분);
  const 조건 = t(lead.조건);
  const line = [구분 ? `[${구분}]` : "", 조건].filter(Boolean).join(" ");
  return line.length > REMARK_MAX ? line.slice(0, REMARK_MAX) : line;
}

/**
 * 발굴 1건 → 미팅 폼 초안(스냅샷). 접수일은 승계하지 않는다(03 라이프사이클 메타).
 * 업체정보는 대표자명·연락처·소개처 중 하나라도 있어야 생성 — 전부 비면 undefined.
 */
export function leadToMeetingDraft(lead: DBLead): LeadMeetingDraft {
  const 대표자명 = t(lead.대표자명);
  const 연락처 = t(lead.연락처);
  const 소개처 = t(lead.소개처);

  let 업체정보: CompanyInfo | undefined;
  if (대표자명 || 연락처 || 소개처) {
    업체정보 = CompanyInfo.parse({
      대표자이름: 대표자명, // 키 이명 매핑 — CompanyInfo 스키마 rename 금지(§6-R3)
      연락처통신사: 연락처,
      ...(소개처
        ? { 커스텀: { 업체: { [LEAD_REFERRER_CUSTOM_KEY]: 소개처 }, 대표자: {} } }
        : {}),
    });
  }
  return { 업체명: t(lead.업체명), 예약비고: leadRemark(lead), 업체정보 };
}

/** 프리필이 관여하는 폼 필드 부분집합. */
export interface LeadMergeTarget {
  업체명?: string;
  예약비고?: string;
  업체정보?: CompanyInfo;
}

/**
 * 비파괴 병합 — 발굴 초안을 **빈 필드에만** 채워 새 값을 반환(입력 불변, 사용자 값은 verbatim 보존).
 * 문자열: 사용자 값(공백 아님)이 있으면 원문 그대로 유지. 예약비고는 append 하지 않는다.
 * 업체정보: 필드 단위 병합 — 대표자이름·연락처통신사 각각 비었을 때만, 커스텀.업체[소개처]는
 * 그 키가 없을 때만(사용자 커스텀 다른 키는 항상 보존).
 *
 * ⚠️ **PR-3(피커 UI) 의무 2가지 — 이 함수만으로는 못 지킨다**:
 *  (1) **발굴 교체**: 이 병합은 "빈 칸 채움"이라 원천(프리필 유래 vs 사용자 타이핑)을 구분하지 못한다.
 *      발굴 A 프리필 후 **다른 발굴 B 를 고르면** A 값이 "사용자 값"으로 보존돼 A+B 혼합 레코드가 된다.
 *      → 교체 시 (a) 프리필 **직전 원본 스냅샷**에 merge 하거나 (b) `leadToMeetingDraft(B)` 로 **대체**하라.
 *  (2) **CompanyInfoEditor 리마운트**: 에디터는 mount 시 `value` 로 draft 를 1회 초기화하고 이후
 *      prop 을 동기화하지 않는다 → 마운트 후 업체정보를 주입하면 **안 그려지고 다음 타이핑이 덮는다**.
 *      → 주입 후 `key` 를 바꿔 리마운트한다(레포 선례: CompanyInfoContractSection 의 remount-key).
 */
export function mergeLeadDraft(
  current: LeadMergeTarget,
  lead: DBLead,
): { 업체명: string; 예약비고: string; 업체정보?: CompanyInfo } {
  const draft = leadToMeetingDraft(lead);
  // 사용자 값은 trim 하지 않고 원문 그대로 — "절대 안 덮음"(§2-3.2) 을 자구적으로 지킨다.
  const 업체명 = t(current.업체명) ? current.업체명! : draft.업체명;
  const 예약비고 = t(current.예약비고) ? current.예약비고! : draft.예약비고;

  if (!draft.업체정보) {
    return { 업체명, 예약비고, 업체정보: current.업체정보 };
  }
  if (!current.업체정보) {
    return { 업체명, 예약비고, 업체정보: draft.업체정보 };
  }
  // 필드 단위 비파괴 — 사용자 입력이 있는 필드는 절대 덮지 않는다(§2-3.2).
  const cur = current.업체정보;
  const 커스텀업체 = { ...(cur.커스텀?.업체 ?? {}) };
  const 커스텀대표자 = { ...(cur.커스텀?.대표자 ?? {}) };
  const draft소개처 = draft.업체정보.커스텀?.업체?.[LEAD_REFERRER_CUSTOM_KEY];
  if (draft소개처 && !t(커스텀업체[LEAD_REFERRER_CUSTOM_KEY])) {
    커스텀업체[LEAD_REFERRER_CUSTOM_KEY] = draft소개처;
  }
  const merged: Record<string, unknown> = {
    ...cur,
    대표자이름: t(cur.대표자이름) ? cur.대표자이름 : draft.업체정보.대표자이름,
    연락처통신사: t(cur.연락처통신사) ? cur.연락처통신사 : draft.업체정보.연락처통신사,
  };
  // 빈 커스텀은 키 자체를 생략 — 커스텀 객체가 존재하면 meetingToRow/06 스냅샷이
  // '{"업체":{},"대표자":{}}' 를 시트 AN/Y 에 실제로 기록한다(빈 셀이어야 할 곳에 유령 JSON).
  if (Object.keys(커스텀업체).length || Object.keys(커스텀대표자).length) {
    merged.커스텀 = { 업체: 커스텀업체, 대표자: 커스텀대표자 };
  } else {
    delete merged.커스텀;
  }
  return { 업체명, 예약비고, 업체정보: CompanyInfo.parse(merged) };
}
