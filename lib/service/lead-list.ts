/**
 * Layer: service — 발굴(콜·지·기·소 영업기회) 목록 조회 순수 헬퍼 (lead-chain PR-2).
 *
 * 컨택탭 발굴 피커(PR-3)가 소비할 목록의 **정렬·검색**만 담당하는 순수 함수.
 * I/O·게이트는 db.ts `loadLeadsForPicker` 가, `matched` 파생·링크는 PR-6 이 담당.
 * SoR: docs/plans/active/lead-chain.md §7-1
 */
import type { DBLead } from "@/types";

/** 피커가 받는 발굴 후보(정렬·검색 대상). `발굴id` 는 DB 소스일 때만(시트=legacy 미보유).
 *  `matched` 는 PR-6 이 채운다 — PR-2 스코프 밖(계약상 존재만 못박음). */
export type LeadForPicker = DBLead & { row: number; 발굴id?: string };

/** 접수일 내림차순(최근 먼저). 접수일 동률·빈값은 row 내림차순으로 안정 정렬(최근 입력 우선). */
export function sortLeadsByRecent(leads: LeadForPicker[]): LeadForPicker[] {
  return [...leads].sort((a, b) => {
    const d = (b.접수일 || "").localeCompare(a.접수일 || "");
    if (d !== 0) return d;
    return (b.row ?? 0) - (a.row ?? 0);
  });
}

/** 검색 — 대표자명·업체명·소개처·연락처·구분 부분일치(대소문자·공백 무시). 빈 질의=전체. */
export function filterLeads(
  leads: LeadForPicker[],
  query: string,
): LeadForPicker[] {
  const q = query.trim().toLowerCase();
  if (!q) return leads;
  const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, "");
  const needle = norm(q);
  return leads.filter((l) =>
    [l.대표자명, l.업체명, l.소개처, l.연락처, l.구분].some((f) =>
      norm(f).includes(needle),
    ),
  );
}

/** 조회 정본 파이프라인 — 검색 후 접수일 내림차순. (I/O 는 호출부, 이건 순수.) */
export function selectLeadsForPicker(
  leads: LeadForPicker[],
  query = "",
): LeadForPicker[] {
  return sortLeadsByRecent(filterLeads(leads, query));
}
