---
status: completed
slug: bottom-nav-4plus1
created: 2026-06-19
owner: belie
related: 0019-bottom-nav-4plus1, components
completed: 2026-06-19
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 하단 네비게이션을 4+1(중앙 캘린더 FAB) 구조로 재배치·컴포넌트화하는 작업 계획.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: components/TabBar.tsx, app/(app)/layout.tsx, ADR-0019, components.md §5
> - **읽고 나면 알 수 있는 것**: 스코프, 변경 파일, 수용 기준
> - **관련 문서**: [ADR-0019](../../decisions/0019-bottom-nav-4plus1.md), [prototype](../../design/prototypes/bottom-nav-4plus1.html)

# 바텀탭 4+1 재배치 + DB생산 라벨

## 스코프 (바만)
하단 네비게이션 바의 재배치·컴포넌트화만. 기능 변경(DB생산 집계쓰기, 컨택 경량화, 현수막 2단계, 넛지, 직접생산 기간폼)은 별도 PR(YAGNI).

## 변경
- `TabBar.tsx`: 설정 기반(LEFT/RIGHT Tab[] + CENTER) + `TabItem`·`CenterFab`·`Dots` 내부 프리미티브. 순서 DB생산·컨택관리·[캘린더]·일정·계약·실무/수납. 단계 점 1~4. 중앙 캘린더 입체 FAB. 480px 캡(`max-w-bottom-nav`).
- 라벨 `DB관리→DB생산`: TabBar + `/db` TopHeader pageTitle (라우트·코드키·주석은 그대로).
- `tailwind.config.ts`: `maxWidth.bottom-nav = 480px` 토큰(arbitrary 금지).
- 정본 prototype `bottom-nav-4plus1.html` 동봉. ADR-0019 + components.md §5 갱신.

## 수용 기준
- 5개 (app) 페이지에서 새 바 동일 표시(좌→우: DB생산·컨택관리·[캘린더]·일정·계약·실무/수납).
- 단계 점 1·2·3·4, 현재 탭만 파랑. 중앙 캘린더 입체 FAB(홈보다 약한 강조).
- 넓은 화면 480px 캡 안 flex-1 균등, 양옆 여백. 라벨 DB생산(라우트 /db 유지).
- check.sh 전부 green + 배포 success + health 200.

## 후속 (별도)
- ContactResultModals 등 "DB관리" 사용자 노출 문자열 → "DB생산" 일관화(이번 PR 스코프 밖).

## Log
- 2026-06-19 구현(feat/bottom-nav-4plus1): TabBar 재배치+컴포넌트화, DB생산 라벨, 480 토큰, ADR-0019, §5 갱신.
