---
slug: loading-overlay
status: active
created: 2026-06-16
owner: belie
related: design-tokens
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 스피너를 브랜드 전역 로딩 팝업(글로우 링)으로 통일 + 상황별 문구.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: components/ui/LoadingOverlay·LoadingProvider, providers.tsx
> - **읽고 나면 알 수 있는 것**: 트리거(명령형+useIsMutating), 문구, 접근성
> - **관련 문서**: docs/design/tokens.md(overlay 토큰), components.md

# 전역 로딩 팝업 (글로우 링)

## 구현
- **LoadingOverlay**(components/ui, client): 다크 글래스 카드 + 회전 conic 링 + 궤도 점 +
  'S' 호흡 + 문구 페이드 + 하단 sweep. props `message?`(기본 "불러오고 있어요").
  fixed z-[400] 중앙·dim(safe-area 무시). role=status aria-live=polite.
  prefers-reduced-motion → 키프레임 비활성 정적 폴백. 스타일=globals.css `.lo-*`(tokens overlay 토큰).
- **LoadingProvider** + `useGlobalLoading()`: providers.tsx(QueryClientProvider 안)에서 1회 마운트.
  (a) 명령형 show(문구)/hide() — 카운터(중첩 안전). (b) `useIsMutating()>0` 자동("저장하고 있어요").
  useIsFetching 은 안 검(백그라운드 refetch 과노출 방지).
- 문구: 저장/불러오기/연결.

## 교체 지점
- dashboard: isLoading 텍스트 → `<LoadingOverlay message="대시보드를 불러오고 있어요"/>`.
- claim: 제출 시 show("연결하고 있어요")/hide() (성공은 full reload 라 유지).
- 컨택·계약·DB·투두 저장: react-query mutation → useIsMutating 자동(파일 수정 0).
- 토글 등 사소한 동작: 오버레이 X(기존 인라인 유지).

## 검증
- typecheck/lint/test green. 모바일(375)·PC 중앙 정렬·애니메이션. 문구 전환·종료. reduced-motion 폴백.

## 전역 자동화 (loading-overlay-global-auto, 2026-06-16)
- LoadingProvider 가 React Query 캐시 구독으로 자동 표시: 뮤테이션 pending + 쿼리 초기로딩(pending&fetching). 백그라운드 refetch 제외.
- 플리커 가드: show 150ms 디바운스 + 최소 350ms 유지. 문구는 meta.loadingMessage > 명령형 > 기본(저장/불러오기).
- 중복 제거: dashboard 수동 LoadingOverlay + calendar/contact/payment/db/schedule 페이지 "불러오고 있어요" 텍스트 제거(전역 위임). claim 은 RQ 밖이라 명령형 show 유지.

## 상태
- 2026-06-16 진행(feat/global-loading-overlay).
