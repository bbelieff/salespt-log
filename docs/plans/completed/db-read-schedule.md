---
slug: db-read-schedule
status: completed
created: 2026-07-08
owner: belie
related: db-migration-pilot, db-read-contact, db-read-meetings-banners, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2 읽기 전환 3호 — 일정·계약 탭 loadWeekMeetings(주간 미팅 카드 + 주간 funnel)를 파일럿 기수 한정 DB read 로 전환, R2-2 의 readMeetingsFromDb 를 재사용.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/contact-week.ts, lib/repo/db/read-daily.ts(R2-2 산출물 재사용), R2-4(실무/수납 — 02 계약 읽기)
> - **읽고 나면 알 수 있는 것**: 이 탭의 시트 read 3개가 무엇이었고 각각 어떻게 대체됐나 / 새 데이터 구조 작업이 없었던 이유 / 계약(02)은 왜 범위 밖인가
> - **관련 문서**: docs/plans/completed/db-read-meetings-banners.md(R2-2), docs/plans/completed/db-read-contact.md(R2-1 게이트 패턴)

# R2-3 — 일정·계약 탭 읽기 DB 전환

## 이 탭의 시트 read 목록 (전환 전 실측)
| read | 대체 |
|---|---|
| readCourseStart(O1) | 레지스트리 K 캐시(user.courseStartISO) 우선 — R2-1 패턴 |
| findByDateRangeBoth(04 전체) | **readMeetingsFromDb 재사용(R2-2)** + groupMeetingsBoth(순수) |
| readWeekFunnel(01 주 블록 E~H 합) | readSalesRowsFromDb + weekFunnelFromRows(순수, 동일 의미) |

→ 파일럿+캐시 히트 시 **시트 read 3→0회**. 계약(02) 읽기는 이 탭에 없음 — R2-4 범위.

## 설계 확인 사항
- **새 데이터 구조 작업 없음** — R2-2 의 read-daily.ts(payload 이중 형태 흡수)를 재사용만 함.
  R2-2 설계 검증 완료.
- 게이트·fallback = chooseDailySource 재사용(단일 판정), 실패 시 전체 시트 경로 + Sentry
  (where=loadWeekMeetings-db-read). 비파일럿 불변.
- 표시문자열 2종(04 N·O): UI 는 소비하지 않음(schedule/page.tsx 가 undefined 로 생성만) —
  payload 에 있으면 통과, 없어도 무영향. 별도 파생 없음(기존과 동일).
- funnel 은 시트와 동일하게 **주 블록(수강시작 요일 기준 7일)** 합산, 1~10주 밖 = 0 가드 동일.

## 수용 기준 스냅샷
- 정합 대조: groupMeetingsBoth·weekFunnelFromRows == 시트 경로 의미(테스트 고정).
- 일정·계약 탭 GET sheets_calls 3→0(파일럿·캐시 히트) — PR 본문 표기, 실측은 배포 후 관찰.
- 비파일럿 경로 불변(기존 테스트), check.sh 초록.

## Log
- 2026-07-08 구현: contact-week.ts 게이트+DB 경로, daily-source.weekFunnelFromRows 신설,
  정합 테스트 4케이스. R2-2 재사용 확인(추가 repo 함수 0).
