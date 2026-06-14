---
slug: notice-popup-six-items
status: active
created: 2026-06-14
owner: belie
related: announcement-popup
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새소식 팝업 최근 업데이트 노출 개수 10→6, 나머지는 "모두 보기".
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: lib/service/announcements.ts pickVisibleUpdates
> - **읽고 나면 알 수 있는 것**: VISIBLE_LIMIT 값, 그룹 단위 카운트
> - **관련 문서**: announcement-popup.md

# 새소식 팝업 6개 노출

VISIBLE_LIMIT 10→6. pickVisibleUpdates 는 항목(그룹) 단위 6개 → 그룹 행 전부 반환(로직 불변).
나머지는 /updates 보관함 "지난 업데이트 모두 보기" 링크. 단위테스트 6 기준 갱신.

## 상태
- 2026-06-14 완료(fix/notice-popup-six-items).
