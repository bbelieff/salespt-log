---
slug: badge-collection
status: completed
created: 2026-10-24
worktree: ../wt/claude-activity-days (branch feat/badge-collection)
---

# 배지 수집 1단계 — 지금 기록으로 판정 가능한 배지 + 수집 화면 + 로고 메뉴

목적: 매일 영업활동을 기록하게 하는 심리장치의 첫 보상 화면. belie 승인 목업(2026-10-24) — 배지 31개 승인, 1단계 개발·운영 반영 지시.
읽는 사람: 개발자, belie. 관련: [activity-days-stage0](../completed/activity-days-stage0.md), [activity-events-adapter](activity-events-adapter.md), 외부 목업 `개발프로젝트/_docs/경영일지_배지수집_목업.html`.

## Acceptance Criteria
- [x] `lib/analytics/badge-catalog.ts` 31개 정본(이름·얻는 법·그림·등급·ready·cta), `lib/analytics/badges.ts` `judgeBadges` 순수 판정 — 영업활동일은 #1195·#1214 판정 재사용, 미래 날짜·미컨택·이월 계약 제외
- [x] 읽기 전용 repo `lib/repo/db/badge-reads.ts`(연락 기록·DB관리시트 업체 3칸·첫 주간목표·첫 알림) + service `loadBadges` — DB 정본 기수만 읽음(시트 동기 호출 없음), 한 출처 실패는 partial
- [x] `GET /api/badges` — requireStudentViewContext(대리 보기·아레나 시트 포함), no-store
- [x] `/badges` 화면 + `BadgeMedal`·`BadgeDetailSheet` + 로고 메뉴 「배지 수집 N/31」 + 안 본 새 배지 점
- [x] 화면 확인 PC 1280·모바일 320/375/430·0개·메뉴·크게 보기(합성 데이터 임시 미리보기) — 숨은 배지 조건 노출 버그 발견·수정
- [x] `bash scripts/check.sh`(시험 4522) + production build
- [x] #1220 squash 785a5bfa, Deploy 40079147429 success, health 200, /api/badges 401(비로그인)·/badges/trophy.png 200. 로그인 화면 실물 확인은 NOT_RUN(Claude 로그인 불가) — belie 확인 필요

## 1단계에서 얻을 수 없는 배지 7개(「준비 중」 표시)
주 목표 첫 달성·4번(주 목표 일수 저장 칸 없음), 홈 화면 추가·씨앗에서 시작·비서에게 답하기(기록 없음), 약속 지킨 주(지난 주 놓친 약속 이력 없음), 아침형 영업인(연락 시각 저장 안 됨).

## 자율결정
- 「첫 DB관리 정리」 얻는 법을 「DB관리시트에서 첫 결과를 저장」→「DB관리시트에 첫 업체를 올림」으로 바꿈: 첫 결과 저장은 「첫 연락 기록」과 같은 기록이라 두 배지가 늘 함께 열림. 되돌리기 = 카탈로그 문구·판정 한 줄.
- 배지 저장 테이블을 만들지 않고 매번 기록에서 계산(마이그레이션·운영 DB 쓰기 없음). 한계: 원 기록을 지우면 그 배지도 빠질 수 있음 — 2단계 획득 알림 때 획득 기록 저장 여부를 정한다.
- 「새 배지」는 이 기기 localStorage(새소식 점과 같은 방식). 다른 기기에서는 처음 보는 기기 규칙(최근 7일)으로 다시 NEW.
- 업체정보 준비는 DB관리시트 업체의 업종·매출·지역 3칸 기준(얻은 날짜 없음 → 「획득」만 표시).

## Log
- 2026-10-24 판정·API·화면·메뉴 구현(Claude). 시험: 판정 14·API 3·service 4.
- 2026-10-24 #1220 병합·배포(785a5bfa, last-good f6ba1a5a). 남은 일: 빌드 경고 2건(쓰지 않는 eslint-disable 주석) 정리, 2단계(획득 알림·축하 화면) 착수 전 획득 기록 저장 여부 결정.
