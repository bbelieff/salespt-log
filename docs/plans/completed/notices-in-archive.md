---
status: completed
slug: notices-in-archive
created: 2026-06-15
owner: belie
related: announcement-popup
completed: 2026-06-15
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새소식 보관함(/updates) 상단에 '공지' 섹션을 추가해 지난 공지도 다시 보게 함.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: lib/service/announcements.ts, app/api/announcements/archive, app/(app)/updates
> - **읽고 나면 알 수 있는 것**: 만료 공지 다시보기 규칙, API 동봉 방식, 렌더 순서
> - **관련 문서**: announcement-popup.md

# 새소식 보관함에 공지 섹션 추가

## 문제
- 지금 /updates 는 업데이트(changelog)만 월별 표시. 공지는 첫 팝업에서만 보여 다시 볼 곳이 없음.

## 구현
- **service** `filterNoticesArchiveFor(notices,{isArena,today})`(순수): active·audience 매칭 +
  미래(start>today) 제외 + **만료(end<today) 포함**(지난 공지 다시보기), 날짜(start||created) desc.
  `listNoticesArchiveFor(email)`: cachedTabs + 사용자 cohort audience.
  (팝업용 `filterNoticesFor` 는 그대로 — 기간 만료 제외 유지.)
- **API** `GET /api/announcements/archive`: `offset===0` 일 때만 `notices` 동봉
  (공지는 수 적어 첫 페이지 전량, 페이징은 업데이트만 — 중복 방지).
  응답 `{ notices, rows, totalItems, offset, limit }`.
- **화면** `/updates`: 첫 응답 notices 보관 → ① '공지' 섹션(구분선 + 카드: 제목·날짜·본문,
  pinned 📌+빨강 톤, 본문은 팝업과 동일 MarkdownView) → ② 기존 '업데이트' 월별.
  공지 0개면 섹션 숨김. 빈 상태 문구 "아직 새소식이 없어요".

## 검증
- 단위테스트(announcements.test): filterNoticesArchiveFor 만료 포함·audience·날짜 desc.
- typecheck/lint/test green.

## 상태
- 2026-06-15 완료(feat/notices-in-archive).
