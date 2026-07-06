---
slug: new-feature-highlight
status: active
created: 2026-07-06
owner: belie
related: announcement-popup, sheet-structure, components
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새소식 팝업에서 새 기능(feat)을 "새 기능" 뱃지로 강조하고, 앱 안 해당 기능 위치에 다음 새 기능이 나올 때까지 NEW 표시를 자동으로 붙이는 설계.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 새소식 팝업/보관함, updates 탭(레지스트리), Changelog 커밋 규약(CLAUDE.md §6.5), 각 탭 UI(앵커 지점)
> - **읽고 나면 알 수 있는 것**: 뱃지가 언제 붙고 언제 사라지나, 앱 내 위치를 어떻게 지정하나, 운영자가 할 일이 있나(없음)
> - **관련 문서**: announcement-popup.md(§7 운영 지침), docs/domains/sheet-structure.md

# 새 기능 하이라이트 (팝업 "새 기능" 뱃지 + 앱 내 NEW 표시)

## 0. 확정 결정 (2026-07-06 사용자)
- **팝업/보관함**: type=feat 항목(그룹이면 feat 포함 그룹)에 "새 기능" 뱃지 + 테두리 강조. 개선(fix/perf)은 뱃지 없음.
- **앱 내 NEW**: 새 기능의 실제 위치(카드·버튼·탭)에 NEW 뱃지 + 하단 탭에 점 표시. **다음 새 기능이 배포되면 자동으로 그쪽으로 이동**(운영 수작업 0).

## 1. 데이터 — 앵커(anchor)
- updates 탭에 `anchor` 컬럼 append(shift 금지, sheet-structure.md 등재). 값 = 앱에 등록된 앵커 키(예 `calendar.gcalCard`).
- 수집: squash 커밋에 `Changelog-Anchor: <앵커키>` 줄(선택) → append-updates 가 적재. admin 팝업관리에서 수정 가능.
- 활성 규칙: **visible=TRUE 이고 anchor 가 있는 feat(그룹) 중 최신 1건만 활성**. 새 feat 적재 시 자동 교체. 기간 상한 14일(오래 방치 방지).

## 2. 프론트 — 앵커 레지스트리
- `lib/config`(또는 components 상수)에 앵커 키 → 위치 매핑 SSOT: 키 문자열 상수 목록. 존재하지 않는 키가 시트에 적히면 무시(경고 로그).
- `<NewBadge anchorKey="...">` 래퍼 컴포넌트 — /api/announcements 가 내려주는 활성 anchor 와 일치하면 NEW 뱃지 렌더. 해당 앵커가 속한 하단 탭에는 점 표시.
- 뱃지 문구 "NEW" 고정(2~3자, 모바일 잘림 없음). 색은 기존 토큰(브랜드 red 계열) — 신규 토큰 필요 시 tokens.md 먼저.
- 사용자가 그 화면을 방문하면 localStorage 로 점(탭 표시)만 개인 해제 — 위치 뱃지는 활성 기간 동안 유지(가벼운 강조).

## 3. 규약 추가 (CLAUDE.md §6.5)
- feat PR 는 가능하면 `Changelog-Anchor: <앵커키>` 포함(앵커 없는 feat 는 팝업 뱃지만).
- 앵커 키 신설 시 프론트 레지스트리에 먼저 등록(코드→SSOT 방향, doc-drift 대상 아님·상수 목록이 정본).

## 4. QA
| # | 케이스 | 기대 |
|---|---|---|
| 1 | feat 항목 팝업 표시 | "새 기능" 뱃지+강조, fix/perf 는 없음 |
| 2 | anchor 있는 feat 배포 | 해당 위치 NEW + 탭 점 |
| 3 | 다음 anchor feat 배포 | 이전 NEW 제거, 새 위치로 이동 |
| 4 | anchor 오타(미등록 키) | 무시+경고 로그, 화면 깨짐 없음 |
| 5 | 14일 경과 | NEW 자동 해제 |
| 6 | 해당 화면 방문 | 탭 점 개인 해제(localStorage), 위치 뱃지는 유지 |
| 7 | 모바일 360px | 뱃지로 인한 레이아웃 밀림·잘림 0건 |

## Log
- 2026-07-06 확정: feat 뱃지 강조 + 앵커 기반 앱 내 NEW(최신 1건, 자동 교체, 상한 14일, 운영 수작업 0).
