---
slug: arena-scoreboard-v2
status: active
created: 2026-06-14
owner: belie
related: arena-season1-setup, role-system
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 전광판에 기수 평균 외 개인 지표별 순위(미팅·계약·매출·앱사용량·공유왕) 데이터 레이어 추가(UI 없음).
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: lib/service/scoreboard.ts, lib/repo/share-scores.ts, share_scores 탭
> - **읽고 나면 알 수 있는 것**: 지표 정의, 공유왕 점수 저장, 캐시 재사용
> - **관련 문서**: arena-season1-setup.md

# 전광판 개인 랭킹 데이터 레이어 (v2)

## 구현
- `share_scores` 탭(레지스트리): A=email B=name C=cohort D=points E=updatedAt.
  `lib/repo/share-scores.ts` readShareScores(10분 캐시)·setShareScores(email 키 행만, §2.5 안전 쓰기).
- `lib/service/scoreboard.ts` `loadIndividualRankings()`: Record<RankingMetric, RankingEntry[]>.
  입금 참가자 1시트=1엔트리. 미팅·계약=cachedWeekly 8주 합, 매출=cachedDashboard finance[2],
  앱사용량=5지표(생산+유입+컨택+미팅+계약) 8주 합(활동 프록시·한 곳 주석), 공유왕=share points.
  cachedWeekly/cachedDashboard(30분, SCOREBOARD_TAG) + pMap(동시성5) 재사용.
- rankEntries: value desc·동점 동순위·이름 asc·rank 1·상위 10.
- types: RankingMetric(z.enum)·RankingEntry. SSOT data-model·sheet-structure 등재.

## 공유왕 수동 집계 (admin)
- `/admin/arena/share-scores`: 입금 참가자(1시트=1인) [−][점수][+] + 이름·기수 검색,
  변경 행만 dirty → "변경사항 저장 (N)" 1회 일괄(UpdatesManager 패턴). 안내문 1점=공유글 1건.
- 서비스 `listShareScoreTargets()`(참가자+현재 점수 머지)·`saveShareScores(rows)`
  ({email,points}만 받아 name/cohort 보강, 비참가자 제외, 저장 후 revalidateTag(SCOREBOARD_TAG)).
- `POST /api/admin/share-scores`: admin 가드(getSessionEmail+isAdminEmail, 403). 조회 GET 없음(서버 컴포넌트 직접).

## 상태
- 2026-06-14 데이터 레이어 완료(feat/scoreboard-individual-data).
- 2026-06-15 공유왕 수동 집계 UI+API 완료(feat/share-king-admin). 전광판 UI 렌더는 후속.
