/**
 * Layer: config — 앱 내 NEW 표시 앵커 키 레지스트리 (new-feature-highlight §2).
 *
 * **키 상수 SSOT — 이 목록이 정본.** updates 탭 H(anchor)에 적힌 키가 여기 없으면
 * 서버가 무시하고 경고 로그만 남긴다(화면 깨짐 없음, SoR §2·QA4).
 * 앵커 키 신설 = 여기 먼저 등록 → feat 커밋 본문에 `Changelog-Anchor: <키>`
 * (CLAUDE.md §6.5). tab 은 하단 탭 라우트 접두 — 탭 점(dot) 표시 위치.
 */
export interface AnchorDef {
  /** 하단 탭 라우트 접두 (예 "/calendar") — 탭 점 표시 + 방문 해제 판정. */
  tab: string;
  /** 사람용 설명 (어디에 붙는 앵커인지). */
  label: string;
}

export const ANCHORS: Record<string, AnchorDef> = {
  // 구글 캘린더 연동 카드 — feat/gcal-connect 에서 배치 (google-calendar-sync §4·§6).
  "calendar.gcalCard": { tab: "/calendar", label: "캘린더 탭 · 구글 캘린더 연동 카드" },
};

/** 등록된 앵커 키인가 (미등록 = 무시 대상). */
export function isKnownAnchor(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ANCHORS, key);
}
