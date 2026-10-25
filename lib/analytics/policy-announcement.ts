/**
 * Layer: analytics(순수) — 정책자금뉴스 줄 → 공고 하나(2026-10-26 맞춤공고 2단계).
 * 여러 날 피드에 같은 공고가 반복해 나온다 → 공고 id 로 합치고 가장 최근 줄을 쓴다(처음 본 날은 남긴다).
 * 지역 글은 시·도 / 시·군·구 범위로, 마감 글은 날짜·예산 소진·상시·모름으로 읽는다. 원문은 그대로 둔다.
 * 매칭 판정(업체와 맞는가)은 3단계 — 여기서는 읽기만.
 */
import type { PolicyNewsDay, PolicyNewsRow } from "@/types/policy-news";
import { parseRegion, type Sido } from "@/util/admin-regions";

export const UNKNOWN = "확인안됨";

/** 공고 지역 범위 — 전국, 또는 시·도(시·군·구가 비면 시·도 전체). */
export type RegionScope = { kind: "nation" } | { kind: "area"; 시도: Sido; 시군구: string };

export type Deadline =
  | { kind: "date"; date: string; budget: boolean }
  | { kind: "budget" }
  | { kind: "always" }
  | { kind: "unknown" };

export interface PolicyAnnouncement {
  id: string;
  title: string;
  agency: string;
  regionText: string;
  /** 비어 있으면 지역을 못 읽음 — 매칭에서 「확인 필요」. */
  regions: RegionScope[];
  kind: string;
  maxAmount: string;
  target: string;
  industryLimit: string;
  ageLimit: string;
  special: string;
  postedAt: string;
  deadline: Deadline;
  deadlineText: string;
  link: string;
  firstSeen: string;
  lastSeen: string;
}

const clean = (v: unknown) => String(v ?? "").trim();
const known = (v: string) => (v && v !== UNKNOWN ? v : "");

/** 공고 id — 기업마당 링크의 pblancId, 없으면 사업명+주관기관. */
export function announcementId(row: Pick<PolicyNewsRow, "사업명" | "주관기관" | "공고원문링크">): string {
  const m = clean(row.공고원문링크).match(/pblancId=([A-Za-z0-9_]+)/);
  if (m) return m[1]!;
  return `t:${clean(row.사업명).replace(/\s+/g, " ")}|${clean(row.주관기관).replace(/\s+/g, " ")}`;
}

/** 지역 글 → 범위. 「전국」이 있으면 전국. 「광주광역시(5개 자치구)」「서울·경기」「여수·울산 남구」도 읽는다. */
export function parseScopes(text: string): RegionScope[] {
  const t = clean(text);
  if (!known(t)) return [];
  if (/전국/.test(t)) return [{ kind: "nation" }];
  const out: RegionScope[] = [];
  const seen = new Set<string>();
  for (const raw of t.split(/[,·/()、]|\s및\s/)) {
    const tok = raw.trim();
    if (!tok) continue;
    let r = parseRegion(tok);
    // 「여수」「서산」처럼 시·군을 떼고 쓴 이름.
    if (!r.시도) for (const suffix of ["시", "군"]) { r = parseRegion(`${tok}${suffix}`); if (r.시도) break; }
    if (!r.시도) continue;
    const key = `${r.시도}|${r.시군구}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "area", 시도: r.시도, 시군구: r.시군구 });
  }
  // 같은 시·도 전체가 있으면 그 안의 시·군·구는 겹친다 — 전체만 남긴다.
  const whole = new Set(out.filter((s) => s.kind === "area" && !s.시군구).map((s) => (s as { 시도: string }).시도));
  return out.filter((s) => s.kind !== "area" || !s.시군구 || !whole.has(s.시도));
}

/** 마감 글 → 날짜 / 예산 소진 / 상시 / 모름. 날짜와 「소진 시 조기마감」이 함께면 date + budget. */
export function parseDeadline(text: string): Deadline {
  const t = clean(text);
  const budget = /소진|조기\s*마감/.test(t);
  const m = t.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (m) return { kind: "date", date: `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`, budget };
  if (budget) return { kind: "budget" };
  if (/상시|연중|수시/.test(t)) return { kind: "always" };
  return { kind: "unknown" };
}

export function toAnnouncement(row: PolicyNewsRow, date: string): PolicyAnnouncement {
  const regionText = clean(row.지역);
  return {
    id: announcementId(row),
    title: clean(row.사업명),
    agency: clean(row.주관기관),
    regionText,
    regions: parseScopes(regionText),
    kind: known(clean(row.성격)),
    maxAmount: known(clean(row.최대지원금액)),
    target: known(clean(row.지원대상)),
    industryLimit: known(clean(row.업종제한)),
    ageLimit: known(clean(row.창업업력제한)),
    special: known(clean(row.특정타겟)),
    postedAt: known(clean(row.공고일)),
    deadline: parseDeadline(clean(row.마감일)),
    deadlineText: clean(row.마감일),
    link: /^https?:\/\//.test(clean(row.공고원문링크)) ? clean(row.공고원문링크) : "",
    firstSeen: date,
    lastSeen: date,
  };
}

/** 여러 날 피드 → 공고 목록(같은 id 는 하나, 최근 줄 우선, 처음 본 날 유지). 사업명이 빈 줄은 버린다. */
export function mergeAnnouncements(days: readonly PolicyNewsDay[]): PolicyAnnouncement[] {
  const byId = new Map<string, PolicyAnnouncement>();
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const row of day.rows) {
      if (!clean(row.사업명)) continue;
      const a = toAnnouncement(row, day.date);
      const prev = byId.get(a.id);
      byId.set(a.id, prev ? { ...a, firstSeen: prev.firstSeen } : a);
    }
  }
  return [...byId.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.title.localeCompare(b.title));
}

/** 마감이 지난 날짜형 공고인가(오늘 날짜 글 YYYY-MM-DD 기준). */
export function isClosed(a: PolicyAnnouncement, today: string): boolean {
  return a.deadline.kind === "date" && a.deadline.date < today;
}

