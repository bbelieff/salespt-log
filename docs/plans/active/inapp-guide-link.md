---
slug: inapp-guide-link
status: active
created: 2026-06-16
owner: belie
related: announcement-popup
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 공지팝업·새소식 보관함에서 노션 사용 가이드로 가는 진입점 버튼 추가(활성화 유도).
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: NoticePopup, /updates, lib/config guideUrl
> - **읽고 나면 알 수 있는 것**: env 가드, 외부 링크 안전
> - **관련 문서**: announcement-popup.md

# 사용 가이드 링크 (노션 온보딩)

## 배경
접속→미팅예약 8% 병목(PostHog) → 신규 수강생을 노션 가이드(EP.01~10)로 유도.

## 구현
- `lib/config` `guideUrl()` = `NEXT_PUBLIC_GUIDE_URL` (노션 '웹에 게시' 공개 URL). 미설정 "" → 버튼 미렌더(가드). 하드코딩 금지.
- **NoticePopup**: footer 확인 버튼 영역에 가이드 있으면 [📚 사용 가이드 보기](brand-red 풀폭, 새 탭). 가이드 있을 땐 확인=보조(outline), 없으면 확인=주(brand-red). 공지·업데이트 없어도 노출.
- **/updates**: TopHeader 아래·목록 위 상시 카드 "📚 처음이신가요? 사용 가이드 보기 →"(새 탭). 팝업이 닫혀도 상시 진입점.
- 외부 링크 전부 `target=_blank rel="noopener noreferrer"`. URL 은 env 만(사용자/관찰값 X).

- **TopHeader 계정 메뉴**(#5): 새소식 항목 아래 [📚 사용 가이드](새 탭) — guideUrl 있으면 모든 (app) 페이지 상시 진입점. 보관함·팝업 버튼은 보조.

## 검증
- env 설정 시 버튼 노출+노션 새 탭 / 미설정 시 숨김. 모바일·데스크탑 정렬. typecheck/lint/test green.

## 상태
- 2026-06-16 진행(feat/inapp-guide-link). VPS·.env.local NEXT_PUBLIC_GUIDE_URL 은 belie 입력.
