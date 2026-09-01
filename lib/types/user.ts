/**
 * Layer: types — 사용자(마스터 레지스트리) + 기수 그룹/정렬 헬퍼(repo·component 공유).
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: data-model.md · ADR-0007/0014.
 */
import { z } from "zod";

// ── 사용자 — 마스터 레지스트리 ─────────────────────────────────
export const User = z.object({
  /**
   * 이메일. **빈 문자열을 허용한다** — 사전 등록(prep) 행은 본인이 로그인해 클레임할 때까지
   * email 이 비어 있는 것이 설계다(`users-prep.ts:buildPrepRowValues` A열 = "").
   *
   * ⚠️ 예전엔 `z.string().email()` 이라 **빈 email 행이 검증에서 탈락해 조용히 사라졌다.**
   * `users.ts:parseRow` 는 실패를 null 로 삼키므로, 관리자 명단(`/admin/users`)에서
   * 사전 등록한 수강생이 **아예 안 보였다** — 등록은 됐는데 확인할 방법이 없었다
   * (2026-09-01 belie 신고: "신규수강생 사전등록이라는게 안되지않나?" · 11기 7명·10기 김옥선 실측).
   * 로그인·조회는 email 로 매칭하므로 빈 값 행은 그 경로에 자연히 안 걸린다 — 여기서 막을 이유가 없다.
   */
  email: z.union([z.string().email(), z.literal("")]),
  cohort: z.string(), // 예: "7" (수강생) / "T" (트레이너) / 빈값(admin)
  name: z.string(),
  spreadsheetId: z.string(), // 트레이너·admin 은 빈 문자열 허용
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
  /** active=정상, pending=승인 대기, archived=종강 보관(아레나 재참가 시 옛 기수 행 — 라우팅 미사용, arena-carryover §1) */
  status: z.enum(["active", "pending", "archived"]).default("active"),
  /** 수강생 row 의 담당 트레이너 email (관리자가 배정). 빈값 = 미배정. */
  assignedTrainer: z.string().default(""),
  /** 기수 내 팀 (예: "서울", "부산"). 빈값 = 미배정 → 기수 박스 내 개별 카드. */
  team: z.string().default(""),
  /** 시트 B3 캐시 (예: "PRM 7기"). 빈값이면 enrichUsersWithDates 가 fallback 으로
   *  시트 fetch. PR B (2026-05-13) 에서 도입 — registry SSOT 가 시트 SSOT 의
   *  주요 메타를 그림자로 저장해 평시 시트 read 0회 달성. */
  cohortLabel: z.string().default(""),
  /** 시트 C3 캐시 (예: "김상목"). 빈값이면 fallback. */
  nameLabel: z.string().default(""),
  /** 시트 O1 ISO date (YYYY-MM-DD) 캐시. 빈값이면 fallback. */
  courseStartISO: z.string().default(""),
  /** 시트 O2 ISO date (YYYY-MM-DD) 캐시. 빈값이면 fallback. */
  graduationISO: z.string().default(""),
  /** 박스 내 admin 수동 정렬 순서 (M 컬럼). 0 = 미정렬 (이름 알파 fallback, box 하단),
   *  >0 = explicit ASC. dnd-kit 드래그 후 box 내 카드들에 1..N 일괄 재할당.
   *  PR C-1 (2026-05-13). 같은 (cohort, team) 박스 단위로 의미 부여 — 다른 박스 간에는
   *  비교 안 함. */
  sortOrder: z.number().int().nonnegative().default(0),
  /** Drive 부모 폴더 경로/URL (온보딩 입력, registry N). */
  driveParentPath: z.string().default(""),
  /** 01 피드백업체 폴더 ID (자동 탐색 결과, registry O). */
  feedbackFolderId: z.string().default(""),
  /** Drive 연결 상태: "ok" / "" (미연결) / "error" (registry P). */
  driveLinkStatus: z.string().default(""),
  /** 아레나 회장/입금 메모 (registry Q, "회장"/"입금"/"회장,입금"/빈). 전광판 입금자 모수 필터용. */
  memo: z.string().default(""),
  /** 아레나 회장이 맡은 cohort (registry R, 기 제거형 예 "A1-1"). 빈값=일반 참가자.
   *  role 은 trainee 유지(회장도 플레이어). 값 있으면 "기수임원" 조회 권한 (§6). */
  captainOf: z.string().default(""),
  /** 구글 캘린더 refresh token (registry S) — AES-256-GCM 암호화(ADR-0028). 빈값=미연결. */
  gcalToken: z.string().default(""),
  /** 구글 캘린더 설정 JSON (registry T) — {calendarId}. 빈값=기본(primary). */
  gcalSettings: z.string().default(""),
});
export type User = z.infer<typeof User>;

/** 그룹/정렬 키: 아레나 회장(captainOf)이 옛 기수로 저장돼도 올바른 아레나 그룹으로
 * 통일. captainOf 우선, 없으면 cohort. 기 접미사 제거(arena-grouping §1).
 * repo(listAllUsers 정렬)·component(그룹 박스) 공유 — 최하위 types 레이어 배치. */
export function cohortGroupKey(cohort: string, captainOf?: string): string {
  const cap = String(captainOf ?? "").trim();
  const base = (cap || String(cohort ?? "")).replace(/기\s*$/, "").trim();
  return base || "—";
}

/** 정렬 튜플(사전식): 아레나(A시즌-기수) 우선 → 시즌·기수 asc, 일반 숫자 desc, 기타 끝. */
export function cohortSortTuple(groupKey: string): [number, number, number] {
  const m = /^A(\d+)-(\d+)/.exec(groupKey);
  if (m) return [0, parseInt(m[1]!, 10), parseInt(m[2]!, 10)];
  const n = parseInt(groupKey, 10);
  if (Number.isFinite(n)) return [1, -n, 0];
  return [2, 0, 0];
}

/** 그룹키 정렬 비교자(repo·component 공유). cohortSortTuple 사전식 비교. */
export function cohortGroupCompare(a: string, b: string): number {
  const ka = cohortSortTuple(a), kb = cohortSortTuple(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
}

/** 그룹키 → 상위 카테고리. A시즌-0기=테스트(테스터), A시즌-N기=아레나, 그 외 숫자=수강생.
 *  날짜 추측 없이 라벨의 'A' 접두만으로 결정(admin-cohort-category-boxes). */
export function cohortCategory(groupKey: string): "수강생" | "아레나" | "테스트" {
  if (/^A\d+-0$/.test(groupKey)) return "테스트";
  if (/^A\d+-/.test(groupKey)) return "아레나";
  return "수강생";
}
export const COHORT_CATEGORY_ORDER = ["수강생", "아레나", "테스트"] as const;
