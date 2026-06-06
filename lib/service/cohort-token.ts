/**
 * Layer: service — 기수 토큰 파싱 + 시트 제목 빌더 + 멤버 처리 판정 (순수 함수).
 *
 * googleapis 의존 0 → 단위 테스트 용이. I/O 는 route 가 수행하고 결정 로직만 여기 둔다.
 *
 * 토큰 규칙 (ADR-0011 / admin-cohort-create):
 *   - 숫자  "8" / "8기"       → 일반 기수.  label="8",  display="8기"
 *   - a+숫자 "a1" / "A1" / "A1회" → 아레나.   label="A1", display="A1회"
 *   - 대소문자 무시.
 *
 * 시트 제목:
 *   - 일반: `세일즈PT_ {N}기 {이름} 수강생 경영일지`
 *   - 아레나: `세일즈PT_ A{n}회 {이름} 경영일지`
 */
import type { CohortType } from "@/repo/cohorts";

export interface ParsedCohort {
  type: CohortType;
  /** registry/cohorts 의 label. 일반="8", 아레나="A1" (대문자 A + 숫자). */
  label: string;
  /** 사람 표시용. 일반="8기", 아레나="A1회". */
  display: string;
  /** 아레나면 회차 숫자, 일반이면 기수 숫자 (문자열). */
  num: string;
}

/**
 * 기수 토큰 1개 파싱. 형식 불일치면 null.
 * 허용: "8", "8기", "a1", "A1", "a1회", "A 1" (공백 흡수).
 */
export function parseCohortToken(token: string): ParsedCohort | null {
  const t = String(token ?? "").trim();
  if (!t) return null;

  // 아레나: a/A + 숫자 (+ 선택적 "회")
  const arena = t.match(/^a\s*0*(\d+)\s*회?$/i);
  if (arena) {
    const n = arena[1]!;
    return { type: "arena", label: `A${n}`, display: `A${n}회`, num: n };
  }

  // 일반: 숫자 (+ 선택적 "기")
  const cohort = t.match(/^0*(\d+)\s*기?$/);
  if (cohort) {
    const n = cohort[1]!;
    return { type: "cohort", label: n, display: `${n}기`, num: n };
  }

  return null;
}

/** 복제될 개인 시트 제목 생성. */
export function buildCohortSheetTitle(p: ParsedCohort, name: string): string {
  const clean = name.trim();
  if (p.type === "arena") {
    return `세일즈PT_ A${p.num}회 ${clean} 경영일지`;
  }
  return `세일즈PT_ ${p.num}기 ${clean} 수강생 경영일지`;
}

// ── 아레나 추가 전용 (시즌+명단, "0기" 고정 명명) ─────────────────
// registry/cohorts label. 시즌 1 → "A1".
export function arenaSeasonLabel(season: number): string {
  return `A${season}`;
}
// 경영일지 시트 제목: `세일즈PT_A{시즌}_0기 {이름}_대표님 경영일지`
export function buildArenaSheetTitle(season: number, name: string): string {
  return `세일즈PT_A${season}_0기 ${name.trim()}_대표님 경영일지`;
}
// 업체관리 폴더 이름: `세일즈PT_A{시즌}_0기 {이름}_대표님 업체관리`
export function buildArenaCompanyFolderName(season: number, name: string): string {
  return `세일즈PT_A${season}_0기 ${name.trim()}_대표님 업체관리`;
}

export type ArenaPlan =
  | { action: "skip"; name: string }
  | { action: "fail"; name: string; reason: string }
  | { action: "create"; name: string; sheetTitle: string; folderName: string };

/**
 * 아레나 참가자 1명 처리 판정 (순수).
 *  - existingSheetId 있으면 skip (멱등 — registry (A{시즌}, name) + 유효 시트).
 *  - 이름 비면 fail. 아니면 create(시트제목·폴더명 생성).
 */
export function decideArenaAction(input: {
  season: number;
  name: string;
  existingSheetId: string | null;
}): ArenaPlan {
  const name = input.name.trim();
  if (!name) return { action: "fail", name: input.name, reason: "이름 없음" };
  if (input.existingSheetId) return { action: "skip", name };
  return {
    action: "create",
    name,
    sheetTitle: buildArenaSheetTitle(input.season, name),
    folderName: buildArenaCompanyFolderName(input.season, name),
  };
}

// ── 멤버 처리 판정 (멱등/실패/생성/연동 분기) ────────────────────
export type MemberPlan =
  | { action: "skip"; name: string }
  | { action: "fail"; name: string; reason: string }
  | { action: "create"; name: string; title: string; folderId: string }
  | { action: "link"; name: string; sheetId: string };

/**
 * 비동기 lookup 결과를 받아 멤버 1명의 처리 방법을 결정 (순수).
 *  - existingSheetId 있으면 무조건 skip (멱등).
 *  - create: folderId 없으면 fail (사유 = folderError ?? 기본 "이름 폴더 없음").
 *    folderError 로 "여러 개 명확화 필요: …후보" 같은 모호성 사유를 주입할 수 있다.
 *  - link: sheetId 형식 불량이면 "시트 URL 오류" fail.
 */
export function decideMemberAction(input: {
  mode: "create" | "link";
  parsed: ParsedCohort;
  name: string;
  existingSheetId: string | null;
  folderId?: string | null; // create 모드: findFolderContainingName 결과 id
  folderError?: string; // create 모드: 폴더 매칭 실패 사유(없음/모호) 주입
  sheetId?: string; // link 모드: 추출된 spreadsheetId
}): MemberPlan {
  const name = input.name.trim();
  if (!name) return { action: "fail", name: input.name, reason: "이름 없음" };

  // 멱등: (label, name) 이 이미 시트와 함께 등록됨 → 건너뜀.
  if (input.existingSheetId) return { action: "skip", name };

  if (input.mode === "create") {
    if (!input.folderId) {
      return {
        action: "fail",
        name,
        reason: input.folderError ?? "이름 폴더 없음 (루트 폴더 내 매칭 실패)",
      };
    }
    return {
      action: "create",
      name,
      title: buildCohortSheetTitle(input.parsed, name),
      folderId: input.folderId,
    };
  }

  // link 모드.
  const sid = String(input.sheetId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(sid)) {
    return { action: "fail", name, reason: "시트 URL/ID 형식 오류" };
  }
  return { action: "link", name, sheetId: sid };
}
