/**
 * 아레나 시즌 그룹핑 — 순수 함수 (AR-1).
 *
 * admin 수강생관리에서 아레나 기수(A{시즌}-{기수})를 **시즌 우산** 아래 묶는다.
 * 시즌 파싱은 `arenaCohortLabelParts`(lib/service/cohort-token) **재사용** — 신규 파서 금지.
 * A2 기수가 등장하면 데이터만으로 시즌2 그룹이 자동 생성된다(하드코딩 없음).
 *
 * 헤더 메타(기간·진행률·D-day)는 시즌에 속한 trainee 의 courseStart/graduation 에서
 * 파생한다 — **날짜 하드코딩 금지**. 시즌 시작=최소 개강일, 종료=최대 종강일.
 */
import { arenaCohortLabelParts } from "@/service/cohort-token";
import type { Trainee } from "./AdminUserPickerTypes";

export interface ArenaSeasonGroup {
  /** 시즌 번호 (A1 → 1). */
  season: number;
  /** 이 시즌에 속한 [그룹키, 명단] — 입력 순서(=기수 asc 정렬) 보존. */
  groups: Array<[string, Trainee[]]>;
  /** 시즌 총 인원. */
  count: number;
  /** 시즌 개강일(최소) ISO — 없으면 undefined. */
  startISO?: string;
  /** 시즌 종강일(최대) ISO — 없으면 undefined. */
  endISO?: string;
}

/** ISO(YYYY-MM-DD) 유효성 — 잘못된 값은 기간 계산에서 제외. */
function isIso(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * 아레나 그룹 목록을 시즌별로 묶는다.
 * - 시즌 파싱 실패(비아레나 라벨)한 그룹은 `orphans` 로 반환 — 삼키지 않는다(유실 방지).
 * - 시즌은 번호 asc, 시즌 내 그룹은 입력 순서 유지(호출부가 이미 기수 asc 로 정렬).
 */
export function groupArenaBySeason(
  groups: Array<[string, Trainee[]]>,
): { seasons: ArenaSeasonGroup[]; orphans: Array<[string, Trainee[]]> } {
  const bySeason = new Map<number, ArenaSeasonGroup>();
  const orphans: Array<[string, Trainee[]]> = [];

  for (const entry of groups) {
    const [groupKey, list] = entry;
    const parts = arenaCohortLabelParts(groupKey); // 재사용 파서 ("A1-1"/"A1-1기" 둘 다)
    if (!parts) {
      orphans.push(entry);
      continue;
    }
    let g = bySeason.get(parts.season);
    if (!g) {
      g = { season: parts.season, groups: [], count: 0 };
      bySeason.set(parts.season, g);
    }
    g.groups.push(entry);
    g.count += list.length;
    // 기간 = 시즌 내 최소 개강 ~ 최대 종강 (trainee 데이터 파생, 하드코딩 없음)
    for (const u of list) {
      if (isIso(u.courseStartISO) && (!g.startISO || u.courseStartISO < g.startISO)) {
        g.startISO = u.courseStartISO;
      }
      if (isIso(u.graduationISO) && (!g.endISO || u.graduationISO > g.endISO)) {
        g.endISO = u.graduationISO;
      }
    }
  }

  const seasons = Array.from(bySeason.values()).sort((a, b) => a.season - b.season);
  return { seasons, orphans };
}
