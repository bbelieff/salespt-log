/**
 * Layer: service — 업데이트 묶음(그룹) 순수 유틸 (announcement-popup §7).
 *
 * repo import 없음 — 서버(announcements.ts)와 클라(UpdateAccordion·보관함)가
 * 같은 그룹핑 규칙을 공유한다. 그룹 키 = updates 탭 milestone(F).
 * 대표 = 그룹 내 최신 pr 행(title_user/body_md 를 큐레이션이 적재).
 */
import type { UpdateItem } from "@/types";

export interface UpdateGroup {
  /** milestone 키. 단건은 `pr-<n>` 합성 키. */
  key: string;
  /** 묶음 여부 (단건=false) — 메타줄·펼침 표기 분기. */
  grouped: boolean;
  /** 대표(최신 pr) 행의 고객용 제목. */
  title: string;
  /** 대표 행의 상세 MD (전:/후: 포맷 권장 — §7-2). */
  bodyMd: string;
  /** 그룹 내 PR 번호 오름차순 — 펼침 "339·340·…번째 업데이트". */
  prs: number[];
  latestPr: number;
  /** 개발 기간 = 그룹 첫~마지막 머지일 (ISO). 단건은 둘이 동일. */
  firstDate: string;
  lastDate: string;
  /** 그룹 내 개별 변경 한 줄씩 (펼침 보조, pr asc) — 단건은 빈 배열. */
  lines: { pr: number; title: string }[];
}

/** visible 행들 → 그룹 항목 (latestPr 내림차순). */
export function groupUpdates(rows: UpdateItem[]): UpdateGroup[] {
  const byKey = new Map<string, UpdateItem[]>();
  for (const r of rows) {
    const key = r.milestone.trim() || `pr-${r.pr}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }
  const groups: UpdateGroup[] = [];
  for (const [key, items] of byKey) {
    const sorted = [...items].sort((a, b) => a.pr - b.pr);
    // 대표 = "고객 문구(body_md)가 큐레이션된 행" 중 최신 — 후속 픽스 PR 이 그룹에
    // 합류해도 큐레이션 제목/전·후가 밀려나지 않게 (group-render 정정 2026-06-11).
    // 큐레이션 행이 없으면 최신 pr fallback.
    const curated = [...sorted].reverse().find((i) => i.bodyMd.trim() !== "");
    const rep = curated ?? sorted[sorted.length - 1]!;
    const dates = sorted.map((i) => i.date).filter(Boolean).sort();
    groups.push({
      key,
      grouped: sorted.length > 1,
      title: rep.titleUser,
      bodyMd: rep.bodyMd,
      prs: sorted.map((i) => i.pr),
      latestPr: rep.pr,
      firstDate: dates[0] ?? rep.date,
      lastDate: dates[dates.length - 1] ?? rep.date,
      lines:
        sorted.length > 1
          ? sorted.map((i) => ({ pr: i.pr, title: i.titleUser }))
          : [],
    });
  }
  // 정렬 = 그룹 "마지막 머지일" 최신순 (§7-4 정본 — 동률은 latestPr).
  return groups.sort(
    (a, b) => b.lastDate.localeCompare(a.lastDate) || b.latestPr - a.latestPr,
  );
}

/** body_md 의 `전:`/`후:` 줄 추출 — 없으면 null (일반 MD 렌더로 폴백). */
export function parseBeforeAfter(
  bodyMd: string,
): { before: string; after: string } | null {
  const b = bodyMd.match(/^전:\s*(.+)$/m);
  const a = bodyMd.match(/^후:\s*(.+)$/m);
  if (!b || !a) return null;
  return { before: b[1]!.trim(), after: a[1]!.trim() };
}

/** ISO(YYYY-MM-DD) → "M/D" (메타줄 표기). */
export function fmtMonthDay(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[1])}/${Number(m[2])}`;
}

/** 메타줄 — 그룹 "개발 M/D~M/D · 적용 M/D", 단건 "적용 M/D" (§7-4). */
export function groupMetaLine(g: UpdateGroup): string {
  const applied = `적용 ${fmtMonthDay(g.lastDate)}`;
  if (!g.grouped) return applied;
  return `개발 ${fmtMonthDay(g.firstDate)}~${fmtMonthDay(g.lastDate)} · ${applied}`;
}

/** 펼침 첫 줄 — "339·340번째 업데이트" / 단건 "345번째 업데이트" (§7-4). */
export function groupOrdinalLine(g: UpdateGroup): string {
  return `${g.prs.join("·")}번째 업데이트`;
}
