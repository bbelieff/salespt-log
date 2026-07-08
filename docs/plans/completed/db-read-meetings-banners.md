---
slug: db-read-meetings-banners
status: completed
created: 2026-07-08
owner: belie
related: db-migration-pilot, db-read-contact, db-pilot-arena, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2 읽기 전환 2호 — 컨택 탭 loadDay 의 잔여 시트 왕복(미팅 카드 findByDate + 현수막 readBanners)을 파일럿 기수 한정 DB read 로 대체해 컨택 탭을 **시트 read 0회**로 만든다.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/contact.ts(loadDay), lib/repo/db/read-daily.ts(신규), R2-3(일정·계약 탭이 readMeetingsFromDb 재사용)
> - **읽고 나면 알 수 있는 것**: payload 두 형태(dual-write vs backfill)가 왜 공존하고 어떻게 흡수되나 / 게이트·fallback 은 어디인가 / 정합은 무엇이 고정하나
> - **관련 문서**: docs/plans/completed/db-read-contact.md(R2-1 패턴), docs/plans/active/db-first-unlimited-roadmap.md §R2

# R2-2 — 컨택 탭 미팅·현수막 읽기 DB 전환

## 스코프
- loadDay 의 `findByDate`(04 미팅 카드) + `readBanners` Σ주문개수(03 현수막) → DB read.
- 게이트 = R2-1 의 `chooseDailySource` **재사용**(파일럿 목록 한 곳 — daily-source.ts, 아레나 포함 #492).
- DB 실패 시 **전체** 시트 경로 silent fallback + Sentry(where=loadDay-db-read). 비파일럿 불변.
- "미팅예약 = 카드 수 파생"(ADR-0010) 로직 불변 — meetings 출처만 바뀜.
- 같은 미팅을 읽는 일정·계약 탭(loadWeekMeetings)·캘린더는 **R2-3 범위 밖** — 단
  `readMeetingsFromDb` 가 시트 전체 미팅을 반환하므로 R2-3 은 재사용만 하면 됨.

## 핵심 설계 — payload 두 형태 공존 흡수 (lib/repo/db/read-daily.ts)
sheet_rows payload 는 같은 row_key 에 두 형태가 jsonb 병합돼 있다:
1. **dual-write(mirror.ts)** = 필드명 키 — meetings: Meeting 객체, db 현수막: DBBanner 스프레드.
2. **backfill(스크립트)** = 열문자 키(A.., P..) + `_backfill:true`, 값 전부 문자열화
   (직렬 날짜 "46042", boolean "true").

`meetingFromDbPayload`: 필드명(id 존재·Zod 통과) 우선 → 실패 시 열문자를 행 배열로 복원해
시트 파서 `rowToMeeting` **그대로 재사용**(coerce: 숫자열→number, "true"→boolean).
`bannerOrderQtyFromDbPayload`: `주문개수` 필드 우선, 열문자 `T` fallback.
→ 변환기가 유일한 차이 지점 — tests/service/db-read-meetings-banners.test.ts 가
시트 파서 결과와의 동등성을 고정(정합 대조).

## 알려진 미세 차이 (승인된 트레이드오프)
- 미팅 카드 순서: 시트 = 행 순서, DB = 예약일→예약시각→id 정렬(결정적). 같은 날 카드가
  시각순으로 정렬됨 — 사용자 관점 개선이거나 중립.

## 수용 기준 스냅샷
- 정합 자동 대조(위 테스트) + 비파일럿 시트 고정(기존 daily-source 테스트 유지).
- 파일럿+캐시 히트 시 GET /api/daily sheets_calls **5→0** (전/후는 PR 본문·배포 후 관찰).
- pg 는 lib/repo/db/ 전용 유지, 전 파일 ≤500줄, check.sh 초록.

## Log
- 2026-07-08 설계·구현: read-daily.ts 신설(meetings·banner qty read + 이중 형태 변환),
  loadDay DB 경로 확장(Promise.all 3쿼리), meetings.ts rowToMeeting export(1단어),
  client.ts getDbPool 접근자. 500줄 캡 때문에 변환기는 meetings.ts/db.ts 가 아닌
  read-daily.ts 에 배치(두 파일 모두 캡 직전 499·494줄).
